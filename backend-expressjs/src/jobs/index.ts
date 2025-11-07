import cron from 'node-cron';
import { cleanupOldTransactions } from './cleanupTransactions';

/**
 * Initialize all scheduled jobs
 *
 * This function sets up cron jobs for:
 * - Transaction cleanup (daily at 3:00 AM)
 *
 * In development mode, cleanup runs in dry-run mode (no actual deletion)
 */
export function initScheduledJobs() {
	const isDevelopment = process.env.NODE_ENV === 'development';

	console.log('[CRON] Initializing scheduled jobs...');
	console.log(`[CRON] Environment: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}`);
	console.log(`[CRON] Dry-run mode: ${isDevelopment ? 'ENABLED' : 'DISABLED'}`);

	// Run daily at 3:00 AM (server timezone)
	// Cron format: minute hour day month weekday
	// 0 3 * * * = At 3:00 AM every day
	cron.schedule('0 3 * * *', async () => {
		console.log('[CRON] Starting transaction cleanup job...');
		console.log(`[CRON] Current time: ${new Date().toISOString()}`);

		try {
			const deletedCount = await cleanupOldTransactions(isDevelopment);

			if (isDevelopment) {
				console.log(`[CRON] Transaction cleanup completed (DRY-RUN). Would delete: ${deletedCount}`);
			} else {
				console.log(`[CRON] Transaction cleanup completed. Deleted: ${deletedCount}`);
			}
		} catch (error) {
			console.error('[CRON] Transaction cleanup failed:', error);
			// Don't throw - let cron continue running
		}
	});

	console.log('[CRON] Scheduled jobs initialized');
	console.log('[CRON] Transaction cleanup: Daily at 3:00 AM');
}
