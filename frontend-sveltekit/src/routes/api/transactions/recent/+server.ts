import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Server-side proxy должен использовать ВНУТРЕННИЙ backend URL (не PUBLIC_BACKEND_URL!)
const BACKEND_URL = 'http://localhost:3007';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const storeId = url.searchParams.get('storeId');
	const limit = url.searchParams.get('limit') || '10';

	if (!storeId) {
		return json({ error: 'Missing storeId parameter' }, { status: 400 });
	}

	try {
		const backendUrl = `${BACKEND_URL}/api/transactions/recent?storeId=${storeId}&limit=${limit}`;
		console.log('[API Proxy] Proxying recent transactions to:', backendUrl);

		const response = await fetch(backendUrl);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[API Proxy] Backend error:', response.status, errorText);
			return json([], { status: 200 }); // Return empty array on error
		}

		const transactions = await response.json();
		return json(transactions);
	} catch (error) {
		console.error('[API Proxy] Error:', error);
		return json([], { status: 200 }); // Return empty array on error
	}
};
