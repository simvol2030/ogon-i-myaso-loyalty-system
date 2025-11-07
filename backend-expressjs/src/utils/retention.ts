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
