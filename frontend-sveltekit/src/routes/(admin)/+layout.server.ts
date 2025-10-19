import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getSession } from '$lib/server/auth/session';

export const load: LayoutServerLoad = async (event) => {
	const user = getSession(event);

	// Если не залогинены и не на странице логина - редирект
	if (!user && event.url.pathname !== '/login') {
		throw redirect(303, '/login');
	}

	return {
		user,
		csrfToken: event.locals.csrfToken // Добавляем CSRF токен для всех страниц
	};
};
