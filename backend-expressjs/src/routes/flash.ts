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
	type: 'products' | 'sets';
	title: string;
	items: ProductItem[];
}

interface FlashResponse {
	slides: Slide[];
	config: {
		interval: number;
		transition: string;
		screen: number;
	};
}

// Конфигурация категорий (без группировки!)
interface CategoryConfig {
	id: number;
	layout: 'products' | 'sets';
}

// Flash-1: Мангал (каждая категория отдельно)
const FLASH1_CATEGORIES: CategoryConfig[] = [
	{ id: 7, layout: 'sets' },     // Сеты
	{ id: 5, layout: 'products' }, // Шашлык
	{ id: 6, layout: 'products' }, // Кебаб
];

// Flash-2: Остальное меню (каждая категория отдельно)
const FLASH2_CATEGORIES: CategoryConfig[] = [
	{ id: 3, layout: 'products' },  // Салаты
	{ id: 4, layout: 'products' },  // Супы
	{ id: 8, layout: 'products' },  // Вторые блюда
	{ id: 9, layout: 'products' },  // Гарниры
	{ id: 1, layout: 'products' },  // Хинкали
	{ id: 10, layout: 'products' }, // Хачапури
	{ id: 11, layout: 'products' }, // Пицца
	{ id: 12, layout: 'products' }, // Шаурма
	{ id: 13, layout: 'products' }, // Выпечка
	{ id: 2, layout: 'products' },  // Соусы
	{ id: 14, layout: 'products' }, // Напитки
];

const ITEMS_PER_SLIDE = 16; // Увеличено: 8x2 для TV 1920px
const SETS_PER_SLIDE = 3;

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

// Генерация слайдов для категории
function generateSlidesForCategory(
	categoryName: string,
	layout: 'products' | 'sets',
	categoryProducts: ProductItem[]
): Slide[] {
	const slides: Slide[] = [];

	if (categoryProducts.length === 0) {
		return slides;
	}

	const title = categoryName.toUpperCase();
	const itemsPerSlide = layout === 'sets' ? SETS_PER_SLIDE : ITEMS_PER_SLIDE;
	const slideType = layout;

	for (let i = 0; i < categoryProducts.length; i += itemsPerSlide) {
		slides.push({
			type: slideType,
			title: title,
			items: categoryProducts.slice(i, i + itemsPerSlide)
		});
	}

	return slides;
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

		const categoryConfigs = screenNum === 1 ? FLASH1_CATEGORIES : FLASH2_CATEGORIES;
		const categoryIds = categoryConfigs.map(c => c.id);

		// Получаем названия категорий
		const categoryList = await db
			.select()
			.from(categories)
			.where(inArray(categories.id, categoryIds));

		const categoryNames = new Map<number, string>();
		for (const cat of categoryList) {
			categoryNames.set(cat.id, cat.name);
		}

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

		// Генерируем слайды для каждой категории (без группировки!)
		for (const config of categoryConfigs) {
			const categoryName = categoryNames.get(config.id) || `Категория ${config.id}`;
			const categoryProducts = productsByCategory.get(config.id) || [];

			const categorySlides = generateSlidesForCategory(
				categoryName,
				config.layout,
				categoryProducts
			);
			slides.push(...categorySlides);
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
