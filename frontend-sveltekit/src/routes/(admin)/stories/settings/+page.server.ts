import type { PageServerLoad } from './$types';

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3012';

export const load: PageServerLoad = async ({ fetch, cookies }) => {
	const sessionCookie = cookies.get('session');

	try {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/settings`, {
			headers: sessionCookie ? { Cookie: `session=${sessionCookie}` } : {}
		});

		if (!response.ok) {
			return {
				settings: null,
				error: 'Failed to load settings'
			};
		}

		const json = await response.json();
		return {
			settings: json.data,
			error: null
		};
	} catch (error) {
		console.error('Error loading stories settings:', error);
		return {
			settings: null,
			error: 'Failed to load settings'
		};
	}
};
