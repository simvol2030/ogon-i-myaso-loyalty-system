import { getInactiveUsers } from '../services/segmentationService';
import { getAutoSendTriggers, createTriggerLog, updateTriggerLogStatus } from '../db/queries/triggerTemplates';
import { createCampaign, addCampaignRecipients, updateCampaign } from '../db/queries/campaigns';
import { startCampaign } from '../services/campaignService';

/**
 * Обрабатывает триггер "Неактивный клиент"
 * Запускается ежедневно в 10:00
 */
export async function processInactiveTrigger(dryRun: boolean = false): Promise<{
	triggersProcessed: number;
	usersFound: number;
	campaignsCreated: number;
	errors: string[];
}> {
	const result = {
		triggersProcessed: 0,
		usersFound: 0,
		campaignsCreated: 0,
		errors: [] as string[]
	};

	try {
		// Получаем активные auto_send триггеры для inactive_days
		const triggers = await getAutoSendTriggers('inactive_days');

		if (triggers.length === 0) {
			console.log('[INACTIVE] No active inactive_days triggers configured');
			return result;
		}

		console.log(`[INACTIVE] Processing ${triggers.length} inactive customer triggers`);

		for (const trigger of triggers) {
			try {
				result.triggersProcessed++;

				// Получаем конфигурацию триггера
				const config = trigger.event_config ? JSON.parse(trigger.event_config) : {};
				const inactiveDays = config.inactive_days || 30;

				// Получаем неактивных пользователей
				const inactiveUserIds = await getInactiveUsers(inactiveDays);

				if (inactiveUserIds.length === 0) {
					console.log(`[INACTIVE] Trigger #${trigger.id}: No inactive users found (${inactiveDays} days)`);
					continue;
				}

				console.log(`[INACTIVE] Trigger #${trigger.id}: Found ${inactiveUserIds.length} inactive users (${inactiveDays} days)`);
				result.usersFound += inactiveUserIds.length;

				// Создаём лог для триггера
				const log = await createTriggerLog({
					trigger_id: trigger.id,
					event_data: JSON.stringify({
						event: 'inactive_customer',
						inactive_days: inactiveDays,
						users_count: inactiveUserIds.length,
						date: new Date().toISOString()
					}),
					status: 'triggered'
				});

				if (dryRun) {
					console.log(`[INACTIVE] DRY-RUN: Would create campaign for ${inactiveUserIds.length} inactive users`);
					await updateTriggerLogStatus(log.id, 'skipped', undefined, 'Dry run mode');
					continue;
				}

				// Создаём кампанию
				const campaign = await createCampaign({
					title: `Реактивация: ${inactiveUserIds.length} клиентов (${new Date().toLocaleDateString('ru-RU')})`,
					message_text: trigger.message_template || 'Привет, {first_name}! Мы соскучились! Возвращайтесь — у нас для вас бонус! 🎁',
					message_image: trigger.image_url,
					button_text: trigger.button_text,
					button_url: trigger.button_url,
					target_type: 'segment',
					target_filters: JSON.stringify({ inactive_days: inactiveDays }),
					trigger_type: 'event',
					trigger_config: JSON.stringify({ trigger_id: trigger.id, event_type: 'inactive_days' }),
					status: 'draft',
					total_recipients: inactiveUserIds.length
				});

				// Добавляем получателей
				await addCampaignRecipients(campaign.id, inactiveUserIds);

				// Запускаем кампанию
				const sendResult = await startCampaign(campaign.id);

				if (sendResult.success) {
					await updateTriggerLogStatus(log.id, 'campaign_created', campaign.id);
					result.campaignsCreated++;
					console.log(`[INACTIVE] Campaign #${campaign.id} created and sent for trigger #${trigger.id}`);
				} else {
					await updateTriggerLogStatus(log.id, 'error', campaign.id, sendResult.error);
					result.errors.push(`Trigger #${trigger.id}: ${sendResult.error}`);
				}
			} catch (triggerError) {
				const errorMessage = triggerError instanceof Error ? triggerError.message : String(triggerError);
				console.error(`[INACTIVE] Error processing trigger #${trigger.id}:`, errorMessage);
				result.errors.push(`Trigger #${trigger.id}: ${errorMessage}`);
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('[INACTIVE] Error processing inactive trigger:', errorMessage);
		result.errors.push(`General error: ${errorMessage}`);
	}

	return result;
}
