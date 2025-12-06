import { db } from '../client';
import { triggerTemplates, triggerLogs, campaigns, loyaltyUsers } from '../schema';
import { eq, desc, and, count } from 'drizzle-orm';
import type { NewTriggerTemplate, TriggerTemplate, NewTriggerLog } from '../schema';

// ==================== Trigger Templates ====================

/**
 * Получить все шаблоны триггеров
 */
export async function getAllTriggerTemplates(options?: { isActive?: boolean }) {
	let query = db.select().from(triggerTemplates).orderBy(desc(triggerTemplates.created_at)).$dynamic();

	if (options?.isActive !== undefined) {
		query = query.where(eq(triggerTemplates.is_active, options.isActive));
	}

	return await query;
}

/**
 * Получить шаблон триггера по ID
 */
export async function getTriggerTemplateById(id: number) {
	const result = await db.select().from(triggerTemplates).where(eq(triggerTemplates.id, id)).limit(1);
	return result[0] || null;
}

/**
 * Получить триггеры по типу события
 */
export async function getTriggersByEventType(eventType: TriggerTemplate['event_type'], activeOnly: boolean = true) {
	let query = db.select().from(triggerTemplates).where(eq(triggerTemplates.event_type, eventType)).$dynamic();

	if (activeOnly) {
		query = query.where(
			and(
				eq(triggerTemplates.event_type, eventType),
				eq(triggerTemplates.is_active, true)
			)
		);
	}

	return await query;
}

/**
 * Создать новый шаблон триггера
 */
export async function createTriggerTemplate(data: NewTriggerTemplate) {
	const result = await db.insert(triggerTemplates).values(data).returning();
	return result[0];
}

/**
 * Обновить шаблон триггера
 */
export async function updateTriggerTemplate(id: number, data: Partial<NewTriggerTemplate>) {
	const result = await db
		.update(triggerTemplates)
		.set({
			...data,
			updated_at: new Date().toISOString()
		})
		.where(eq(triggerTemplates.id, id))
		.returning();

	return result[0] || null;
}

/**
 * Удалить шаблон триггера
 */
export async function deleteTriggerTemplate(id: number) {
	await db.delete(triggerTemplates).where(eq(triggerTemplates.id, id));
	return true;
}

/**
 * Включить/выключить триггер
 */
export async function toggleTriggerTemplate(id: number, isActive: boolean) {
	const result = await db
		.update(triggerTemplates)
		.set({
			is_active: isActive,
			updated_at: new Date().toISOString()
		})
		.where(eq(triggerTemplates.id, id))
		.returning();

	return result[0] || null;
}

/**
 * Получить активные триггеры с auto_send для обработки событий
 */
export async function getAutoSendTriggers(eventType?: TriggerTemplate['event_type']) {
	let query = db
		.select()
		.from(triggerTemplates)
		.where(
			and(
				eq(triggerTemplates.is_active, true),
				eq(triggerTemplates.auto_send, true)
			)
		)
		.$dynamic();

	if (eventType) {
		query = query.where(
			and(
				eq(triggerTemplates.is_active, true),
				eq(triggerTemplates.auto_send, true),
				eq(triggerTemplates.event_type, eventType)
			)
		);
	}

	return await query;
}

// ==================== Trigger Logs ====================

/**
 * Создать лог срабатывания триггера
 */
export async function createTriggerLog(data: NewTriggerLog) {
	const result = await db.insert(triggerLogs).values(data).returning();
	return result[0];
}

/**
 * Получить логи триггера
 */
export async function getTriggerLogs(triggerId: number, options?: { limit?: number; offset?: number }) {
	let query = db
		.select({
			id: triggerLogs.id,
			trigger_id: triggerLogs.trigger_id,
			campaign_id: triggerLogs.campaign_id,
			loyalty_user_id: triggerLogs.loyalty_user_id,
			event_data: triggerLogs.event_data,
			status: triggerLogs.status,
			error_message: triggerLogs.error_message,
			created_at: triggerLogs.created_at,
			user_first_name: loyaltyUsers.first_name,
			user_last_name: loyaltyUsers.last_name
		})
		.from(triggerLogs)
		.leftJoin(loyaltyUsers, eq(triggerLogs.loyalty_user_id, loyaltyUsers.id))
		.where(eq(triggerLogs.trigger_id, triggerId))
		.orderBy(desc(triggerLogs.created_at))
		.$dynamic();

	if (options?.limit) {
		query = query.limit(options.limit);
	}

	if (options?.offset) {
		query = query.offset(options.offset);
	}

	return await query;
}

/**
 * Получить статистику логов триггера
 */
export async function getTriggerLogsStats(triggerId: number) {
	const result = await db
		.select({
			status: triggerLogs.status,
			count: count()
		})
		.from(triggerLogs)
		.where(eq(triggerLogs.trigger_id, triggerId))
		.groupBy(triggerLogs.status);

	const stats = {
		total: 0,
		triggered: 0,
		campaign_created: 0,
		skipped: 0,
		error: 0
	};

	for (const row of result) {
		stats[row.status as keyof typeof stats] = row.count;
		stats.total += row.count;
	}

	return stats;
}

/**
 * Обновить статус лога триггера
 */
export async function updateTriggerLogStatus(
	logId: number,
	status: 'triggered' | 'campaign_created' | 'skipped' | 'error',
	campaignId?: number,
	errorMessage?: string
) {
	const result = await db
		.update(triggerLogs)
		.set({
			status,
			campaign_id: campaignId,
			error_message: errorMessage
		})
		.where(eq(triggerLogs.id, logId))
		.returning();

	return result[0] || null;
}
