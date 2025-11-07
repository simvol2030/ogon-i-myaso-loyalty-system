import { db } from '../db/client';
import { transactions } from '../db/schema';
import { lt, sql } from 'drizzle-orm';

/**
 * Cleanup old transactions (older than 30 days)
 *
 * This function deletes transactions that are older than 30 days
 * to comply with the data retention policy.
 *
 * @param dryRun - If true, only count records without deleting
 * @returns Number of records deleted (or that would be deleted in dry-run mode)
 */
export async function cleanupOldTransactions(dryRun: boolean = false): Promise<number> {
	try {
		// Calculate cutoff date (30 days ago)
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - 30);
		const cutoffIso = cutoffDate.toISOString();

		console.log(`[CLEANUP] Cutoff date: ${cutoffIso} (dry-run: ${dryRun})`);

		if (dryRun) {
			// Dry run: count records that would be deleted
			const recordsToDelete = await db
				.select()
				.from(transactions)
				.where(lt(transactions.created_at, cutoffIso));

			const count = recordsToDelete.length;
			console.log(`[CLEANUP DRY-RUN] Would delete ${count} transactions older than ${cutoffIso}`);
			return count;
		}

		// Actual deletion
		const result = await db
			.delete(transactions)
			.where(lt(transactions.created_at, cutoffIso))
			.returning({ id: transactions.id });

		const deletedCount = result.length;
		console.log(`[CLEANUP] Deleted ${deletedCount} transactions older than ${cutoffIso}`);

		return deletedCount;
	} catch (error) {
		console.error('[CLEANUP ERROR]', error);
		throw error;
	}
}
