import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Server-side proxy должен использовать ВНУТРЕННИЙ backend URL (не PUBLIC_BACKEND_URL!)
const BACKEND_URL = 'http://localhost:3007';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const card = url.searchParams.get('card');
	const storeId = url.searchParams.get('storeId');

	if (!card) {
		return json({ error: 'Missing card parameter' }, { status: 400 });
	}

	try {
		// storeId теперь опционален (для seller PWA)
		let backendUrl = `${BACKEND_URL}/api/customers/search?card=${card}`;
		if (storeId) {
			backendUrl += `&storeId=${storeId}`;
		}

		console.log('[API Proxy] Proxying customer search to:', backendUrl);

		const response = await fetch(backendUrl);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[API Proxy] Backend error:', response.status, errorText);
			return json({ error: 'Customer not found' }, { status: response.status });
		}

		const data = await response.json();
		// Оборачиваем в { customer } для единообразия
		return json({ customer: data });
	} catch (error) {
		console.error('[API Proxy] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
