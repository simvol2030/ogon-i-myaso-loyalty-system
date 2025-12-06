import type { PageServerLoad } from './$types';
import { API_BASE_URL } from '$lib/config';

const buildQuery = (params: Record<string, any>): string => {
	const filtered = Object.fromEntries(
		Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
	);
	return new URLSearchParams(filtered as any).toString();
};

export const load: PageServerLoad = async ({ url, fetch, cookies }) => {
	const search = url.searchParams.get('search') || '';
	const status = (url.searchParams.get('status') || 'active') as 'all' | 'active' | 'inactive';
	const category = url.searchParams.get('category') || 'all';
	const page = parseInt(url.searchParams.get('page') || '1');

	// Get session cookie to forward to backend
	const sessionCookie = cookies.get('session');
	if (!sessionCookie) {
		throw new Error('Session expired. Please login again.');
	}

	const headers = { Cookie: `session=${sessionCookie}` };

	// Fetch products, categories (new) and legacy categories in parallel
	const productsQuery = buildQuery({ search, status, category, page, limit: 20 });
	const [productsResponse, categoriesNewResponse, legacyCategoriesResponse] = await Promise.all([
		fetch(`${API_BASE_URL}/admin/products?${productsQuery}`, { headers }),
		fetch(`${API_BASE_URL}/admin/categories`, { headers }),
		fetch(`${API_BASE_URL}/admin/products/categories`, { headers })
	]);

	const productsJson = await productsResponse.json();
	const categoriesNewJson = await categoriesNewResponse.json();
	const legacyCategoriesJson = await legacyCategoriesResponse.json();

	if (!productsJson.success) {
		throw new Error(productsJson.error || 'Failed to load products');
	}

	const { products, pagination } = productsJson.data;
	// New categories from categories table
	const categoriesNew = categoriesNewJson.data?.categories || [];
	// Legacy text categories from products.category field
	const legacyCategories = legacyCategoriesJson.data?.legacyCategories || [];

	return {
		products,
		pagination,
		categories: legacyCategories, // Legacy format for backwards compatibility
		categoriesNew, // New categories from table
		filters: { search, status, category }
	};
};
