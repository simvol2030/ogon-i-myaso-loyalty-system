import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

const BACKEND_URL = env.PUBLIC_BACKEND_URL || 'http://localhost:3015';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const card = url.searchParams.get('card');
	const storeId = url.searchParams.get('storeId');

	if (!card || !storeId) {
		return json({ error: 'Missing card or storeId parameter' }, { status: 400 });
	}

	try {
		const backendUrl = `${BACKEND_URL}/api/customers/search?card=${card}&storeId=${storeId}`;
		console.log('[API Proxy] Proxying customer search to:', backendUrl);

		const response = await fetch(backendUrl);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[API Proxy] Backend error:', response.status, errorText);
			return json({ error: 'Customer not found' }, { status: response.status });
		}

		const customer = await response.json();
		return json(customer);
	} catch (error) {
		console.error('[API Proxy] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
