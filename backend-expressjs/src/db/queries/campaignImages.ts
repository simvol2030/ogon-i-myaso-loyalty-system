import { db } from '../client';
import { campaignImages } from '../schema';
import { eq, desc } from 'drizzle-orm';
import type { NewCampaignImage } from '../schema';

/**
 * Получить все изображения кампаний
 */
export async function getAllCampaignImages(options?: { limit?: number; offset?: number }) {
	let query = db.select().from(campaignImages).orderBy(desc(campaignImages.created_at)).$dynamic();

	if (options?.limit) {
		query = query.limit(options.limit);
	}

	if (options?.offset) {
		query = query.offset(options.offset);
	}

	return await query;
}

/**
 * Получить изображение по ID
 */
export async function getCampaignImageById(id: number) {
	const result = await db.select().from(campaignImages).where(eq(campaignImages.id, id)).limit(1);
	return result[0] || null;
}

/**
 * Получить изображение по имени файла
 */
export async function getCampaignImageByFilename(filename: string) {
	const result = await db.select().from(campaignImages).where(eq(campaignImages.filename, filename)).limit(1);
	return result[0] || null;
}

/**
 * Создать запись об изображении
 */
export async function createCampaignImage(data: NewCampaignImage) {
	const result = await db.insert(campaignImages).values(data).returning();
	return result[0];
}

/**
 * Удалить изображение
 */
export async function deleteCampaignImage(id: number) {
	const image = await getCampaignImageById(id);
	if (!image) return null;

	await db.delete(campaignImages).where(eq(campaignImages.id, id));
	return image;
}
