import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Server-side proxy должен использовать ВНУТРЕННИЙ backend URL (не PUBLIC_BACKEND_URL!)
const BACKEND_URL = 'http://localhost:3007';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const body = await request.json();
		const backendUrl = `${BACKEND_URL}/api/transactions`;
		console.log('[API Proxy] Proxying transaction creation to:', backendUrl);

		const response = await fetch(backendUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[API Proxy] Backend error:', response.status, errorText);
			return json({ error: 'Transaction creation failed' }, { status: response.status });
		}

		const transaction = await response.json();
		return json(transaction);
	} catch (error) {
		console.error('[API Proxy] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
