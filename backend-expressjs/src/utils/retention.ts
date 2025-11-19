/**
 * Centralized retention period utilities
 *
 * Ensures consistent cutoff date calculation across:
 * - Transaction history display
 * - Profile statistics calculation
 * - Cleanup job (with grace period)
 */

/**
 * Retention period in days (matches loyalty points expiry)
 */
export const RETENTION_DAYS = 45;

/**
 * Grace period for cleanup job (extra day to avoid race conditions)
 */
export const CLEANUP_GRACE_PERIOD = 1;

/**
 * Get retention cutoff date (45 days ago, UTC midnight)
 *
 * Used for:
 * - Displaying transaction history
 * - Calculating profile statistics
 *
 * @returns ISO string representing 45 days ago at 00:00:00 UTC
 */
export function getRetentionCutoffDate(): string {
	const cutoff = new Date();
	cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
	cutoff.setUTCHours(0, 0, 0, 0); // Start of day UTC
	return cutoff.toISOString();
}

/**
 * Get points expiration cutoff date (exactly 45 days ago)
 *
 * Used for expiring loyalty points (FIFO - First In First Out).
 * Points earned more than 45 FULL days ago are no longer valid.
 *
 * Business Rule: Points expire after exactly 45 FULL days
 * Example: Points earned on Dec 7, 2024 expire on Jan 21, 2025 at 00:00:00 UTC
 *          (exactly 45 full days later)
 *
 * Math Verification:
 * - Today: Jan 21, 2025
 * - Calculation: setUTCDate(21 - 45) = Dec 7, 2024 00:00:00 UTC
 * - Points earned Dec 7 00:00:00 or later are still valid (< 45 days old)
 * - Points earned Dec 6 23:59:59 or earlier have expired (>= 45 days old)
 *
 * @returns ISO string representing midnight UTC exactly 45 days ago
 */
export function getPointsExpirationCutoffDate(): string {
	const cutoff = new Date();
	// Calculate exactly 45 days ago
	cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
	cutoff.setUTCHours(0, 0, 0, 0); // Midnight UTC
	return cutoff.toISOString();
}

/**
 * Get cleanup cutoff date (46 days ago, UTC midnight)
 *
 * Used by cleanup job to delete old transactions.
 * Grace period prevents race condition with statistics calculation.
 *
 * @returns ISO string representing 46 days ago at 00:00:00 UTC
 */
export function getCleanupCutoffDate(): string {
	const cutoff = new Date();
	cutoff.setUTCDate(cutoff.getUTCDate() - (RETENTION_DAYS + CLEANUP_GRACE_PERIOD));
	cutoff.setUTCHours(0, 0, 0, 0); // Start of day UTC
	return cutoff.toISOString();
}
