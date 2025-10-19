import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { queries } from '$lib/server/db/database';
import { requireRole } from '$lib/server/auth/session';
import { validateEmail, validateName, validateId } from '$lib/server/validation';

export const load: PageServerLoad = async () => {
	const users = queries.getAllUsers.all();
	return { users };
};

export const actions: Actions = {
	create: async (event) => {
		// Только super-admin и editor могут создавать
		try {
			requireRole(event, ['super-admin', 'editor']);
		} catch {
			return fail(403, { error: 'Insufficient permissions' });
		}

		const formData = await event.request.formData();
		const name = formData.get('name')?.toString();
		const email = formData.get('email')?.toString();

		// Validate inputs
		const nameValidation = validateName(name);
		if (!nameValidation.valid) {
			return fail(400, { error: nameValidation.error });
		}

		const emailValidation = validateEmail(email);
		if (!emailValidation.valid) {
			return fail(400, { error: emailValidation.error });
		}

		try {
			queries.createUser.run(name, email);
			return { success: true };
		} catch (error: any) {
			if (error.code === 'SQLITE_CONSTRAINT') {
				return fail(409, { error: 'Email already exists' });
			}
			return fail(500, { error: 'Failed to create user' });
		}
	},

	update: async (event) => {
		// Только super-admin и editor могут редактировать
		try {
			requireRole(event, ['super-admin', 'editor']);
		} catch {
			return fail(403, { error: 'Insufficient permissions' });
		}

		const formData = await event.request.formData();
		const id = formData.get('id')?.toString();
		const name = formData.get('name')?.toString();
		const email = formData.get('email')?.toString();

		// Validate inputs
		const idValidation = validateId(id);
		if (!idValidation.valid) {
			return fail(400, { error: idValidation.error });
		}

		const nameValidation = validateName(name);
		if (!nameValidation.valid) {
			return fail(400, { error: nameValidation.error });
		}

		const emailValidation = validateEmail(email);
		if (!emailValidation.valid) {
			return fail(400, { error: emailValidation.error });
		}

		try {
			const result = queries.updateUser.run(name, email, id);
			if (result.changes === 0) {
				return fail(404, { error: 'User not found' });
			}
			return { success: true };
		} catch (error: any) {
			if (error.code === 'SQLITE_CONSTRAINT') {
				return fail(409, { error: 'Email already exists' });
			}
			return fail(500, { error: 'Failed to update user' });
		}
	},

	delete: async (event) => {
		// Только super-admin может удалять
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
			const result = queries.deleteUser.run(id);
			if (result.changes === 0) {
				return fail(404, { error: 'User not found' });
			}
			return { success: true };
		} catch {
			return fail(500, { error: 'Failed to delete user' });
		}
	}
};
