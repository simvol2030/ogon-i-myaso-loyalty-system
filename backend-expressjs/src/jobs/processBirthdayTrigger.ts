import { getUsersWithBirthdayToday } from '../services/segmentationService';
import { getAutoSendTriggers, createTriggerLog, updateTriggerLogStatus } from '../db/queries/triggerTemplates';
import { createAndSendCampaign, personalizeMessage } from '../services/campaignService';
import { getLoyaltyUserById } from '../db/queries/loyaltyUsers';

/**
 * Обрабатывает триггер "День рождения"
 * Запускается ежедневно в 09:00
 */
export async function processBirthdayTrigger(dryRun: boolean = false): Promise<{
	usersWithBirthday: number;
	triggersProcessed: number;
	messagesSent: number;
	errors: string[];
}> {
	const result = {
		usersWithBirthday: 0,
		triggersProcessed: 0,
		messagesSent: 0,
		errors: [] as string[]
	};

	try {
		// Получаем пользователей с днём рождения сегодня
		const birthdayUserIds = await getUsersWithBirthdayToday();
		result.usersWithBirthday = birthdayUserIds.length;

		if (birthdayUserIds.length === 0) {
			console.log('[BIRTHDAY] No users with birthday today');
			return result;
		}

		console.log(`[BIRTHDAY] Found ${birthdayUserIds.length} users with birthday today`);

		// Получаем активные auto_send триггеры для birthday
		const triggers = await getAutoSendTriggers('birthday');

		if (triggers.length === 0) {
			console.log('[BIRTHDAY] No active birthday triggers configured');
			return result;
		}

		console.log(`[BIRTHDAY] Processing ${triggers.length} birthday triggers`);

		for (const trigger of triggers) {
			try {
				result.triggersProcessed++;

				// Для каждого пользователя с ДР
				for (const userId of birthdayUserIds) {
					try {
						// Создаём лог триггера
						const log = await createTriggerLog({
							trigger_id: trigger.id,
							loyalty_user_id: userId,
							event_data: JSON.stringify({ event: 'birthday', date: new Date().toISOString() }),
							status: 'triggered'
						});

						if (dryRun) {
							console.log(`[BIRTHDAY] DRY-RUN: Would send birthday message to user #${userId}`);
							await updateTriggerLogStatus(log.id, 'skipped', undefined, 'Dry run mode');
							continue;
						}

						// Получаем данные пользователя для персонализации
						const user = await getLoyaltyUserById(userId);
						if (!user) {
							await updateTriggerLogStatus(log.id, 'error', undefined, 'User not found');
							continue;
						}

						// Создаём и отправляем кампанию для одного пользователя
						const campaignResult = await createAndSendCampaign(
							{
								title: `День рождения: ${user.first_name || 'Клиент'} (${new Date().toLocaleDateString('ru-RU')})`,
								message_text: trigger.message_template || '🎂 С Днём рождения, {first_name}! Желаем счастья и отличного настроения!',
								message_image: trigger.image_url,
								button_text: trigger.button_text,
								button_url: trigger.button_url,
								target_type: 'segment',
								trigger_type: 'event',
								trigger_config: JSON.stringify({ trigger_id: trigger.id, event_type: 'birthday' })
							},
							{ is_active: true } // Фильтр будет переопределён
						);

						if (campaignResult.success) {
							await updateTriggerLogStatus(log.id, 'campaign_created', campaignResult.campaignId);
							result.messagesSent++;
							console.log(`[BIRTHDAY] Sent birthday message to user #${userId}`);
						} else {
							await updateTriggerLogStatus(log.id, 'error', undefined, campaignResult.error);
							result.errors.push(`User #${userId}: ${campaignResult.error}`);
						}
					} catch (userError) {
						const errorMessage = userError instanceof Error ? userError.message : String(userError);
						console.error(`[BIRTHDAY] Error processing user #${userId}:`, errorMessage);
						result.errors.push(`User #${userId}: ${errorMessage}`);
					}
				}
			} catch (triggerError) {
				const errorMessage = triggerError instanceof Error ? triggerError.message : String(triggerError);
				console.error(`[BIRTHDAY] Error processing trigger #${trigger.id}:`, errorMessage);
				result.errors.push(`Trigger #${trigger.id}: ${errorMessage}`);
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('[BIRTHDAY] Error processing birthday trigger:', errorMessage);
		result.errors.push(`General error: ${errorMessage}`);
	}

	return result;
}
