import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BACKEND_URL = 'http://localhost:3007';

export const GET: RequestHandler = async ({ request, fetch }) => {
	try {
		const authHeader = request.headers.get('Authorization');

		if (!authHeader) {
			return json({ error: 'Authorization required' }, { status: 401 });
		}

		const response = await fetch(`${BACKEND_URL}/api/seller/me`, {
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
		console.error('[API Proxy] Seller me error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
