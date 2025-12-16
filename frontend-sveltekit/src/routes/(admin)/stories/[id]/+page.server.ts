import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3012';

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
	const sessionCookie = cookies.get('session');
	const highlightId = params.id;

	try {
		// Fetch highlight with items
		const highlightResponse = await fetch(`${API_BASE_URL}/api/admin/stories/highlights/${highlightId}`, {
			headers: sessionCookie ? { Cookie: `session=${sessionCookie}` } : {}
		});

		// Fetch settings for validation
		const settingsResponse = await fetch(`${API_BASE_URL}/api/admin/stories/settings`, {
			headers: sessionCookie ? { Cookie: `session=${sessionCookie}` } : {}
		});

		// Fetch analytics for this highlight
		const analyticsResponse = await fetch(`${API_BASE_URL}/api/admin/stories/analytics/${highlightId}?days=30`, {
			headers: sessionCookie ? { Cookie: `session=${sessionCookie}` } : {}
		});

		const highlightData = highlightResponse.ok ? await highlightResponse.json() : { success: false };
		const settingsData = settingsResponse.ok ? await settingsResponse.json() : { success: false };
		const analyticsData = analyticsResponse.ok ? await analyticsResponse.json() : { success: false };

		if (!highlightData.success) {
			throw redirect(302, '/stories');
		}

		return {
			highlight: highlightData.data,
			settings: settingsData.success ? settingsData.data : null,
			analytics: analyticsData.success ? analyticsData.data : null,
			error: null
		};
	} catch (error) {
		console.error('[Stories Admin] Failed to fetch highlight:', error);
		throw redirect(302, '/stories');
	}
};
