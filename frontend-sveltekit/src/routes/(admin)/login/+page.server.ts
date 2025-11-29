import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { validateCredentials, createSession, getSession } from '$lib/server/auth/session';
import { validateEmail } from '$lib/server/validation';
import { checkRateLimit, resetRateLimit, getClientIP, RATE_LIMIT_CONFIGS } from '$lib/server/rate-limit';

// Если уже залогинены, редирект на dashboard
export const load: PageServerLoad = async (event) => {
	const user = getSession(event);

	if (user) {
		throw redirect(303, '/dashboard');
	}

	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString();
		const password = formData.get('password')?.toString();

		// Validate email format and security
		const emailValidation = validateEmail(email);
		if (!emailValidation.valid) {
			return fail(400, {
				error: emailValidation.error,
				email
			});
		}

		// Basic password presence check (no complexity validation for login)
		if (!password || typeof password !== 'string') {
			return fail(400, {
				error: 'Password is required',
				email
			});
		}

		// Rate limiting by IP address to prevent brute-force attacks
		const clientIP = getClientIP(event.request);
		const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIGS.LOGIN);

		if (!rateLimitResult.allowed) {
			return fail(429, {
				error: rateLimitResult.message,
				email,
				retryAfter: Math.ceil(rateLimitResult.retryAfterMs! / 1000)
			});
		}

		// Проверяем учётные данные
		const user = await validateCredentials(email!, password!);

		if (!user) {
			return fail(401, {
				error: 'Invalid email or password',
				email,
				remainingAttempts: rateLimitResult.remainingAttempts
			});
		}

		// Successful login - reset rate limit for this IP
		resetRateLimit(clientIP);

		// Создаём зашифрованную сессию
		await createSession(event, user);

		// Редирект на dashboard
		throw redirect(303, '/dashboard');
	}
};
