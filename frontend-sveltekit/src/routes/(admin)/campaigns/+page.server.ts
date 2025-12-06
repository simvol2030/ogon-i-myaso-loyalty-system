import type { PageServerLoad } from './$types';
import { API_BASE_URL } from '$lib/config';

export const load: PageServerLoad = async ({ url, fetch, cookies }) => {
	const status = url.searchParams.get('status') || '';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '20');

	// Get session cookie to forward to backend
	const sessionCookie = cookies.get('session');
	if (!sessionCookie) {
		throw new Error('Session expired. Please login again.');
	}

	// Build query
	const query = new URLSearchParams();
	if (status) query.set('status', status);
	query.set('page', String(page));
	query.set('limit', String(limit));

	const response = await fetch(`${API_BASE_URL}/admin/campaigns?${query}`, {
		headers: {
			Cookie: `session=${sessionCookie}`
		}
	});

	const json = await response.json();

	if (!json.success) {
		throw new Error(json.error || 'Failed to load campaigns');
	}

	const { campaigns, pagination } = json.data;

	return {
		campaigns,
		pagination,
		filters: {
			status
		}
	};
};
