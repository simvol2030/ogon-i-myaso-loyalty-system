import type { PageServerLoad } from './$types';
import { API_BASE_URL } from '$lib/config';

export const load: PageServerLoad = async ({ fetch, cookies }) => {
	// Get session cookie to forward to backend
	const sessionCookie = cookies.get('session');
	if (!sessionCookie) {
		throw new Error('Session expired. Please login again.');
	}

	// Fetch triggers
	const triggersRes = await fetch(`${API_BASE_URL}/admin/triggers`, {
		headers: {
			Cookie: `session=${sessionCookie}`
		}
	});

	const triggersJson = await triggersRes.json();

	if (!triggersJson.success) {
		throw new Error(triggersJson.error || 'Failed to load triggers');
	}

	// Fetch event types
	const eventTypesRes = await fetch(`${API_BASE_URL}/admin/triggers/event-types`, {
		headers: {
			Cookie: `session=${sessionCookie}`
		}
	});

	const eventTypesJson = await eventTypesRes.json();

	return {
		triggers: triggersJson.data.triggers,
		eventTypes: eventTypesJson.success ? eventTypesJson.data : []
	};
};
