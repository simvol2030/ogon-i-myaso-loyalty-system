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
	const status = (url.searchParams.get('status') || 'all') as 'all' | 'active' | 'inactive';
	const parent = url.searchParams.get('parent') || 'all';

	// Get session cookie to forward to backend
	const sessionCookie = cookies.get('session');
	if (!sessionCookie) {
		throw new Error('Session expired. Please login again.');
	}

	// Fetch categories
	const query = buildQuery({ search, status, parent });
	const response = await fetch(`${API_BASE_URL}/admin/categories?${query}`, {
		headers: {
			Cookie: `session=${sessionCookie}`
		}
	});
	const json = await response.json();

	if (!json.success) {
		throw new Error(json.error || 'Failed to load categories');
	}

	const { categories, total } = json.data;

	return {
		categories,
		total,
		filters: { search, status, parent }
	};
};
