/**
 * Cleanup job for pending_discounts table
 * MEDIUM-4 FIX: Удаляет старые записи pending_discounts
 *
 * Runs hourly to:
 * 1. Delete expired records older than 24 hours
 * 2. Delete applied/failed records older than 7 days
 * 3. Log statistics
 */

import { db } from '../db/client';
import { pendingDiscounts, activeChecks } from '../db/schema';
import { lt, and, eq } from 'drizzle-orm';

interface CleanupResult {
	expiredDeleted: number;
	appliedDeleted: number;
	failedDeleted: number;
	activeChecksDeleted: number;
}

/**
 * Clean up old pending discounts and active checks
 * @param dryRun - If true, only report what would be deleted
 */
export async function cleanupPendingDiscounts(dryRun = false): Promise<CleanupResult> {
	const now = new Date();

	// Dates for cleanup thresholds
	const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

	let expiredDeleted = 0;
	let appliedDeleted = 0;
	let failedDeleted = 0;
	let activeChecksDeleted = 0;

	try {
		if (dryRun) {
			// Count records that would be deleted
			const expiredCount = await db.select()
				.from(pendingDiscounts)
				.where(and(
					eq(pendingDiscounts.status, 'expired'),
					lt(pendingDiscounts.created_at, twentyFourHoursAgo)
				));
			expiredDeleted = expiredCount.length;

			const appliedCount = await db.select()
				.from(pendingDiscounts)
				.where(and(
					eq(pendingDiscounts.status, 'applied'),
					lt(pendingDiscounts.created_at, sevenDaysAgo)
				));
			appliedDeleted = appliedCount.length;

			const failedCount = await db.select()
				.from(pendingDiscounts)
				.where(and(
					eq(pendingDiscounts.status, 'failed'),
					lt(pendingDiscounts.created_at, sevenDaysAgo)
				));
			failedDeleted = failedCount.length;

			// Active checks older than TTL
			const activeChecksCount = await db.select()
				.from(activeChecks)
				.where(lt(activeChecks.expires_at, now.toISOString()));
			activeChecksDeleted = activeChecksCount.length;

		} else {
			// Actually delete records

			// 1. Delete expired records older than 24 hours
			const expiredResult = await db.delete(pendingDiscounts)
				.where(and(
					eq(pendingDiscounts.status, 'expired'),
					lt(pendingDiscounts.created_at, twentyFourHoursAgo)
				))
				.returning();
			expiredDeleted = expiredResult.length;

			// 2. Delete applied records older than 7 days
			const appliedResult = await db.delete(pendingDiscounts)
				.where(and(
					eq(pendingDiscounts.status, 'applied'),
					lt(pendingDiscounts.created_at, sevenDaysAgo)
				))
				.returning();
			appliedDeleted = appliedResult.length;

			// 3. Delete failed records older than 7 days
			const failedResult = await db.delete(pendingDiscounts)
				.where(and(
					eq(pendingDiscounts.status, 'failed'),
					lt(pendingDiscounts.created_at, sevenDaysAgo)
				))
				.returning();
			failedDeleted = failedResult.length;

			// 4. Delete expired active checks
			const activeChecksResult = await db.delete(activeChecks)
				.where(lt(activeChecks.expires_at, now.toISOString()))
				.returning();
			activeChecksDeleted = activeChecksResult.length;
		}

		return {
			expiredDeleted,
			appliedDeleted,
			failedDeleted,
			activeChecksDeleted
		};

	} catch (error) {
		console.error('[CLEANUP] Error during pending discounts cleanup:', error);
		throw error;
	}
}
