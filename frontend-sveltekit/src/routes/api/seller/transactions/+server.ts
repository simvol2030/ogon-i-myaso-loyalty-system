import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BACKEND_URL = 'http://localhost:3007';

export const GET: RequestHandler = async ({ request, url, fetch }) => {
	try {
		const authHeader = request.headers.get('Authorization');

		if (!authHeader) {
			return json({ error: 'Authorization required' }, { status: 401 });
		}

		const limit = url.searchParams.get('limit') || '10';

		const response = await fetch(`${BACKEND_URL}/api/seller/transactions?limit=${limit}`, {
			headers: {
				'Authorization': authHeader
			}
		});

		const data = await response.json();

		if (!response.ok) {
			return json(data, { status: response.status });
		}

		return json(data);
	} catch (error) {
		console.error('[API Proxy] Seller transactions error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
