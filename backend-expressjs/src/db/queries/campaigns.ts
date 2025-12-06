import { db } from '../client';
import { campaigns, campaignRecipients, loyaltyUsers } from '../schema';
import { eq, desc, and, sql, inArray, count } from 'drizzle-orm';
import type { NewCampaign, Campaign } from '../schema';

/**
 * Получить все кампании с пагинацией
 */
export async function getAllCampaigns(options?: { limit?: number; offset?: number; status?: string }) {
	let query = db.select().from(campaigns).orderBy(desc(campaigns.created_at)).$dynamic();

	if (options?.status) {
		query = query.where(eq(campaigns.status, options.status as Campaign['status']));
	}

	if (options?.limit) {
		query = query.limit(options.limit);
	}

	if (options?.offset) {
		query = query.offset(options.offset);
	}

	return await query;
}

/**
 * Получить общее количество кампаний
 */
export async function getCampaignsCount(status?: string) {
	let query = db.select({ count: count() }).from(campaigns).$dynamic();

	if (status) {
		query = query.where(eq(campaigns.status, status as Campaign['status']));
	}

	const result = await query;
	return result[0]?.count || 0;
}

/**
 * Получить кампанию по ID
 */
export async function getCampaignById(id: number) {
	const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
	return result[0] || null;
}

/**
 * Создать новую кампанию
 */
export async function createCampaign(data: NewCampaign) {
	const result = await db.insert(campaigns).values(data).returning();
	return result[0];
}

/**
 * Обновить кампанию
 */
export async function updateCampaign(id: number, data: Partial<NewCampaign>) {
	const result = await db
		.update(campaigns)
		.set({
			...data,
			updated_at: new Date().toISOString()
		})
		.where(eq(campaigns.id, id))
		.returning();

	return result[0] || null;
}

/**
 * Удалить кампанию
 */
export async function deleteCampaign(id: number) {
	await db.delete(campaigns).where(eq(campaigns.id, id));
	return true;
}

/**
 * Получить кампании со статусом 'scheduled' для отправки
 */
export async function getScheduledCampaignsToSend() {
	const now = new Date().toISOString();
	return await db
		.select()
		.from(campaigns)
		.where(
			and(
				eq(campaigns.status, 'scheduled'),
				sql`${campaigns.scheduled_at} <= ${now}`
			)
		);
}

/**
 * Обновить статистику кампании
 */
export async function updateCampaignStats(
	id: number,
	stats: {
		total_recipients?: number;
		sent_count?: number;
		delivered_count?: number;
		failed_count?: number;
	}
) {
	const result = await db
		.update(campaigns)
		.set({
			...stats,
			updated_at: new Date().toISOString()
		})
		.where(eq(campaigns.id, id))
		.returning();

	return result[0] || null;
}

/**
 * Начать отправку кампании
 */
export async function startCampaignSending(id: number) {
	const result = await db
		.update(campaigns)
		.set({
			status: 'sending',
			started_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.where(eq(campaigns.id, id))
		.returning();

	return result[0] || null;
}

/**
 * Завершить кампанию
 */
export async function completeCampaign(id: number) {
	const result = await db
		.update(campaigns)
		.set({
			status: 'completed',
			completed_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.where(eq(campaigns.id, id))
		.returning();

	return result[0] || null;
}

/**
 * Отменить кампанию
 */
export async function cancelCampaign(id: number) {
	const result = await db
		.update(campaigns)
		.set({
			status: 'cancelled',
			updated_at: new Date().toISOString()
		})
		.where(eq(campaigns.id, id))
		.returning();

	return result[0] || null;
}

// ==================== Campaign Recipients ====================

/**
 * Добавить получателей в кампанию
 */
export async function addCampaignRecipients(campaignId: number, userIds: number[]) {
	if (userIds.length === 0) return [];

	const values = userIds.map((userId) => ({
		campaign_id: campaignId,
		loyalty_user_id: userId,
		status: 'pending' as const
	}));

	return await db.insert(campaignRecipients).values(values).returning();
}

/**
 * Получить получателей кампании
 */
export async function getCampaignRecipients(
	campaignId: number,
	options?: { status?: string; limit?: number; offset?: number }
) {
	let query = db
		.select({
			id: campaignRecipients.id,
			campaign_id: campaignRecipients.campaign_id,
			loyalty_user_id: campaignRecipients.loyalty_user_id,
			status: campaignRecipients.status,
			sent_at: campaignRecipients.sent_at,
			error_message: campaignRecipients.error_message,
			user_first_name: loyaltyUsers.first_name,
			user_last_name: loyaltyUsers.last_name,
			user_chat_id: loyaltyUsers.chat_id
		})
		.from(campaignRecipients)
		.leftJoin(loyaltyUsers, eq(campaignRecipients.loyalty_user_id, loyaltyUsers.id))
		.where(eq(campaignRecipients.campaign_id, campaignId))
		.$dynamic();

	if (options?.status) {
		query = query.where(
			and(
				eq(campaignRecipients.campaign_id, campaignId),
				eq(campaignRecipients.status, options.status as 'pending' | 'sent' | 'delivered' | 'failed')
			)
		);
	}

	if (options?.limit) {
		query = query.limit(options.limit);
	}

	if (options?.offset) {
		query = query.offset(options.offset);
	}

	return await query;
}

/**
 * Получить pending получателей для отправки
 */
export async function getPendingRecipients(campaignId: number, limit: number = 50) {
	return await db
		.select({
			id: campaignRecipients.id,
			loyalty_user_id: campaignRecipients.loyalty_user_id,
			chat_id: loyaltyUsers.chat_id,
			first_name: loyaltyUsers.first_name,
			last_name: loyaltyUsers.last_name,
			current_balance: loyaltyUsers.current_balance,
			card_number: loyaltyUsers.card_number,
			total_purchases: loyaltyUsers.total_purchases
		})
		.from(campaignRecipients)
		.innerJoin(loyaltyUsers, eq(campaignRecipients.loyalty_user_id, loyaltyUsers.id))
		.where(
			and(
				eq(campaignRecipients.campaign_id, campaignId),
				eq(campaignRecipients.status, 'pending')
			)
		)
		.limit(limit);
}

/**
 * Обновить статус получателя
 */
export async function updateRecipientStatus(
	recipientId: number,
	status: 'sent' | 'delivered' | 'failed',
	errorMessage?: string
) {
	const result = await db
		.update(campaignRecipients)
		.set({
			status,
			sent_at: status === 'sent' || status === 'delivered' ? new Date().toISOString() : undefined,
			error_message: errorMessage
		})
		.where(eq(campaignRecipients.id, recipientId))
		.returning();

	return result[0] || null;
}

/**
 * Обновить статусы нескольких получателей
 */
export async function updateRecipientsStatus(
	recipientIds: number[],
	status: 'sent' | 'delivered' | 'failed'
) {
	if (recipientIds.length === 0) return;

	await db
		.update(campaignRecipients)
		.set({
			status,
			sent_at: status === 'sent' || status === 'delivered' ? new Date().toISOString() : undefined
		})
		.where(inArray(campaignRecipients.id, recipientIds));
}

/**
 * Получить статистику получателей кампании
 */
export async function getCampaignRecipientsStats(campaignId: number) {
	const result = await db
		.select({
			status: campaignRecipients.status,
			count: count()
		})
		.from(campaignRecipients)
		.where(eq(campaignRecipients.campaign_id, campaignId))
		.groupBy(campaignRecipients.status);

	const stats = {
		total: 0,
		pending: 0,
		sent: 0,
		delivered: 0,
		failed: 0
	};

	for (const row of result) {
		stats[row.status as keyof typeof stats] = row.count;
		stats.total += row.count;
	}

	return stats;
}
