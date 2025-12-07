import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BACKEND_URL = 'http://localhost:3007';

// GET /api/admin/sellers - список продавцов
export const GET: RequestHandler = async ({ fetch }) => {
	try {
		const response = await fetch(`${BACKEND_URL}/api/admin/sellers`);
		const data = await response.json();

		if (!response.ok) {
			return json(data, { status: response.status });
		}

		return json(data);
	} catch (error) {
		console.error('[API Proxy] Sellers list error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// POST /api/admin/sellers - создать продавца
export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const body = await request.json();

		const response = await fetch(`${BACKEND_URL}/api/admin/sellers`, {
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

		return json(data, { status: 201 });
	} catch (error) {
		console.error('[API Proxy] Create seller error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
