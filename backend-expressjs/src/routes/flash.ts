/**
 * Flash Screens API Routes
 * TV-меню слайды для кафе
 *
 * GET /api/flash/:screen - получить слайды для экрана (1 или 2)
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { products, categories } from '../db/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';

const router = Router();

// Типы слайдов
interface ProductItem {
	id: number;
	name: string;
	price: number;
	oldPrice: number | null;
	image: string;
	quantityInfo: string | null;
	description: string | null;
}

interface Slide {
	type: 'products' | 'sets' | 'combo';
	category: string;
	categoryId: number;
	items: ProductItem[];
	setItem?: ProductItem; // Для combo layout
}

interface FlashResponse {
	slides: Slide[];
	config: {
		interval: number;
		transition: string;
		screen: number;
	};
}

// Конфигурация экранов
const FLASH_1_CATEGORY_IDS = [5, 6, 7]; // Шашлык, Кебаб, Сеты
const FLASH_2_CATEGORY_IDS = [3, 4, 8, 9, 13, 11, 1, 10, 12, 2, 14]; // Остальное меню
const SETS_CATEGORY_ID = 7;

const ITEMS_PER_SLIDE = 18; // 6x3 grid
const SETS_PER_SLIDE = 3;
const COMBO_PRODUCTS_COUNT = 9; // 3x3 grid для combo layout

// Форматирование продукта
function formatProduct(p: typeof products.$inferSelect): ProductItem {
	return {
		id: p.id,
		name: p.name,
		price: p.price,
		oldPrice: p.old_price,
		image: p.image,
		quantityInfo: p.quantity_info,
		description: p.description
	};
}

// Генерация слайдов для обычных товаров (6x3)
function generateProductSlides(items: ProductItem[], categoryName: string, categoryId: number): Slide[] {
	const slides: Slide[] = [];

	for (let i = 0; i < items.length; i += ITEMS_PER_SLIDE) {
		slides.push({
			type: 'products',
			category: categoryName,
			categoryId,
			items: items.slice(i, i + ITEMS_PER_SLIDE)
		});
	}

	return slides;
}

// Генерация слайдов для сетов (3 на слайд)
function generateSetSlides(items: ProductItem[], categoryName: string, categoryId: number): {
	slides: Slide[];
	orphans: ProductItem[];
} {
	const slides: Slide[] = [];
	const orphans: ProductItem[] = [];

	const fullSlideCount = Math.floor(items.length / SETS_PER_SLIDE);

	for (let i = 0; i < fullSlideCount; i++) {
		slides.push({
			type: 'sets',
			category: categoryName,
			categoryId,
			items: items.slice(i * SETS_PER_SLIDE, (i + 1) * SETS_PER_SLIDE)
		});
	}

	// Остаток - orphans для combo
	const remainder = items.length % SETS_PER_SLIDE;
	if (remainder > 0) {
		orphans.push(...items.slice(fullSlideCount * SETS_PER_SLIDE));
	}

	return { slides, orphans };
}

// ==================== GET /api/flash/:screen ====================
router.get('/:screen', async (req: Request, res: Response) => {
	try {
		const screenNum = parseInt(req.params.screen);

		if (screenNum !== 1 && screenNum !== 2) {
			return res.status(400).json({
				error: 'Invalid screen number. Use 1 or 2.'
			});
		}

		const categoryIds = screenNum === 1 ? FLASH_1_CATEGORY_IDS : FLASH_2_CATEGORY_IDS;

		// Получаем категории
		const categoryList = await db
			.select()
			.from(categories)
			.where(
				and(
					eq(categories.is_active, true),
					inArray(categories.id, categoryIds)
				)
			)
			.orderBy(asc(categories.position));

		// Создаём map категорий для быстрого доступа
		const categoryMap = new Map(categoryList.map(c => [c.id, c]));

		// Получаем все продукты для указанных категорий
		const productList = await db
			.select()
			.from(products)
			.where(
				and(
					eq(products.is_active, true),
					inArray(products.category_id, categoryIds)
				)
			)
			.orderBy(asc(products.position));

		// Группируем продукты по категориям
		const productsByCategory = new Map<number, ProductItem[]>();
		for (const p of productList) {
			if (!p.category_id) continue;
			if (!productsByCategory.has(p.category_id)) {
				productsByCategory.set(p.category_id, []);
			}
			productsByCategory.get(p.category_id)!.push(formatProduct(p));
		}

		const slides: Slide[] = [];

		if (screenNum === 1) {
			// Flash-1: Сначала сеты, потом остальное
			const setsCategory = categoryMap.get(SETS_CATEGORY_ID);
			const setsProducts = productsByCategory.get(SETS_CATEGORY_ID) || [];

			if (setsCategory && setsProducts.length > 0) {
				const { slides: setSlides, orphans } = generateSetSlides(
					setsProducts,
					setsCategory.name,
					SETS_CATEGORY_ID
				);
				slides.push(...setSlides);

				// Если есть orphan сеты, создаём combo слайды
				if (orphans.length > 0) {
					// Получаем продукты из других категорий для combo
					const otherCategoryIds = FLASH_1_CATEGORY_IDS.filter(id => id !== SETS_CATEGORY_ID);
					let comboProducts: ProductItem[] = [];

					for (const catId of otherCategoryIds) {
						const catProducts = productsByCategory.get(catId) || [];
						comboProducts.push(...catProducts);
					}

					// Создаём combo слайды для каждого orphan сета
					for (const orphanSet of orphans) {
						const comboItems = comboProducts.splice(0, COMBO_PRODUCTS_COUNT);
						if (comboItems.length > 0) {
							const otherCategory = categoryMap.get(otherCategoryIds[0]);
							slides.push({
								type: 'combo',
								category: otherCategory?.name || 'Мангал',
								categoryId: SETS_CATEGORY_ID,
								items: comboItems,
								setItem: orphanSet
							});
						} else {
							// Если нет продуктов для combo, добавляем сет как отдельный слайд
							slides.push({
								type: 'sets',
								category: setsCategory.name,
								categoryId: SETS_CATEGORY_ID,
								items: [orphanSet]
							});
						}
					}

					// Добавляем оставшиеся продукты из других категорий
					for (const catId of otherCategoryIds) {
						const category = categoryMap.get(catId);
						// Продукты уже частично использованы в combo, берём остаток
						const remainingProducts = productsByCategory.get(catId) || [];
						// Фильтруем использованные
						const usedIds = slides
							.filter(s => s.type === 'combo')
							.flatMap(s => s.items.map(i => i.id));

						const unusedProducts = remainingProducts.filter(p => !usedIds.includes(p.id));

						if (category && unusedProducts.length > 0) {
							slides.push(...generateProductSlides(unusedProducts, category.name, catId));
						}
					}
				} else {
					// Нет orphans, добавляем остальные категории как обычные слайды
					for (const catId of FLASH_1_CATEGORY_IDS) {
						if (catId === SETS_CATEGORY_ID) continue;
						const category = categoryMap.get(catId);
						const catProducts = productsByCategory.get(catId) || [];
						if (category && catProducts.length > 0) {
							slides.push(...generateProductSlides(catProducts, category.name, catId));
						}
					}
				}
			} else {
				// Нет сетов, просто добавляем все категории
				for (const catId of FLASH_1_CATEGORY_IDS) {
					const category = categoryMap.get(catId);
					const catProducts = productsByCategory.get(catId) || [];
					if (category && catProducts.length > 0) {
						slides.push(...generateProductSlides(catProducts, category.name, catId));
					}
				}
			}
		} else {
			// Flash-2: Просто все категории по порядку
			for (const catId of FLASH_2_CATEGORY_IDS) {
				const category = categoryMap.get(catId);
				const catProducts = productsByCategory.get(catId) || [];
				if (category && catProducts.length > 0) {
					slides.push(...generateProductSlides(catProducts, category.name, catId));
				}
			}
		}

		const response: FlashResponse = {
			slides,
			config: {
				interval: 15000, // 15 секунд
				transition: 'fade',
				screen: screenNum
			}
		};

		return res.json(response);

	} catch (error) {
		console.error('[FLASH API] Error:', error);
		return res.status(500).json({
			error: 'Internal server error',
			details: process.env.NODE_ENV === 'development' ? String(error) : undefined
		});
	}
});

export default router;
