import { db } from '$lib/server/db/client';
import { products, categories } from '$lib/server/db/schema';
import { eq, and, like, asc, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Получаем параметры фильтрации из URL
	const categorySlug = url.searchParams.get('category') || 'all';
	const search = url.searchParams.get('search') || '';

	// Загружаем активные категории из таблицы categories
	const allCategories = await db
		.select()
		.from(categories)
		.where(eq(categories.is_active, true))
		.orderBy(asc(categories.position), asc(categories.name));

	// Формируем структуру категорий для UI
	const categoryList = allCategories.map(c => ({
		id: c.id,
		name: c.name,
		slug: c.slug,
		image: c.image
	}));

	// Загружаем товары
	let allProducts = await db
		.select()
		.from(products)
		.where(eq(products.is_active, true))
		.orderBy(asc(products.position), desc(products.id));

	// Фильтрация по категории
	if (categorySlug !== 'all') {
		// Сначала найдём категорию по slug
		const selectedCategory = allCategories.find(c => c.slug === categorySlug);
		if (selectedCategory) {
			// Фильтруем по category_id (новая система)
			allProducts = allProducts.filter(
				(p) => p.category_id === selectedCategory.id || p.category === selectedCategory.name
			);
		} else {
			// Fallback: фильтруем по legacy текстовой категории
			allProducts = allProducts.filter((p) => p.category === categorySlug);
		}
	}

	// Фильтрация по поиску
	if (search) {
		const searchLower = search.toLowerCase();
		allProducts = allProducts.filter((p) => p.name.toLowerCase().includes(searchLower));
	}

	return {
		products: allProducts,
		categories: categoryList,
		// Также передаём legacy категории для обратной совместимости
		legacyCategories: [...new Set(allProducts.map((p) => p.category))].filter(Boolean).sort(),
		filters: {
			category: categorySlug,
			search
		}
	};
};
