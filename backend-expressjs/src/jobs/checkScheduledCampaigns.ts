import { getScheduledCampaignsToSend } from '../db/queries/campaigns';
import { startCampaign } from '../services/campaignService';

/**
 * Проверяет запланированные кампании и запускает их, если время пришло
 * Запускается каждую минуту
 */
export async function checkScheduledCampaigns(dryRun: boolean = false): Promise<{
	checked: number;
	started: number;
	failed: number;
	errors: string[];
}> {
	const result = {
		checked: 0,
		started: 0,
		failed: 0,
		errors: [] as string[]
	};

	try {
		// Получаем кампании, которые пора отправить
		const campaigns = await getScheduledCampaignsToSend();
		result.checked = campaigns.length;

		if (campaigns.length === 0) {
			return result;
		}

		console.log(`[CAMPAIGNS] Found ${campaigns.length} scheduled campaigns to send`);

		for (const campaign of campaigns) {
			try {
				console.log(`[CAMPAIGNS] Starting campaign #${campaign.id}: "${campaign.title}"`);

				if (dryRun) {
					console.log(`[CAMPAIGNS] DRY-RUN: Would start campaign #${campaign.id}`);
					result.started++;
					continue;
				}

				const sendResult = await startCampaign(campaign.id);

				if (sendResult.success) {
					console.log(`[CAMPAIGNS] Campaign #${campaign.id} completed successfully`);
					result.started++;
				} else {
					console.error(`[CAMPAIGNS] Campaign #${campaign.id} failed: ${sendResult.error}`);
					result.failed++;
					result.errors.push(`Campaign #${campaign.id}: ${sendResult.error}`);
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error(`[CAMPAIGNS] Error starting campaign #${campaign.id}:`, errorMessage);
				result.failed++;
				result.errors.push(`Campaign #${campaign.id}: ${errorMessage}`);
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('[CAMPAIGNS] Error checking scheduled campaigns:', errorMessage);
		result.errors.push(`Check error: ${errorMessage}`);
	}

	return result;
}
