import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Server-side proxy должен использовать ВНУТРЕННИЙ backend URL (не PUBLIC_BACKEND_URL!)
const BACKEND_URL = 'http://localhost:3007';

/**
 * Proxy endpoint для подтверждения применения скидки
 *
 * Агент отправляет POST запрос после того как скидка
 * была применена (или не применена) в 1С
 *
 * Body (от агента):
 * - id: number - ID pending_discount записи
 * - status: 'applied' | 'failed' - результат применения
 * - errorMessage?: string - сообщение об ошибке (опционально)
 */
export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const body = await request.json();

		// CRITICAL SECURITY: Validate request body structure
		// 🔴 FIX: Match agent's request structure (id, status, errorMessage)
		if (!body.id || typeof body.id !== 'number') {
			return json({ error: 'Invalid id: must be a number' }, { status: 400 });
		}
		if (!body.status || typeof body.status !== 'string') {
			return json({ error: 'Invalid status: must be a string' }, { status: 400 });
		}
		if (!['applied', 'failed'].includes(body.status)) {
			return json({ error: 'Invalid status: must be "applied" or "failed"' }, { status: 400 });
		}
		// errorMessage is optional, but if present must be string
		if (body.errorMessage !== undefined && typeof body.errorMessage !== 'string') {
			return json({ error: 'Invalid errorMessage: must be a string' }, { status: 400 });
		}

		const backendUrl = `${BACKEND_URL}/api/1c/confirm-discount`;
		console.log('[API Proxy] Proxying confirm-discount to:', backendUrl, 'id:', body.id, 'status:', body.status);

		const response = await fetch(backendUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.warn('[API Proxy] Backend error:', response.status, errorData);
			return json(errorData, { status: response.status });
		}

		const data = await response.json();
		console.log('[API Proxy] Discount confirmed successfully');
		return json(data);
	} catch (error) {
		console.error('[API Proxy] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
