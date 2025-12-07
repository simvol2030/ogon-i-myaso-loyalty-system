import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BACKEND_URL = 'http://localhost:3007';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const body = await request.json();

		const response = await fetch(`${BACKEND_URL}/api/seller/auth`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		const data = await response.json();

		if (!response.ok) {
			return json(data, { status: response.status });
		}

		return json(data);
	} catch (error) {
		console.error('[API Proxy] Seller auth error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
