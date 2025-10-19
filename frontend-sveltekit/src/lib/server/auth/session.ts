import type { RequestEvent } from '@sveltejs/kit';
import { queries, type Admin } from '../db/database';
import bcrypt from 'bcrypt';
import { encrypt, decrypt } from './crypto';

export interface SessionUser {
	id: number;
	email: string;
	role: 'super-admin' | 'editor' | 'viewer';
	name: string;
	createdAt: number; // Session creation timestamp for validation
}

// Проверка учётных данных
export async function validateCredentials(email: string, password: string): Promise<SessionUser | null> {
	try {
		const admin = queries.getAdminByEmail.get(email) as Admin | undefined;

		if (!admin) {
			// Use timing-safe comparison to prevent timing attacks
			await bcrypt.compare(password, '$2b$10$dummyhashtopreventtimingattacks12345678901234567890');
			return null;
		}

		// Проверяем пароль с bcrypt
		const isValid = await bcrypt.compare(password, admin.password);

		if (!isValid) {
			return null;
		}

		// Возвращаем данные пользователя без пароля
		return {
			id: admin.id,
			email: admin.email,
			role: admin.role,
			name: admin.name,
			createdAt: Date.now()
		};
	} catch (error) {
		console.error('Validation error:', error);
		return null;
	}
}

// Создание сессии (ENCRYPTED)
export async function createSession(event: RequestEvent, user: SessionUser) {
	// Encrypt session data before storing in cookie
	const encryptedSession = encrypt(user);

	await event.cookies.set('session', encryptedSession, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 7 // 7 дней
	});
}

// Получение текущей сессии (DECRYPTED)
export function getSession(event: RequestEvent): SessionUser | null {
	const sessionCookie = event.cookies.get('session');

	if (!sessionCookie) {
		return null;
	}

	try {
		// Decrypt session data
		const decryptedSession = decrypt(sessionCookie);

		if (!decryptedSession) {
			return null;
		}

		// Validate session age (reject sessions older than max age)
		const maxAgeMs = 60 * 60 * 24 * 7 * 1000; // 7 days in ms
		if (decryptedSession.createdAt && Date.now() - decryptedSession.createdAt > maxAgeMs) {
			return null;
		}

		return decryptedSession as SessionUser;
	} catch {
		return null;
	}
}

// Удаление сессии
export function destroySession(event: RequestEvent) {
	event.cookies.delete('session', {
		path: '/'
	});
}

// Проверка прав доступа
export function hasRole(user: SessionUser | null, roles: string[]): boolean {
	if (!user) return false;
	return roles.includes(user.role);
}

// Middleware для защиты маршрутов
export function requireAuth(event: RequestEvent) {
	const user = getSession(event);

	if (!user) {
		throw new Error('Unauthorized');
	}

	return user;
}

// Middleware для проверки роли
export function requireRole(event: RequestEvent, roles: string[]) {
	const user = requireAuth(event);

	if (!hasRole(user, roles)) {
		throw new Error('Forbidden');
	}

	return user;
}
