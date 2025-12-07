import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BACKEND_URL = 'http://localhost:3007';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { id } = params;

	if (!id) {
		return json({ error: 'Missing customer ID' }, { status: 400 });
	}

	try {
		const response = await fetch(`${BACKEND_URL}/api/customers/${id}`);

		if (!response.ok) {
			return json({ error: 'Customer not found' }, { status: response.status });
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		console.error('[API Proxy] Customer fetch error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
