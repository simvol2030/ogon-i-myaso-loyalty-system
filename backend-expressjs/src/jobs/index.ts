import cron from 'node-cron';
import { cleanupOldTransactions } from './cleanupTransactions';
import { expireOldPoints } from './expirePoints';
import { checkScheduledCampaigns } from './checkScheduledCampaigns';
import { processBirthdayTrigger } from './processBirthdayTrigger';
import { processInactiveTrigger } from './processInactiveTrigger';

/**
 * Initialize all scheduled jobs
 *
 * This function sets up cron jobs for:
 * - Points expiration (daily at 2:00 AM UTC)
 * - Transaction cleanup (daily at 3:00 AM UTC)
 * - Scheduled campaigns check (every minute)
 * - Birthday trigger (daily at 9:00 AM Moscow / 6:00 AM UTC)
 * - Inactive customers trigger (daily at 10:00 AM Moscow / 7:00 AM UTC)
 *
 * In development mode, jobs run in dry-run mode (no actual changes)
 */
export function initScheduledJobs() {
	const isDevelopment = process.env.NODE_ENV === 'development';

	console.log('[CRON] Initializing scheduled jobs...');
	console.log(`[CRON] Environment: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}`);
	console.log(`[CRON] Dry-run mode: ${isDevelopment ? 'ENABLED' : 'DISABLED'}`);

	// NEW: Expire old points daily at 2:00 AM UTC
	// Runs BEFORE transaction cleanup to ensure consistency
	cron.schedule('0 2 * * *', async () => {
		console.log('[CRON] Starting points expiration job...');
		console.log(`[CRON] Current time: ${new Date().toISOString()}`);

		try {
			const result = await expireOldPoints(isDevelopment);

			if (isDevelopment) {
				console.log(
					`[CRON] Points expiration completed (DRY-RUN). Would expire: ${result.totalPointsExpired} points from ${result.affectedCustomers} customers`
				);
			} else {
				console.log(
					`[CRON] Points expiration completed. Expired: ${result.totalPointsExpired} points from ${result.affectedCustomers} customers`
				);
			}
		} catch (error) {
			console.error('[CRON] Points expiration failed:', error);
			// Don't throw - let cron continue running
		}
	}, {
		timezone: 'UTC'
	});

	// Run daily at 3:00 AM UTC
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
	}, {
		timezone: 'UTC'
	});

	// Every minute - check for scheduled campaigns to send
	cron.schedule('* * * * *', async () => {
		try {
			const result = await checkScheduledCampaigns(isDevelopment);

			if (result.checked > 0) {
				if (isDevelopment) {
					console.log(`[CRON] Campaign check (DRY-RUN): ${result.checked} campaigns, would start ${result.started}`);
				} else {
					console.log(`[CRON] Campaign check: ${result.checked} campaigns, started ${result.started}, failed ${result.failed}`);
				}
			}
		} catch (error) {
			console.error('[CRON] Campaign check failed:', error);
		}
	});

	// Daily at 9:00 AM Moscow time (6:00 UTC) - Birthday trigger
	cron.schedule('0 6 * * *', async () => {
		console.log('[CRON] Starting birthday trigger job...');
		console.log(`[CRON] Current time: ${new Date().toISOString()}`);

		try {
			const result = await processBirthdayTrigger(isDevelopment);

			if (isDevelopment) {
				console.log(
					`[CRON] Birthday trigger completed (DRY-RUN). Found ${result.usersWithBirthday} birthdays, would create ${result.campaignsCreated} campaigns`
				);
			} else {
				console.log(
					`[CRON] Birthday trigger completed. Found ${result.usersWithBirthday} birthdays, created ${result.campaignsCreated} campaigns`
				);
				if (result.errors.length > 0) {
					console.error('[CRON] Birthday trigger errors:', result.errors);
				}
			}
		} catch (error) {
			console.error('[CRON] Birthday trigger failed:', error);
		}
	}, {
		timezone: 'UTC'
	});

	// Daily at 10:00 AM Moscow time (7:00 UTC) - Inactive customers trigger
	cron.schedule('0 7 * * *', async () => {
		console.log('[CRON] Starting inactive customer trigger job...');
		console.log(`[CRON] Current time: ${new Date().toISOString()}`);

		try {
			const result = await processInactiveTrigger(isDevelopment);

			if (isDevelopment) {
				console.log(
					`[CRON] Inactive trigger completed (DRY-RUN). Processed ${result.triggersProcessed} triggers, found ${result.usersFound} users`
				);
			} else {
				console.log(
					`[CRON] Inactive trigger completed. Processed ${result.triggersProcessed} triggers, created ${result.campaignsCreated} campaigns`
				);
				if (result.errors.length > 0) {
					console.error('[CRON] Inactive trigger errors:', result.errors);
				}
			}
		} catch (error) {
			console.error('[CRON] Inactive trigger failed:', error);
		}
	}, {
		timezone: 'UTC'
	});

	console.log('[CRON] Scheduled jobs initialized');
	console.log('[CRON] Points expiration: Daily at 2:00 AM UTC');
	console.log('[CRON] Transaction cleanup: Daily at 3:00 AM UTC');
	console.log('[CRON] Scheduled campaigns check: Every minute');
	console.log('[CRON] Birthday trigger: Daily at 9:00 AM Moscow (6:00 UTC)');
	console.log('[CRON] Inactive customers trigger: Daily at 10:00 AM Moscow (7:00 UTC)');
}
