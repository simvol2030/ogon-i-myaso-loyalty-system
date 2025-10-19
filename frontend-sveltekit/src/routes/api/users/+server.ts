import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/database';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	try {
		const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
		return json(users);
	} catch (error) {
		console.error('Error fetching users:', error);
		return json({ error: 'Failed to fetch users' }, { status: 500 });
	}
};
