import { db } from '../db/client';
import { transactions } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { getPointsExpirationCutoffDate } from './retention';

/**
 * Calculate available (non-expired) balance for a customer
 *
 * This function calculates the customer's available balance by:
 * 1. Taking the current balance from loyalty_users table
 * 2. Subtracting points from 'earn' transactions older than 45 days that haven't been marked as expired yet
 *
 * This provides real-time expiration checking even if the scheduled job hasn't run yet.
 *
 * @param customerId - Loyalty user ID
 * @param currentBalance - Customer's current balance from database
 * @returns Available balance (excluding expired points)
 */
export async function calculateAvailableBalance(
	customerId: number,
	currentBalance: number
): Promise<{
	availableBalance: number;
	expiredPoints: number;
	needsSync: boolean;
}> {
	try {
		const cutoffIso = getPointsExpirationCutoffDate();

		// Find all 'earn' transactions that are expired but not yet marked
		const expiredEarns = await db
			.select({
				id: transactions.id,
				amount: transactions.amount,
				created_at: transactions.created_at
			})
			.from(transactions)
			.where(
				sql`${transactions.loyalty_user_id} = ${customerId}
					AND ${transactions.type} = 'earn'
					AND ${transactions.created_at} < ${cutoffIso}
					AND (${transactions.spent} IS NULL OR ${transactions.spent} != 'expired')`
			);

		// Sum up expired points
		const expiredPoints = expiredEarns.reduce((sum, tx) => sum + tx.amount, 0);

		// Calculate available balance (cannot go negative)
		const availableBalance = Math.max(0, currentBalance - expiredPoints);

		// needsSync indicates that the scheduled job needs to run to update the database
		const needsSync = expiredPoints > 0;

		if (needsSync) {
			console.log(
				`[BALANCE CALC] Customer ${customerId}: current=${currentBalance}, expired=${expiredPoints}, available=${availableBalance} (needs sync)`
			);
		}

		return {
			availableBalance,
			expiredPoints,
			needsSync
		};
	} catch (error) {
		console.error('[BALANCE CALC ERROR]', error);
		// On error, return current balance to avoid blocking operations
		return {
			availableBalance: currentBalance,
			expiredPoints: 0,
			needsSync: false
		};
	}
}

/**
 * Calculate total points that will expire for a customer
 * (diagnostic function)
 */
export async function getExpiringPointsSummary(customerId: number): Promise<{
	expiringIn7Days: number;
	expiringIn14Days: number;
	expiringIn30Days: number;
	expiredNow: number;
}> {
	const now = new Date();

	const get7DaysAgo = () => {
		const d = new Date(now);
		d.setDate(d.getDate() - 38); // 45 - 7 = 38 days ago
		return d.toISOString();
	};

	const get14DaysAgo = () => {
		const d = new Date(now);
		d.setDate(d.getDate() - 31); // 45 - 14 = 31 days ago
		return d.toISOString();
	};

	const get30DaysAgo = () => {
		const d = new Date(now);
		d.setDate(d.getDate() - 15); // 45 - 30 = 15 days ago
		return d.toISOString();
	};

	const cutoffIso = getPointsExpirationCutoffDate();

	// Expired now (older than 45 days)
	const expiredNow = await db
		.select({ amount: transactions.amount })
		.from(transactions)
		.where(
			sql`${transactions.loyalty_user_id} = ${customerId}
				AND ${transactions.type} = 'earn'
				AND ${transactions.created_at} < ${cutoffIso}
				AND (${transactions.spent} IS NULL OR ${transactions.spent} != 'expired')`
		);

	// Expiring in 7 days
	const expiring7 = await db
		.select({ amount: transactions.amount })
		.from(transactions)
		.where(
			sql`${transactions.loyalty_user_id} = ${customerId}
				AND ${transactions.type} = 'earn'
				AND ${transactions.created_at} >= ${cutoffIso}
				AND ${transactions.created_at} < ${get7DaysAgo()}
				AND (${transactions.spent} IS NULL OR ${transactions.spent} != 'expired')`
		);

	// Expiring in 14 days
	const expiring14 = await db
		.select({ amount: transactions.amount })
		.from(transactions)
		.where(
			sql`${transactions.loyalty_user_id} = ${customerId}
				AND ${transactions.type} = 'earn'
				AND ${transactions.created_at} >= ${get7DaysAgo()}
				AND ${transactions.created_at} < ${get14DaysAgo()}
				AND (${transactions.spent} IS NULL OR ${transactions.spent} != 'expired')`
		);

	// Expiring in 30 days
	const expiring30 = await db
		.select({ amount: transactions.amount })
		.from(transactions)
		.where(
			sql`${transactions.loyalty_user_id} = ${customerId}
				AND ${transactions.type} = 'earn'
				AND ${transactions.created_at} >= ${get14DaysAgo()}
				AND ${transactions.created_at} < ${get30DaysAgo()}
				AND (${transactions.spent} IS NULL OR ${transactions.spent} != 'expired')`
		);

	return {
		expiredNow: expiredNow.reduce((sum, tx) => sum + tx.amount, 0),
		expiringIn7Days: expiring7.reduce((sum, tx) => sum + tx.amount, 0),
		expiringIn14Days: expiring14.reduce((sum, tx) => sum + tx.amount, 0),
		expiringIn30Days: expiring30.reduce((sum, tx) => sum + tx.amount, 0)
	};
}
