import { db } from '$lib/server/db/client';
import { loyaltyUsers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

/**
 * Root layout data loader
 *
 * DATABASE VERSION (Phase 3 Update):
 * - Loads demo user as fallback (for testing in browser)
 * - Loads REAL user stats (totalPurchases, totalSaved) from database if authenticated
 * - ProfileCard component merges Telegram SDK data instantly
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
      const [loyaltyUser] = await db
        .select({
          id: loyaltyUsers.id,
          first_name: loyaltyUsers.first_name,
          last_name: loyaltyUsers.last_name,
          card_number: loyaltyUsers.card_number,
          current_balance: loyaltyUsers.current_balance,
          total_purchases: loyaltyUsers.total_purchases,
          total_saved: loyaltyUsers.total_saved
        })
        .from(loyaltyUsers)
        .where(eq(loyaltyUsers.telegram_user_id, telegramUserId))
        .limit(1);

      if (loyaltyUser) {
        user = {
          id: loyaltyUser.id,
          name: `${loyaltyUser.first_name} ${loyaltyUser.last_name || ''}`.trim(),
          cardNumber: loyaltyUser.card_number || '000000',
          balance: loyaltyUser.current_balance,
          totalPurchases: loyaltyUser.total_purchases ?? 0,
          totalSaved: loyaltyUser.total_saved ?? 0
        };
        isDemoMode = false;
        console.log('[+layout.server.ts] Loaded real user stats:', {
          telegram_user_id: telegramUserId,
          totalPurchases: user.totalPurchases,
          totalSaved: user.totalSaved
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
