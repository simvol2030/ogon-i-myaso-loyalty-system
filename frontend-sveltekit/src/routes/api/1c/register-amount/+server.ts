import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Server-side proxy должен использовать ВНУТРЕННИЙ backend URL (не PUBLIC_BACKEND_URL!)
const BACKEND_URL = 'http://localhost:3007';

/**
 * Proxy endpoint для регистрации суммы чека от агента
 *
 * Агент на кассе отправляет:
 * - storeId: ID магазина
 * - storeName: Название магазина
 * - amount: Сумма чека в рублях
 * - timestamp: ISO 8601 timestamp
 *
 * Backend сохраняет в in-memory store (preCheckStore)
 * Затем кассир может запросить через GET /api/1c/check-amount
 */
export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		// CRITICAL SECURITY: Validate API key before processing
		const apiKey = request.headers.get('X-Store-API-Key');
		if (!apiKey || apiKey.trim() === '') {
			console.warn('[API Proxy] Missing or empty X-Store-API-Key header');
			return json({ error: 'Missing store authentication' }, { status: 401 });
		}

		const body = await request.json();

		// CRITICAL SECURITY: Validate request body structure
		if (!body.storeId || typeof body.storeId !== 'number') {
			return json({ error: 'Invalid storeId: must be a number' }, { status: 400 });
		}
		if (!body.storeName || typeof body.storeName !== 'string' || body.storeName.trim() === '') {
			return json({ error: 'Invalid storeName: must be a non-empty string' }, { status: 400 });
		}
		if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
			return json({ error: 'Invalid amount: must be a positive number' }, { status: 400 });
		}
		if (!body.timestamp || typeof body.timestamp !== 'string') {
			return json({ error: 'Invalid timestamp: must be a string' }, { status: 400 });
		}

		// Validate ISO 8601 timestamp format
		try {
			const date = new Date(body.timestamp);
			if (isNaN(date.getTime())) {
				return json({ error: 'Invalid timestamp format: must be ISO 8601' }, { status: 400 });
			}
		} catch {
			return json({ error: 'Invalid timestamp format: must be ISO 8601' }, { status: 400 });
		}

		const backendUrl = `${BACKEND_URL}/api/1c/register-amount`;
		console.log('[API Proxy] Proxying register-amount to:', backendUrl, 'storeId:', body.storeId);

		const response = await fetch(backendUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Store-API-Key': apiKey
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.warn('[API Proxy] Backend error:', response.status, errorData);
			return json(errorData, { status: response.status });
		}

		const data = await response.json();
		console.log('[API Proxy] Amount registered successfully');
		return json(data);
	} catch (error) {
		console.error('[API Proxy] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
