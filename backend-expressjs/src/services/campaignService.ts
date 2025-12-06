import {
	getCampaignById,
	createCampaign,
	updateCampaign,
	addCampaignRecipients,
	getPendingRecipients,
	updateRecipientStatus,
	updateCampaignStats,
	startCampaignSending,
	completeCampaign,
	getCampaignRecipientsStats
} from '../db/queries/campaigns';
import { getSegmentUserIds, getAllActiveUserIds, type SegmentFilters } from './segmentationService';
import type { NewCampaign, Campaign, LoyaltyUser } from '../db/schema';

// Telegram Bot URL (from environment)
const TELEGRAM_BOT_URL = process.env.TELEGRAM_BOT_URL || 'http://localhost:2017';

/**
 * Персонализация текста сообщения
 */
export function personalizeMessage(
	template: string,
	user: {
		first_name?: string | null;
		last_name?: string | null;
		current_balance?: number;
		card_number?: string | null;
		total_purchases?: number;
	}
): string {
	return template
		.replace(/\{first_name\}/g, user.first_name || 'Друг')
		.replace(/\{last_name\}/g, user.last_name || '')
		.replace(/\{balance\}/g, String(user.current_balance || 0))
		.replace(/\{card_number\}/g, user.card_number || '')
		.replace(/\{total_purchases\}/g, String(user.total_purchases || 0));
}

/**
 * Подготовить кампанию к отправке (выбрать получателей)
 */
export async function prepareCampaign(campaignId: number): Promise<{ success: boolean; recipientsCount: number; error?: string }> {
	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		return { success: false, recipientsCount: 0, error: 'Кампания не найдена' };
	}

	if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
		return { success: false, recipientsCount: 0, error: `Кампания в статусе "${campaign.status}" не может быть подготовлена` };
	}

	// Получаем ID пользователей по фильтрам
	let userIds: number[];

	if (campaign.target_type === 'all') {
		userIds = await getAllActiveUserIds();
	} else {
		const filters: SegmentFilters = campaign.target_filters
			? JSON.parse(campaign.target_filters)
			: {};
		userIds = await getSegmentUserIds(filters);
	}

	if (userIds.length === 0) {
		return { success: false, recipientsCount: 0, error: 'Не найдено получателей по заданным фильтрам' };
	}

	// Добавляем получателей
	await addCampaignRecipients(campaignId, userIds);

	// Обновляем статистику
	await updateCampaignStats(campaignId, { total_recipients: userIds.length });

	return { success: true, recipientsCount: userIds.length };
}

/**
 * Отправить сообщение в Telegram
 */
async function sendTelegramMessage(
	chatId: number,
	text: string,
	imageUrl?: string | null,
	buttonText?: string | null,
	buttonUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
	try {
		const response = await fetch(`${TELEGRAM_BOT_URL}/send-campaign-message`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chatId,
				text,
				imageUrl,
				buttonText,
				buttonUrl
			})
		});

		if (!response.ok) {
			const error = await response.text();
			return { success: false, error };
		}

		return { success: true };
	} catch (error) {
		return { success: false, error: String(error) };
	}
}

/**
 * Отправить batch сообщений
 */
export async function sendCampaignBatch(
	campaignId: number,
	batchSize: number = 25
): Promise<{ sent: number; failed: number; remaining: number }> {
	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		throw new Error('Кампания не найдена');
	}

	// Получаем pending получателей
	const recipients = await getPendingRecipients(campaignId, batchSize);

	let sent = 0;
	let failed = 0;

	for (const recipient of recipients) {
		// Персонализируем сообщение
		const personalizedText = personalizeMessage(campaign.message_text, {
			first_name: recipient.first_name,
			last_name: recipient.last_name,
			current_balance: recipient.current_balance,
			card_number: recipient.card_number,
			total_purchases: recipient.total_purchases
		});

		// Отправляем с rate limiting (35ms между сообщениями)
		await new Promise(resolve => setTimeout(resolve, 35));

		const result = await sendTelegramMessage(
			recipient.chat_id,
			personalizedText,
			campaign.message_image,
			campaign.button_text,
			campaign.button_url
		);

		if (result.success) {
			await updateRecipientStatus(recipient.id, 'delivered');
			sent++;
		} else {
			await updateRecipientStatus(recipient.id, 'failed', result.error);
			failed++;
		}
	}

	// Обновляем статистику кампании
	const stats = await getCampaignRecipientsStats(campaignId);
	await updateCampaignStats(campaignId, {
		sent_count: stats.sent + stats.delivered,
		delivered_count: stats.delivered,
		failed_count: stats.failed
	});

	return {
		sent,
		failed,
		remaining: stats.pending
	};
}

/**
 * Запустить полную отправку кампании
 */
export async function startCampaign(campaignId: number): Promise<{ success: boolean; error?: string }> {
	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		return { success: false, error: 'Кампания не найдена' };
	}

	if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
		return { success: false, error: `Кампания в статусе "${campaign.status}" не может быть запущена` };
	}

	// Подготавливаем получателей если еще не подготовлены
	if (campaign.total_recipients === 0) {
		const prepResult = await prepareCampaign(campaignId);
		if (!prepResult.success) {
			return { success: false, error: prepResult.error };
		}
	}

	// Обновляем статус на sending
	await startCampaignSending(campaignId);

	// Отправляем батчами
	let hasMore = true;
	while (hasMore) {
		const result = await sendCampaignBatch(campaignId, 25);
		hasMore = result.remaining > 0;

		// Небольшая пауза между батчами
		if (hasMore) {
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}

	// Завершаем кампанию
	await completeCampaign(campaignId);

	return { success: true };
}

/**
 * Создать и сразу запустить кампанию
 */
export async function createAndSendCampaign(
	data: NewCampaign,
	filters?: SegmentFilters
): Promise<{ success: boolean; campaignId?: number; error?: string }> {
	// Создаем кампанию
	const campaign = await createCampaign({
		...data,
		target_type: filters ? 'segment' : 'all',
		target_filters: filters ? JSON.stringify(filters) : null,
		trigger_type: 'manual',
		status: 'draft'
	});

	if (!campaign) {
		return { success: false, error: 'Не удалось создать кампанию' };
	}

	// Запускаем
	const result = await startCampaign(campaign.id);

	return {
		success: result.success,
		campaignId: campaign.id,
		error: result.error
	};
}

/**
 * Получить превью аудитории по фильтрам
 */
export async function previewAudience(filters: SegmentFilters): Promise<{ count: number; sample: number[] }> {
	const userIds = await getSegmentUserIds(filters);
	return {
		count: userIds.length,
		sample: userIds.slice(0, 10) // Первые 10 для превью
	};
}

/**
 * Запланировать кампанию
 */
export async function scheduleCampaign(
	campaignId: number,
	scheduledAt: string
): Promise<{ success: boolean; error?: string }> {
	const campaign = await getCampaignById(campaignId);
	if (!campaign) {
		return { success: false, error: 'Кампания не найдена' };
	}

	if (campaign.status !== 'draft') {
		return { success: false, error: 'Только черновики могут быть запланированы' };
	}

	// Подготавливаем получателей
	const prepResult = await prepareCampaign(campaignId);
	if (!prepResult.success) {
		return { success: false, error: prepResult.error };
	}

	// Обновляем статус
	await updateCampaign(campaignId, {
		status: 'scheduled',
		scheduled_at: scheduledAt
	});

	return { success: true };
}
