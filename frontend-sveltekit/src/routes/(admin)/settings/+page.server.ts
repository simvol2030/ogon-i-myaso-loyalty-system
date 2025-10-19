import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { queries } from '$lib/server/db/database';
import { requireRole } from '$lib/server/auth/session';
import bcrypt from 'bcrypt';
import { validateEmail, validatePassword, validateName, validateRole, validateId } from '$lib/server/validation';

export const load: PageServerLoad = async (event) => {
	// Только super-admin может видеть настройки
	try {
		requireRole(event, ['super-admin']);
	} catch {
		throw error(403, 'Access denied. Super-admin only.');
	}

	const admins = queries.getAllAdmins.all();
	return { admins };
};

export const actions: Actions = {
	create: async (event) => {
		try {
			requireRole(event, ['super-admin']);
		} catch {
			return fail(403, { error: 'Insufficient permissions' });
		}

		const formData = await event.request.formData();
		const email = formData.get('email')?.toString();
		const password = formData.get('password')?.toString();
		const role = formData.get('role')?.toString();
		const name = formData.get('name')?.toString();

		// Validate inputs
		const emailValidation = validateEmail(email);
		if (!emailValidation.valid) {
			return fail(400, { error: emailValidation.error });
		}

		const passwordValidation = validatePassword(password);
		if (!passwordValidation.valid) {
			return fail(400, { error: passwordValidation.error });
		}

		const roleValidation = validateRole(role);
		if (!roleValidation.valid) {
			return fail(400, { error: roleValidation.error });
		}

		const nameValidation = validateName(name);
		if (!nameValidation.valid) {
			return fail(400, { error: nameValidation.error });
		}

		try {
			// Хешируем пароль
			const hashedPassword = await bcrypt.hash(password!, 10);
			queries.createAdmin.run(email, hashedPassword, role, name);
			return { success: true };
		} catch (error: any) {
			if (error.code === 'SQLITE_CONSTRAINT') {
				return fail(409, { error: 'Email already exists' });
			}
			return fail(500, { error: 'Failed to create admin' });
		}
	},

	update: async (event) => {
		try {
			requireRole(event, ['super-admin']);
		} catch {
			return fail(403, { error: 'Insufficient permissions' });
		}

		const formData = await event.request.formData();
		const id = formData.get('id')?.toString();
		const email = formData.get('email')?.toString();
		const role = formData.get('role')?.toString();
		const name = formData.get('name')?.toString();

		// Validate inputs
		const idValidation = validateId(id);
		if (!idValidation.valid) {
			return fail(400, { error: idValidation.error });
		}

		const emailValidation = validateEmail(email);
		if (!emailValidation.valid) {
			return fail(400, { error: emailValidation.error });
		}

		const roleValidation = validateRole(role);
		if (!roleValidation.valid) {
			return fail(400, { error: roleValidation.error });
		}

		const nameValidation = validateName(name);
		if (!nameValidation.valid) {
			return fail(400, { error: nameValidation.error });
		}

		try {
			const result = queries.updateAdmin.run(email, role, name, id);
			if (result.changes === 0) {
				return fail(404, { error: 'Admin not found' });
			}
			return { success: true };
		} catch (error: any) {
			if (error.code === 'SQLITE_CONSTRAINT') {
				return fail(409, { error: 'Email already exists' });
			}
			return fail(500, { error: 'Failed to update admin' });
		}
	},

	changePassword: async (event) => {
		try {
			requireRole(event, ['super-admin']);
		} catch {
			return fail(403, { error: 'Insufficient permissions' });
		}

		const formData = await event.request.formData();
		const id = formData.get('id')?.toString();
		const password = formData.get('password')?.toString();

		// Validate inputs
		const idValidation = validateId(id);
		if (!idValidation.valid) {
			return fail(400, { error: idValidation.error });
		}

		const passwordValidation = validatePassword(password);
		if (!passwordValidation.valid) {
			return fail(400, { error: passwordValidation.error });
		}

		try {
			const hashedPassword = await bcrypt.hash(password!, 10);
			const result = queries.updateAdminPassword.run(hashedPassword, id);
			if (result.changes === 0) {
				return fail(404, { error: 'Admin not found' });
			}
			return { success: true };
		} catch {
			return fail(500, { error: 'Failed to change password' });
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

		// Проверяем, что это не последний super-admin
		const allAdmins = queries.getAllAdmins.all() as any[];
		const superAdmins = allAdmins.filter((a) => a.role === 'super-admin');

		if (superAdmins.length === 1 && superAdmins[0].id === parseInt(id!)) {
			return fail(400, { error: 'Cannot delete the last super-admin' });
		}

		try {
			const result = queries.deleteAdmin.run(id);
			if (result.changes === 0) {
				return fail(404, { error: 'Admin not found' });
			}
			return { success: true };
		} catch {
			return fail(500, { error: 'Failed to delete admin' });
		}
	}
};
