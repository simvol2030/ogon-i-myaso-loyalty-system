import { db } from '../db/client';
import { transactions, loyaltyUsers } from '../db/schema';
import { lt, eq, sql, inArray } from 'drizzle-orm';
import { getPointsExpirationCutoffDate } from '../utils/retention';

/**
 * Expire points from transactions older than 45 days
 *
 * This function processes 'earn' transactions older than 45 days and deducts
 * those points from customer balances.
 *
 * FIFO Logic:
 * - Points earned 45+ days ago expire first
 * - Only 'earn' type transactions are considered for expiration
 * - Customer balance is reduced by the sum of expired points
 * - Expired transactions are marked but not deleted (audit trail)
 *
 * @param dryRun - If true, only calculate without updating balances
 * @returns Object with stats about expired points
 */
export async function expireOldPoints(dryRun: boolean = false): Promise<{
	affectedCustomers: number;
	totalPointsExpired: number;
	transactions: number;
}> {
	try {
		// Calculate cutoff date (exactly 45 days)
		const cutoffIso = getPointsExpirationCutoffDate();

		console.log(`[EXPIRE POINTS] Cutoff date: ${cutoffIso} (dry-run: ${dryRun})`);

		// Find all 'earn' transactions older than cutoff that haven't been processed
		const expiredTransactions = await db
			.select({
				id: transactions.id,
				loyalty_user_id: transactions.loyalty_user_id,
				amount: transactions.amount,
				created_at: transactions.created_at
			})
			.from(transactions)
			.where(
				sql`${transactions.type} = 'earn'
					AND ${transactions.created_at} < ${cutoffIso}
					AND (${transactions.spent} IS NULL OR ${transactions.spent} != 'expired')`
			);

		if (expiredTransactions.length === 0) {
			console.log('[EXPIRE POINTS] No transactions to expire');
			return { affectedCustomers: 0, totalPointsExpired: 0, transactions: 0 };
		}

		// Group by customer
		const expirationsByCustomer = new Map<number, number>();
		for (const tx of expiredTransactions) {
			const currentTotal = expirationsByCustomer.get(tx.loyalty_user_id) || 0;
			expirationsByCustomer.set(tx.loyalty_user_id, currentTotal + tx.amount);
		}

		console.log(
			`[EXPIRE POINTS] Found ${expiredTransactions.length} expired transactions from ${expirationsByCustomer.size} customers`
		);

		if (dryRun) {
			let totalExpired = 0;
			for (const [customerId, points] of expirationsByCustomer) {
				console.log(`[DRY-RUN] Customer ${customerId} would lose ${points} points`);
				totalExpired += points;
			}
			return {
				affectedCustomers: expirationsByCustomer.size,
				totalPointsExpired: totalExpired,
				transactions: expiredTransactions.length
			};
		}

		// ACTUAL EXPIRATION: Update customer balances and mark transactions
		// FIX: Wrap in transaction to prevent data corruption if job fails mid-execution
		const result = await db.transaction(async (tx) => {
			let totalPointsExpired = 0;
			const transactionIds = expiredTransactions.map((txn) => txn.id);

			for (const [customerId, pointsToExpire] of expirationsByCustomer) {
				// Get current customer balance
				const customer = await tx.query.loyaltyUsers.findFirst({
					where: eq(loyaltyUsers.id, customerId)
				});

				if (!customer) {
					console.warn(`[EXPIRE POINTS] Customer ${customerId} not found, skipping`);
					continue;
				}

				// Warn if pointsToExpire > current_balance (data corruption indicator)
				if (pointsToExpire > customer.current_balance) {
					console.warn(
						`[EXPIRE POINTS] Customer ${customerId} has insufficient balance. ` +
						`Current: ${customer.current_balance}, Expiring: ${pointsToExpire}. ` +
						`This may indicate data corruption or partial refunds.`
					);
				}

				// Calculate new balance (cannot go negative)
				const newBalance = Math.max(0, customer.current_balance - pointsToExpire);
				const actualExpired = customer.current_balance - newBalance;

				// Update customer balance
				await tx
					.update(loyaltyUsers)
					.set({
						current_balance: newBalance,
						last_activity: new Date().toISOString()
					})
					.where(eq(loyaltyUsers.id, customerId));

				totalPointsExpired += actualExpired;

				console.log(
					`[EXPIRE POINTS] Customer ${customerId}: ${customer.current_balance} → ${newBalance} (expired: ${actualExpired})`
				);
			}

			// Mark transactions as expired (for audit trail)
			// FIX: Prevent SQL injection when array is empty
			if (transactionIds.length > 0) {
				await tx
					.update(transactions)
					.set({ spent: 'expired' })
					.where(inArray(transactions.id, transactionIds));
			}

			return totalPointsExpired;
		});

		const totalPointsExpired = result;

		console.log(
			`[EXPIRE POINTS] Expired ${totalPointsExpired} points from ${expirationsByCustomer.size} customers`
		);

		return {
			affectedCustomers: expirationsByCustomer.size,
			totalPointsExpired,
			transactions: expiredTransactions.length
		};
	} catch (error) {
		console.error('[EXPIRE POINTS ERROR]', error);
		throw error;
	}
}
