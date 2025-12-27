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
	title: string;           // Объединённый заголовок ("САЛАТЫ • СУПЫ")
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

// Группы категорий
interface CategoryGroup {
	id: string;
	title: string;
	categoryIds: number[];
	layout: 'products' | 'sets';
}

// Flash-1: Мангал
const FLASH1_GROUPS: CategoryGroup[] = [
	{
		id: 'sets',
		title: 'СЕТЫ',
		categoryIds: [7],      // Сеты
		layout: 'sets'         // 3 на слайд
	},
	{
		id: 'grill',
		title: 'ШАШЛЫК • КЕБАБ',
		categoryIds: [5, 6],   // Шашлык, Кебаб
		layout: 'products'     // 6×2 сетка
	}
];

// Flash-2: Остальное меню
const FLASH2_GROUPS: CategoryGroup[] = [
	{
		id: 'first-courses',
		title: 'САЛАТЫ • СУПЫ',
		categoryIds: [3, 4],   // Салаты, Супы
		layout: 'products'
	},
	{
		id: 'main-courses',
		title: 'ВТОРЫЕ БЛЮДА • ГАРНИРЫ',
		categoryIds: [8, 9],   // Вторые блюда, Гарниры
		layout: 'products'
	},
	{
		id: 'georgian',
		title: 'ХИНКАЛИ • ХАЧАПУРИ',
		categoryIds: [1, 10],  // Хинкали, Хачапури
		layout: 'products'
	},
	{
		id: 'fastfood',
		title: 'ПИЦЦА • ШАУРМА',
		categoryIds: [11, 12], // Пицца, Шаурма
		layout: 'products'
	},
	{
		id: 'bakery',
		title: 'ВЫПЕЧКА',
		categoryIds: [13],     // Выпечка
		layout: 'products'
	},
	{
		id: 'extras',
		title: 'СОУСЫ • НАПИТКИ',
		categoryIds: [2, 14],  // Соусы, Напитки
		layout: 'products'
	}
];

const ITEMS_PER_SLIDE = 12; // 6x2 grid (changed from 18)
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

// Генерация слайдов для группы категорий
function generateSlidesForGroup(group: CategoryGroup, groupProducts: ProductItem[]): Slide[] {
	const slides: Slide[] = [];

	if (groupProducts.length === 0) {
		return slides;
	}

	if (group.layout === 'sets') {
		// Сеты: по 3 на слайд
		for (let i = 0; i < groupProducts.length; i += SETS_PER_SLIDE) {
			slides.push({
				type: 'sets',
				title: group.title,
				items: groupProducts.slice(i, i + SETS_PER_SLIDE)
			});
		}
	} else {
		// Товары: по 12 на слайд (6×2)
		for (let i = 0; i < groupProducts.length; i += ITEMS_PER_SLIDE) {
			slides.push({
				type: 'products',
				title: group.title,
				items: groupProducts.slice(i, i + ITEMS_PER_SLIDE)
			});
		}
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

		const groups = screenNum === 1 ? FLASH1_GROUPS : FLASH2_GROUPS;

		// Собираем все ID категорий из групп
		const allCategoryIds = groups.flatMap(g => g.categoryIds);

		// Получаем все продукты для указанных категорий
		const productList = await db
			.select()
			.from(products)
			.where(
				and(
					eq(products.is_active, true),
					inArray(products.category_id, allCategoryIds)
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

		// Генерируем слайды для каждой группы
		for (const group of groups) {
			// Собираем все продукты из категорий группы
			const groupProducts: ProductItem[] = [];
			for (const catId of group.categoryIds) {
				const catProducts = productsByCategory.get(catId) || [];
				groupProducts.push(...catProducts);
			}

			// Генерируем слайды для группы
			const groupSlides = generateSlidesForGroup(group, groupProducts);
			slides.push(...groupSlides);
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
