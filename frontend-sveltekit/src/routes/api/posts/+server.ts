import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/database';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	try {
		const posts = db
			.prepare(
				`
			SELECT
				posts.*,
				users.name as author_name,
				users.email as author_email
			FROM posts
			JOIN users ON posts.user_id = users.id
			WHERE posts.published = 1
			ORDER BY posts.created_at DESC
		`
			)
			.all();
		return json(posts);
	} catch (error) {
		console.error('Error fetching posts:', error);
		return json({ error: 'Failed to fetch posts' }, { status: 500 });
	}
};
