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
	// Разрешаем только собственные скрипты и стили
	const csp = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'", // unsafe-inline нужен для SvelteKit в dev mode
		"style-src 'self' 'unsafe-inline'", // unsafe-inline для inline стилей Svelte
		"img-src 'self' data: https:",
		"font-src 'self' data:",
		"connect-src 'self'",
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
	response.headers.set(
		'Permissions-Policy',
		'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=()'
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

		if (!isLoginEndpoint) {
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
 */
export const handle = sequence(
	requestLogger,      // 1. Логирование (первым, чтобы замерить всё)
	securityHeaders,    // 2. Security headers (рано, чтобы защитить всё)
	csrfProtection      // 3. CSRF защита (после headers)
);
