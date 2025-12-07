import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BACKEND_URL = 'http://localhost:3007';

// GET /api/admin/sellers/:id - получить продавца
export const GET: RequestHandler = async ({ params, fetch }) => {
	try {
		const response = await fetch(`${BACKEND_URL}/api/admin/sellers/${params.id}`);
		const data = await response.json();

		if (!response.ok) {
			return json(data, { status: response.status });
		}

		return json(data);
	} catch (error) {
		console.error('[API Proxy] Get seller error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// PUT /api/admin/sellers/:id - обновить продавца
export const PUT: RequestHandler = async ({ params, request, fetch }) => {
	try {
		const body = await request.json();

		const response = await fetch(`${BACKEND_URL}/api/admin/sellers/${params.id}`, {
			method: 'PUT',
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
		console.error('[API Proxy] Update seller error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// DELETE /api/admin/sellers/:id - удалить продавца
export const DELETE: RequestHandler = async ({ params, fetch }) => {
	try {
		const response = await fetch(`${BACKEND_URL}/api/admin/sellers/${params.id}`, {
			method: 'DELETE'
		});

		const data = await response.json();

		if (!response.ok) {
			return json(data, { status: response.status });
		}

		return json(data);
	} catch (error) {
		console.error('[API Proxy] Delete seller error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
