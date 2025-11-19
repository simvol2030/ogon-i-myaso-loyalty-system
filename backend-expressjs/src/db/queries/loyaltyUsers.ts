import { db } from '../client';
import { loyaltyUsers } from '../schema';
import { eq, desc } from 'drizzle-orm';
import type { NewLoyaltyUser } from '../schema';

/**
 * Получить всех пользователей лояльности
 */
export async function getAllLoyaltyUsers() {
	return await db.select().from(loyaltyUsers).orderBy(desc(loyaltyUsers.registration_date));
}

/**
 * Получить пользователя по ID
 */
export async function getLoyaltyUserById(id: number) {
	const result = await db.select().from(loyaltyUsers).where(eq(loyaltyUsers.id, id)).limit(1);
	return result[0] || null;
}

/**
 * Получить пользователя по Telegram User ID
 */
export async function getLoyaltyUserByTelegramId(telegramUserId: number) {
	const result = await db
		.select()
		.from(loyaltyUsers)
		.where(eq(loyaltyUsers.telegram_user_id, telegramUserId))
		.limit(1);
	return result[0] || null;
}

/**
 * Создать нового пользователя лояльности
 */
export async function createLoyaltyUser(data: NewLoyaltyUser) {
	const result = await db.insert(loyaltyUsers).values(data).returning();
	return result[0];
}

/**
 * ❌ REMOVED: updateLoyaltyUserBalance() - had race condition vulnerability
 * Use atomic SQL updates directly in transactions instead:
 *
 * Example:
 * await db.update(loyaltyUsers)
 *   .set({ current_balance: sql`current_balance + ${delta}` })
 *   .where(eq(loyaltyUsers.id, id));
 */

/**
 * Обновить статистику покупок пользователя
 */
export async function updateLoyaltyUserStats(
	id: number,
	data: {
		total_purchases?: number;
		total_saved?: number;
	}
) {
	const result = await db
		.update(loyaltyUsers)
		.set({
			...data,
			last_activity: new Date().toISOString()
		})
		.where(eq(loyaltyUsers.id, id))
		.returning();

	return result[0] || null;
}

/**
 * Удалить пользователя
 */
export async function deleteLoyaltyUser(id: number) {
	await db.delete(loyaltyUsers).where(eq(loyaltyUsers.id, id));
	return true;
}
