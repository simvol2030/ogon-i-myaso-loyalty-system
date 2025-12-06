import type { PageServerLoad } from './$types';
import { API_BASE_URL } from '$lib/config';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
	const campaignId = parseInt(params.id);

	if (isNaN(campaignId)) {
		throw error(400, 'Invalid campaign ID');
	}

	// Get session cookie to forward to backend
	const sessionCookie = cookies.get('session');
	if (!sessionCookie) {
		throw error(401, 'Session expired. Please login again.');
	}

	// Fetch campaign details
	const campaignRes = await fetch(`${API_BASE_URL}/admin/campaigns/${campaignId}`, {
		headers: {
			Cookie: `session=${sessionCookie}`
		}
	});

	const campaignJson = await campaignRes.json();

	if (!campaignJson.success) {
		throw error(404, campaignJson.error || 'Campaign not found');
	}

	// Fetch recipients
	const recipientsRes = await fetch(`${API_BASE_URL}/admin/campaigns/${campaignId}/recipients?limit=50`, {
		headers: {
			Cookie: `session=${sessionCookie}`
		}
	});

	const recipientsJson = await recipientsRes.json();

	return {
		campaign: campaignJson.data,
		recipients: recipientsJson.success ? recipientsJson.data : { recipients: [], stats: {} }
	};
};
