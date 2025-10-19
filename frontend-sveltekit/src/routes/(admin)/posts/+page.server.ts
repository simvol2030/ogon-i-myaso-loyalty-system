import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { queries } from '$lib/server/db/database';
import { requireRole } from '$lib/server/auth/session';
import { validateId, validateTitle, validateContent } from '$lib/server/validation';

export const load: PageServerLoad = async () => {
	const posts = queries.getAllPosts.all();
	const users = queries.getAllUsers.all();
	return { posts, users };
};

export const actions: Actions = {
	create: async (event) => {
		try {
			requireRole(event, ['super-admin', 'editor']);
		} catch {
			return fail(403, { error: 'Insufficient permissions' });
		}

		const formData = await event.request.formData();
		const user_id = formData.get('user_id')?.toString();
		const title = formData.get('title')?.toString();
		const content = formData.get('content')?.toString();
		const published = formData.get('published') === 'on' ? 1 : 0;

		// Validate inputs
		const userIdValidation = validateId(user_id);
		if (!userIdValidation.valid) {
			return fail(400, { error: 'Invalid user ID: ' + userIdValidation.error });
		}

		const titleValidation = validateTitle(title);
		if (!titleValidation.valid) {
			return fail(400, { error: titleValidation.error });
		}

		if (content) {
			const contentValidation = validateContent(content);
			if (!contentValidation.valid) {
				return fail(400, { error: contentValidation.error });
			}
		}

		try {
			queries.createPost.run(user_id, title, content || '', published);
			return { success: true };
		} catch {
			return fail(500, { error: 'Failed to create post' });
		}
	},

	update: async (event) => {
		try {
			requireRole(event, ['super-admin', 'editor']);
		} catch {
			return fail(403, { error: 'Insufficient permissions' });
		}

		const formData = await event.request.formData();
		const id = formData.get('id')?.toString();
		const user_id = formData.get('user_id')?.toString();
		const title = formData.get('title')?.toString();
		const content = formData.get('content')?.toString();
		const published = formData.get('published') === 'on' ? 1 : 0;

		// Validate inputs
		const idValidation = validateId(id);
		if (!idValidation.valid) {
			return fail(400, { error: 'Invalid post ID: ' + idValidation.error });
		}

		const userIdValidation = validateId(user_id);
		if (!userIdValidation.valid) {
			return fail(400, { error: 'Invalid user ID: ' + userIdValidation.error });
		}

		const titleValidation = validateTitle(title);
		if (!titleValidation.valid) {
			return fail(400, { error: titleValidation.error });
		}

		if (content) {
			const contentValidation = validateContent(content);
			if (!contentValidation.valid) {
				return fail(400, { error: contentValidation.error });
			}
		}

		try {
			const result = queries.updatePost.run(user_id, title, content || '', published, id);
			if (result.changes === 0) {
				return fail(404, { error: 'Post not found' });
			}
			return { success: true };
		} catch {
			return fail(500, { error: 'Failed to update post' });
		}
	},

	delete: async (event) => {
		try {
			requireRole(event, ['super-admin']);
		} catch {
			return fail(403, { error: 'Insufficient permissions' });
		}

		const formData = await event.request.formData();
		const id = formData.get('id')?.toString();

		// Validate ID
		const idValidation = validateId(id);
		if (!idValidation.valid) {
			return fail(400, { error: idValidation.error });
		}

		try {
			const result = queries.deletePost.run(id);
			if (result.changes === 0) {
				return fail(404, { error: 'Post not found' });
			}
			return { success: true };
		} catch {
			return fail(500, { error: 'Failed to delete post' });
		}
	}
};
