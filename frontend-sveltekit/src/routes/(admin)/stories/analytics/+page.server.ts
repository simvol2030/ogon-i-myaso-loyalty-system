import type { PageServerLoad } from './$types';

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3012';

export const load: PageServerLoad = async ({ fetch, url, cookies }) => {
	const days = parseInt(url.searchParams.get('days') || '30');
	const sessionCookie = cookies.get('session');

	try {
		// Fetch overall analytics
		const analyticsResponse = await fetch(`${API_BASE_URL}/api/admin/stories/analytics?days=${days}`, {
			headers: sessionCookie ? { Cookie: `session=${sessionCookie}` } : {}
		});

		// Fetch highlights list for per-highlight analytics
		const highlightsResponse = await fetch(`${API_BASE_URL}/api/admin/stories/highlights?includeInactive=true`, {
			headers: sessionCookie ? { Cookie: `session=${sessionCookie}` } : {}
		});

		let analytics = null;
		let highlights = [];

		if (analyticsResponse.ok) {
			const json = await analyticsResponse.json();
			analytics = json.data;
		}

		if (highlightsResponse.ok) {
			const json = await highlightsResponse.json();
			highlights = json.data?.highlights || [];
		}

		return {
			analytics,
			highlights,
			days,
			error: null
		};
	} catch (error) {
		console.error('Error loading stories analytics:', error);
		return {
			analytics: null,
			highlights: [],
			days,
			error: 'Failed to load analytics'
		};
	}
};
