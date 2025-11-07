import { db } from '$lib/server/db/client';
import { loyaltyUsers, transactions } from '$lib/server/db/schema';
import { eq, gte, and, count, sum, sql } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { getRetentionCutoffDate, RETENTION_DAYS } from '$lib/utils/retention';

/**
 * Root layout data loader
 *
 * DATABASE VERSION (Phase 3 Update - 45 Days):
 * - Loads demo user as fallback (for testing in browser)
 * - Loads REAL user stats (totalPurchases, totalSaved) calculated from last 45 days of transactions
 * - Matches loyalty points expiry period (45 days)
 * - Uses centralized retention utility to prevent race conditions
 * - ProfileCard component displays stats with "за 45 дней" label
 */
export const load: LayoutServerLoad = async ({ cookies }) => {
  // Get telegram_user_id from cookie (set by /api/telegram/init)
  const telegramUserIdStr = cookies.get('telegram_user_id');

  // Demo user data (fallback for non-authenticated users)
  let user = {
    id: 0,
    name: 'Демо Пользователь',
    cardNumber: '000000',
    balance: 500,
    totalPurchases: 0,
    totalSaved: 0
  };

  // Load real user stats if authenticated
  let isDemoMode = true;
  if (telegramUserIdStr) {
    const telegramUserId = parseInt(telegramUserIdStr, 10);

    if (!isNaN(telegramUserId) && telegramUserId > 0) {
      // Load user basic info
      const [loyaltyUser] = await db
        .select({
          id: loyaltyUsers.id,
          first_name: loyaltyUsers.first_name,
          last_name: loyaltyUsers.last_name,
          card_number: loyaltyUsers.card_number,
          current_balance: loyaltyUsers.current_balance
        })
        .from(loyaltyUsers)
        .where(eq(loyaltyUsers.telegram_user_id, telegramUserId))
        .limit(1);

      if (loyaltyUser) {
        // Get centralized cutoff date (prevents race conditions)
        const cutoffDate = getRetentionCutoffDate();

        // Calculate stats from last 45 days of transactions
        // totalPurchases: count of 'earn' type transactions (each purchase earns points)
        // totalSaved: sum of money saved by redeeming points (amount field for 'spend' type)
        const [stats] = await db
          .select({
            purchaseCount: sql<number>`COALESCE(COUNT(CASE WHEN ${transactions.type} = 'earn' THEN 1 END), 0)`,
            totalSaved: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'spend' THEN ABS(${transactions.amount}) ELSE 0 END), 0)`
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.loyalty_user_id, loyaltyUser.id),
              gte(transactions.created_at, cutoffDate)
            )
          );

        user = {
          id: loyaltyUser.id,
          name: `${loyaltyUser.first_name} ${loyaltyUser.last_name || ''}`.trim(),
          cardNumber: loyaltyUser.card_number || '000000',
          balance: loyaltyUser.current_balance,
          totalPurchases: stats?.purchaseCount ?? 0,
          totalSaved: stats?.totalSaved ?? 0
        };
        isDemoMode = false;
        console.log(`[+layout.server.ts] Loaded real user stats (last ${RETENTION_DAYS} days):`, {
          telegram_user_id: telegramUserId,
          totalPurchases: user.totalPurchases,
          totalSaved: user.totalSaved,
          cutoffDate,
          retention_days: RETENTION_DAYS
        });
      }
    }
  }

  // Loyalty rules (static config)
  const loyaltyRules = {
    earning: {
      icon: '💰',
      title: 'Начисление',
      value: '4% от покупки'
    },
    payment: {
      icon: '🎯',
      title: 'Оплата',
      value: 'До 20% чека'
    },
    expiry: {
      icon: '⏱️',
      title: 'Срок',
      value: '45 дней'
    },
    detailedRulesLink: '/profile',
    detailedRulesText: 'Подробные правила программы лояльности'
  };

  return {
    user,
    loyaltyRules,
    isDemoMode
  };
};
