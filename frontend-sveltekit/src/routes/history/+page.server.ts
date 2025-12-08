import { db } from '$lib/server/db/client';
import { transactions, loyaltyUsers, loyaltySettings } from '$lib/server/db/schema';
import { desc, eq, gte, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getRetentionCutoffDate, getRetentionDays } from '$lib/utils/retention';

/**
 * Data loader for Transaction History page
 *
 * Logic:
 * 1. Get telegram_user_id from cookie (set by /api/telegram/init)
 * 2. JOIN with loyalty_users to get loyalty_user.id
 * 3. Load real transactions for this user from database
 * 4. Load pointsName from loyalty settings
 * 5. Return clean history without demo transactions
 */
export const load: PageServerLoad = async ({ cookies }) => {
	// Get telegram_user_id from cookie (set by /api/telegram/init)
	const telegramUserIdStr = cookies.get('telegram_user_id');

	// Load pointsName from settings
	let pointsName = 'баллов'; // Default fallback
	try {
		const settings = await db.select().from(loyaltySettings).limit(1).get();
		if (settings?.pointsName) {
			pointsName = settings.pointsName;
			console.log('[history/+page.server.ts] ✅ Loaded pointsName:', pointsName);
		}
	} catch (error) {
		console.warn('[history/+page.server.ts] ⚠️ Failed to load pointsName, using default:', error);
	}

	if (!telegramUserIdStr) {
		console.warn('[history/+page.server.ts] No telegram_user_id cookie found');
		return {
			realHistory: [],
			pointsName
		};
	}

	// Validate parseInt result (FIX #4: parseInt validation)
	const telegramUserId = parseInt(telegramUserIdStr, 10);
	if (isNaN(telegramUserId) || telegramUserId <= 0) {
		console.error('[history/+page.server.ts] Invalid telegram_user_id:', telegramUserIdStr);
		return {
			realHistory: [],
			pointsName
		};
	}

	console.log('[history/+page.server.ts] Loading history for telegram_user_id:', telegramUserId);

	// Get centralized cutoff date and retention days (dynamic from settings)
	const [cutoffDate, retentionDays] = await Promise.all([
		getRetentionCutoffDate(),
		getRetentionDays()
	]);

	console.log(`[history/+page.server.ts] Loading transactions since (last ${retentionDays} days):`, cutoffDate);

	// FIX #1: JOIN with loyalty_users to get loyalty_user.id
	// telegram_user_id (123456789) → loyalty_user.id (1, 2, 3...)
	// FIX #6: Changed from .limit(50) to date-based filtering (45 days - matches loyalty points expiry)
	const userTransactions = await db
		.select({
			id: transactions.id,
			title: transactions.title,
			amount: transactions.amount,
			type: transactions.type,
			created_at: transactions.created_at,
			spent: transactions.spent,
			store_name: transactions.store_name
		})
		.from(transactions)
		.innerJoin(loyaltyUsers, eq(transactions.loyalty_user_id, loyaltyUsers.id))
		.where(
			and(
				eq(loyaltyUsers.telegram_user_id, telegramUserId),
				gte(transactions.created_at, cutoffDate)
			)
		)
		.orderBy(desc(transactions.created_at))
		.all();

	console.log('[history/+page.server.ts] Found transactions:', userTransactions.length);

	// Transform to frontend format with proper date formatting
	const realHistory = userTransactions.map((tx) => ({
		id: tx.id.toString(),
		title: tx.title,
		amount: tx.amount,
		type: tx.type,
		date: formatTransactionDate(tx.created_at),
		spent: tx.spent || '',
		storeName: tx.store_name || undefined
	}));

	// ✅ Return clean history without demo transactions
	console.log('[history/+page.server.ts] Returning clean history:', {
		count: realHistory.length,
		pointsName
	});

	return {
		realHistory,
		pointsName
	};
};

/**
 * Format ISO timestamp to Russian locale date
 * Example: "2025-10-23 21:30:15" -> "23 октября, 21:30"
 *
 * FIX #2: Added Invalid Date check
 * FIX #5: Added UTC timezone handling
 */
function formatTransactionDate(isoDate: string): string {
	try {
		// FIX #5: SQLite returns UTC time, add 'Z' for proper parsing
		// "2025-10-23 18:30:15" → "2025-10-23 18:30:15Z"
		const dateWithTimezone = isoDate.includes('Z') ? isoDate : isoDate + 'Z';
		const date = new Date(dateWithTimezone);

		// FIX #2: Check for Invalid Date
		if (isNaN(date.getTime())) {
			console.error('[formatTransactionDate] Invalid date:', isoDate);
			return isoDate; // Return original string as fallback
		}

		const day = date.getDate();
		const month = date.toLocaleDateString('ru-RU', { month: 'long' });
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');

		return `${day} ${month}, ${hours}:${minutes}`;
	} catch (error) {
		console.error('[formatTransactionDate] Error formatting date:', isoDate, error);
		return isoDate;
	}
}
