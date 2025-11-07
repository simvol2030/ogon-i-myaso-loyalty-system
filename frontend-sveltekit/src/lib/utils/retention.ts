/**
 * Centralized retention period utilities
 *
 * Ensures consistent cutoff date calculation across:
 * - Transaction history display
 * - Profile statistics calculation
 */

/**
 * Retention period in days (matches loyalty points expiry)
 */
export const RETENTION_DAYS = 45;

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
