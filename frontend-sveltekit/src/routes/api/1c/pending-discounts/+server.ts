import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Server-side proxy должен использовать ВНУТРЕННИЙ backend URL (не PUBLIC_BACKEND_URL!)
const BACKEND_URL = 'http://localhost:3007';

/**
 * Proxy endpoint для получения ожидающих скидок
 *
 * 1C периодически опрашивает этот endpoint чтобы получить
 * список скидок от кассиров, которые нужно применить
 *
 * Query params:
 * - storeId: ID магазина (обязательно)
 */
export const GET: RequestHandler = async ({ url, fetch, request }) => {
	const storeIdParam = url.searchParams.get('storeId');

	if (!storeIdParam) {
		return json({ error: 'Missing storeId parameter' }, { status: 400 });
	}

	// CRITICAL SECURITY: Validate storeId is a valid positive number
	// 🔴 BUG-5 FIX: Убран хардкод 10 магазинов - теперь поддерживаем до 1000
	const storeId = parseInt(storeIdParam, 10);
	if (isNaN(storeId) || storeId < 1 || storeId > 1000) {
		return json({ error: 'Invalid storeId: must be a positive number (1-1000)' }, { status: 400 });
	}

	try {
		const backendUrl = `${BACKEND_URL}/api/1c/pending-discounts?storeId=${storeId}`;
		console.log('[API Proxy] Proxying pending-discounts to:', backendUrl);

		// 🔴 FIX: Forward X-Store-API-Key header to backend
		const apiKey = request.headers.get('x-store-api-key');
		const response = await fetch(backendUrl, {
			headers: apiKey ? { 'X-Store-API-Key': apiKey } : {}
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.warn('[API Proxy] Backend error:', response.status, errorData);
			return json(errorData, { status: response.status });
		}

		const data = await response.json();
		console.log('[API Proxy] Pending discounts retrieved successfully');
		return json(data);
	} catch (error) {
		console.error('[API Proxy] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
