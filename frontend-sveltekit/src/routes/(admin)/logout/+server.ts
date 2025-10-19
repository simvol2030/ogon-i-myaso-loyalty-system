import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession } from '$lib/server/auth/session';

export const POST: RequestHandler = async (event) => {
	destroySession(event);
	throw redirect(303, '/login');
};
