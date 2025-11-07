import { db } from '$lib/server/db/client';
import { transactions, loyaltyUsers } from '$lib/server/db/schema';
import { desc, eq, gte, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { EXAMPLE_TRANSACTIONS } from '$lib/data/loyalty/history_examples';

/**
 * Data loader for Transaction History page
 *
 * Logic:
 * 1. Get telegram_user_id from cookie (set by /api/telegram/init)
 * 2. JOIN with loyalty_users to get loyalty_user.id
 * 3. Load real transactions for this user from database
 * 4. Show examples ONLY if user has <5 transactions OR no 'spend' transactions yet
 *
 * Hiding examples criteria:
 * - User has >= 5 transactions AND at least one 'spend' transaction
 */
export const load: PageServerLoad = async ({ cookies }) => {
	// Get telegram_user_id from cookie (set by /api/telegram/init)
	const telegramUserIdStr = cookies.get('telegram_user_id');

	if (!telegramUserIdStr) {
		console.warn('[history/+page.server.ts] No telegram_user_id cookie found');
		// Return only examples for demo mode
		return {
			realHistory: [],
			exampleHistory: EXAMPLE_TRANSACTIONS,
			showExamples: true
		};
	}

	// Validate parseInt result (FIX #4: parseInt validation)
	const telegramUserId = parseInt(telegramUserIdStr, 10);
	if (isNaN(telegramUserId) || telegramUserId <= 0) {
		console.error('[history/+page.server.ts] Invalid telegram_user_id:', telegramUserIdStr);
		return {
			realHistory: [],
			exampleHistory: EXAMPLE_TRANSACTIONS,
			showExamples: true
		};
	}

	console.log('[history/+page.server.ts] Loading history for telegram_user_id:', telegramUserId);

	// Calculate 30 days ago cutoff date
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const cutoffDate = thirtyDaysAgo.toISOString();

	console.log('[history/+page.server.ts] Loading transactions since:', cutoffDate);

	// FIX #1: JOIN with loyalty_users to get loyalty_user.id
	// telegram_user_id (123456789) → loyalty_user.id (1, 2, 3...)
	// FIX #6: Changed from .limit(50) to date-based filtering (30 days)
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

	// Determine if we should show examples
	// Show examples if:
	// - User has < 5 transactions OR
	// - User has no 'spend' transactions yet
	const hasSpendTransaction = realHistory.some((tx) => tx.type === 'spend');
	const showExamples = realHistory.length < 5 || !hasSpendTransaction;

	console.log('[history/+page.server.ts] Show examples:', showExamples, {
		count: realHistory.length,
		hasSpend: hasSpendTransaction
	});

	return {
		realHistory,
		exampleHistory: showExamples ? EXAMPLE_TRANSACTIONS : [],
		showExamples
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
