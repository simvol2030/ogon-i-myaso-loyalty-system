import { type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { randomBytes } from 'crypto';

/**
 * Security Headers Hook
 * Adds important security headers to all responses
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Content Security Policy - защита от XSS атак
	// Разрешаем собственные скрипты, стили и Telegram SDK
	const isDev = process.env.NODE_ENV !== 'production';

	const csp = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' https://telegram.org https://*.telegram.org", // Telegram Web App SDK
		"style-src 'self' 'unsafe-inline'", // unsafe-inline для inline стилей Svelte
		"img-src 'self' data: https:",
		"font-src 'self' data:",
		// В dev разрешаем localhost:3000 (backend), localhost:3015 (backend alt), и localhost:3333 (agent), в prod только HTTPS
		isDev
			? "connect-src 'self' http://localhost:3000 http://127.0.0.1:3000 http://localhost:3015 http://127.0.0.1:3015 http://localhost:3333 http://127.0.0.1:3333 https://api.telegram.org https://*.telegram.org"
			: "connect-src 'self' https://api.telegram.org https://*.telegram.org https://murzicoin.murzico.ru",
		"frame-ancestors 'none'", // запрещаем iframe embedding
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ');

	response.headers.set('Content-Security-Policy', csp);

	// Запрещаем встраивание сайта в iframe (защита от clickjacking)
	response.headers.set('X-Frame-Options', 'DENY');

	// Запрещаем браузеру определять MIME type автоматически
	response.headers.set('X-Content-Type-Options', 'nosniff');

	// Включаем защиту от XSS в старых браузерах
	response.headers.set('X-XSS-Protection', '1; mode=block');

	// Referrer Policy - контролируем передачу referrer
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	// Permissions Policy - отключаем ненужные API браузера
	// camera=(self) разрешает использование камеры для QR-сканирования в seller интерфейсе
	response.headers.set(
		'Permissions-Policy',
		'geolocation=(), microphone=(), camera=(self), payment=(), usb=(), magnetometer=()'
	);

	// HSTS - заставляем использовать HTTPS (только в production)
	if (process.env.NODE_ENV === 'production') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	}

	return response;
};

/**
 * CSRF Protection Hook
 * Проверяет CSRF токены для всех POST/PUT/DELETE запросов
 */
const csrfProtection: Handle = async ({ event, resolve }) => {
	const { request, cookies } = event;

	// Генерируем CSRF токен для GET запросов
	if (request.method === 'GET') {
		let csrfToken = cookies.get('csrf_token');

		// Создаём новый токен если его нет
		if (!csrfToken) {
			csrfToken = randomBytes(32).toString('base64');
			cookies.set('csrf_token', csrfToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				secure: process.env.NODE_ENV === 'production',
				maxAge: 60 * 60 * 24 // 24 часа
			});
		}

		// Добавляем токен в locals для доступа на страницах
		event.locals.csrfToken = csrfToken;
	}

	// Проверяем CSRF токен для мутирующих запросов
	if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
		const cookieToken = cookies.get('csrf_token');

		// Логин endpoint - особый случай, там нет токена до первого GET
		const isLoginEndpoint = event.url.pathname === '/login';

		// Telegram endpoints и 1C API освобождаем от CSRF (server-to-server, без cookies)
		const csrfExemptPrefixes = ['/api/telegram/', '/api/1c/'];
		const isTelegramEndpoint = csrfExemptPrefixes.some(prefix =>
			event.url.pathname.startsWith(prefix)
		);

		if (!isLoginEndpoint && !isTelegramEndpoint) {
			// Получаем токен из заголовка или из формы
			const headerToken = request.headers.get('x-csrf-token');

			// Для form submissions проверяем в body
			let formToken: string | null = null;
			if (request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
				try {
					const formData = await request.clone().formData();
					formToken = formData.get('csrf_token')?.toString() || null;
				} catch {
					// Если не можем распарсить - продолжаем без form token
				}
			}

			const submittedToken = headerToken || formToken;

			// Проверяем токен
			if (!cookieToken || !submittedToken || cookieToken !== submittedToken) {
				// Публичные endpoints без защиты
				const publicEndpoints = ['/api/health'];
				if (!publicEndpoints.includes(event.url.pathname)) {
					console.warn(`CSRF token mismatch for ${request.method} ${event.url.pathname}`);

					// В development режиме просто предупреждаем, в production блокируем
					if (process.env.NODE_ENV === 'production') {
						return new Response('CSRF token validation failed', { status: 403 });
					}
				}
			}
		}
	}

	return resolve(event);
};

/**
 * Request Logging Hook (опционально, для debugging)
 */
const requestLogger: Handle = async ({ event, resolve }) => {
	const start = Date.now();
	const response = await resolve(event);
	const duration = Date.now() - start;

	// Логируем только в development
	if (process.env.NODE_ENV !== 'production') {
		console.log(`${event.request.method} ${event.url.pathname} - ${response.status} (${duration}ms)`);
	}

	return response;
};

/**
 * Комбинируем все hooks в правильном порядке
 *
 * NOTE: /api requests are proxied by nginx directly to Express backend (port 3007)
 * We removed the SvelteKit proxy hook because it was breaking multipart/form-data
 * uploads (like Stories image upload) by converting body to arrayBuffer.
 */
export const handle = sequence(
	requestLogger,      // 1. Логирование (первым, чтобы замерить всё)
	securityHeaders,    // 2. Security headers (рано, чтобы защитить всё)
	csrfProtection      // 3. CSRF защита (после headers)
);
