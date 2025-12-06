import { db } from '../db/client';
import { loyaltyUsers } from '../db/schema';
import { and, eq, gte, lte, sql, like, isNotNull } from 'drizzle-orm';

/**
 * Фильтры для сегментации пользователей
 */
export interface SegmentFilters {
	store_ids?: number[];
	balance_min?: number;
	balance_max?: number;
	inactive_days?: number;
	active_last_days?: number;
	registration_after?: string;
	registration_before?: string;
	total_purchases_min?: number;
	total_purchases_max?: number;
	has_birthday?: boolean;
	birthday_month?: number;
	is_active?: boolean;
}

/**
 * Построить WHERE условие из фильтров
 */
function buildWhereConditions(filters: SegmentFilters) {
	const conditions: ReturnType<typeof eq>[] = [];

	// По магазинам
	if (filters.store_ids && filters.store_ids.length > 0) {
		conditions.push(
			sql`${loyaltyUsers.store_id} IN (${sql.join(filters.store_ids.map(id => sql`${id}`), sql`, `)})`
		);
	}

	// По балансу
	if (filters.balance_min !== undefined) {
		conditions.push(gte(loyaltyUsers.current_balance, filters.balance_min));
	}
	if (filters.balance_max !== undefined) {
		conditions.push(lte(loyaltyUsers.current_balance, filters.balance_max));
	}

	// По неактивности (дней без активности)
	if (filters.inactive_days !== undefined) {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - filters.inactive_days);
		conditions.push(
			sql`${loyaltyUsers.last_activity} < ${cutoffDate.toISOString()}`
		);
	}

	// По недавней активности
	if (filters.active_last_days !== undefined) {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - filters.active_last_days);
		conditions.push(
			sql`${loyaltyUsers.last_activity} >= ${cutoffDate.toISOString()}`
		);
	}

	// По дате регистрации
	if (filters.registration_after) {
		conditions.push(
			sql`${loyaltyUsers.registration_date} >= ${filters.registration_after}`
		);
	}
	if (filters.registration_before) {
		conditions.push(
			sql`${loyaltyUsers.registration_date} <= ${filters.registration_before}`
		);
	}

	// По количеству покупок
	if (filters.total_purchases_min !== undefined) {
		conditions.push(gte(loyaltyUsers.total_purchases, filters.total_purchases_min));
	}
	if (filters.total_purchases_max !== undefined) {
		conditions.push(lte(loyaltyUsers.total_purchases, filters.total_purchases_max));
	}

	// По наличию дня рождения
	if (filters.has_birthday) {
		conditions.push(isNotNull(loyaltyUsers.birthday));
	}

	// По месяцу дня рождения (формат MM-DD)
	if (filters.birthday_month !== undefined) {
		const monthStr = filters.birthday_month.toString().padStart(2, '0');
		conditions.push(like(loyaltyUsers.birthday, `${monthStr}-%`));
	}

	// По активности аккаунта
	if (filters.is_active !== undefined) {
		conditions.push(eq(loyaltyUsers.is_active, filters.is_active));
	}

	return conditions;
}

/**
 * Получить пользователей по фильтрам сегмента
 */
export async function getSegmentUsers(filters: SegmentFilters) {
	const conditions = buildWhereConditions(filters);

	// Добавляем обязательное условие: chat_id должен быть
	conditions.push(sql`${loyaltyUsers.chat_id} IS NOT NULL`);
	conditions.push(sql`${loyaltyUsers.chat_id} != 0`);

	if (conditions.length === 0) {
		return await db.select().from(loyaltyUsers);
	}

	return await db
		.select()
		.from(loyaltyUsers)
		.where(and(...conditions));
}

/**
 * Получить только ID пользователей по фильтрам
 */
export async function getSegmentUserIds(filters: SegmentFilters): Promise<number[]> {
	const conditions = buildWhereConditions(filters);

	// Добавляем обязательное условие: chat_id должен быть
	conditions.push(sql`${loyaltyUsers.chat_id} IS NOT NULL`);
	conditions.push(sql`${loyaltyUsers.chat_id} != 0`);

	let query = db.select({ id: loyaltyUsers.id }).from(loyaltyUsers).$dynamic();

	if (conditions.length > 0) {
		query = query.where(and(...conditions));
	}

	const result = await query;
	return result.map(row => row.id);
}

/**
 * Получить количество пользователей по фильтрам (для превью)
 */
export async function getSegmentCount(filters: SegmentFilters): Promise<number> {
	const conditions = buildWhereConditions(filters);

	// Добавляем обязательное условие: chat_id должен быть
	conditions.push(sql`${loyaltyUsers.chat_id} IS NOT NULL`);
	conditions.push(sql`${loyaltyUsers.chat_id} != 0`);

	let query = db
		.select({ count: sql<number>`COUNT(*)` })
		.from(loyaltyUsers)
		.$dynamic();

	if (conditions.length > 0) {
		query = query.where(and(...conditions));
	}

	const result = await query;
	return result[0]?.count || 0;
}

/**
 * Получить пользователей с днём рождения сегодня
 */
export async function getUsersWithBirthdayToday(): Promise<number[]> {
	const today = new Date();
	const monthDay = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

	const result = await db
		.select({ id: loyaltyUsers.id })
		.from(loyaltyUsers)
		.where(
			and(
				eq(loyaltyUsers.birthday, monthDay),
				eq(loyaltyUsers.is_active, true),
				sql`${loyaltyUsers.chat_id} IS NOT NULL`,
				sql`${loyaltyUsers.chat_id} != 0`
			)
		);

	return result.map(row => row.id);
}

/**
 * Получить неактивных пользователей (N дней без активности)
 */
export async function getInactiveUsers(days: number): Promise<number[]> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - days);

	const result = await db
		.select({ id: loyaltyUsers.id })
		.from(loyaltyUsers)
		.where(
			and(
				sql`${loyaltyUsers.last_activity} < ${cutoffDate.toISOString()}`,
				eq(loyaltyUsers.is_active, true),
				sql`${loyaltyUsers.chat_id} IS NOT NULL`,
				sql`${loyaltyUsers.chat_id} != 0`
			)
		);

	return result.map(row => row.id);
}

/**
 * Получить пользователей с балансом выше порога
 */
export async function getUsersWithBalanceAbove(minBalance: number): Promise<number[]> {
	const result = await db
		.select({ id: loyaltyUsers.id })
		.from(loyaltyUsers)
		.where(
			and(
				gte(loyaltyUsers.current_balance, minBalance),
				eq(loyaltyUsers.is_active, true),
				sql`${loyaltyUsers.chat_id} IS NOT NULL`,
				sql`${loyaltyUsers.chat_id} != 0`
			)
		);

	return result.map(row => row.id);
}

/**
 * Получить пользователей с балансом ниже порога
 */
export async function getUsersWithBalanceBelow(maxBalance: number): Promise<number[]> {
	const result = await db
		.select({ id: loyaltyUsers.id })
		.from(loyaltyUsers)
		.where(
			and(
				lte(loyaltyUsers.current_balance, maxBalance),
				eq(loyaltyUsers.is_active, true),
				sql`${loyaltyUsers.chat_id} IS NOT NULL`,
				sql`${loyaltyUsers.chat_id} != 0`
			)
		);

	return result.map(row => row.id);
}

/**
 * Получить всех активных пользователей
 */
export async function getAllActiveUserIds(): Promise<number[]> {
	const result = await db
		.select({ id: loyaltyUsers.id })
		.from(loyaltyUsers)
		.where(
			and(
				eq(loyaltyUsers.is_active, true),
				sql`${loyaltyUsers.chat_id} IS NOT NULL`,
				sql`${loyaltyUsers.chat_id} != 0`
			)
		);

	return result.map(row => row.id);
}
