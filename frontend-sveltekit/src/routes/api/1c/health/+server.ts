import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Server-side proxy должен использовать ВНУТРЕННИЙ backend URL (не PUBLIC_BACKEND_URL!)
const BACKEND_URL = 'http://localhost:3007';

/**
 * Proxy endpoint для health check backend
 *
 * Агенты и 1C могут использовать этот endpoint
 * для проверки доступности backend
 */
export const GET: RequestHandler = async ({ fetch }) => {
	try {
		const backendUrl = `${BACKEND_URL}/api/1c/health`;
		console.log('[API Proxy] Proxying health check to:', backendUrl);

		const response = await fetch(backendUrl);

		if (!response.ok) {
			const errorData = await response.json();
			console.warn('[API Proxy] Backend health check failed:', response.status, errorData);
			return json(errorData, { status: response.status });
		}

		const data = await response.json();
		console.log('[API Proxy] Health check OK:', data);
		return json(data);
	} catch (error) {
		console.error('[API Proxy] Health check error:', error);
		return json({ status: 'error', message: 'Backend unavailable' }, { status: 503 });
	}
};
