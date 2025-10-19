import { Router } from 'express';
import db from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Все роуты требуют аутентификации
router.use(authenticateToken);

// GET /api/users - получить всех пользователей
router.get('/', (req: AuthRequest, res) => {
	try {
		const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
		res.json({ success: true, data: users });
	} catch (error) {
		console.error('Get users error:', error);
		res.status(500).json({ error: 'Failed to fetch users' });
	}
});

// GET /api/users/:id - получить одного пользователя
router.get('/:id', (req: AuthRequest, res) => {
	try {
		const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

		if (!user) {
			return res.status(404).json({ error: 'User not found' });
		}

		res.json({ success: true, data: user });
	} catch (error) {
		console.error('Get user error:', error);
		res.status(500).json({ error: 'Failed to fetch user' });
	}
});

// POST /api/users - создать пользователя (только super-admin и editor)
router.post('/', requireRole('super-admin', 'editor'), (req: AuthRequest, res) => {
	const { name, email } = req.body;

	if (!name || !email) {
		return res.status(400).json({ error: 'Name and email are required' });
	}

	try {
		const result = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run(name, email);

		const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

		res.status(201).json({ success: true, data: newUser });
	} catch (error: any) {
		if (error.code === 'SQLITE_CONSTRAINT') {
			return res.status(409).json({ error: 'Email already exists' });
		}
		console.error('Create user error:', error);
		res.status(500).json({ error: 'Failed to create user' });
	}
});

// PUT /api/users/:id - обновить пользователя (только super-admin и editor)
router.put('/:id', requireRole('super-admin', 'editor'), (req: AuthRequest, res) => {
	const { name, email } = req.body;

	if (!name || !email) {
		return res.status(400).json({ error: 'Name and email are required' });
	}

	try {
		const result = db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.params.id);

		if (result.changes === 0) {
			return res.status(404).json({ error: 'User not found' });
		}

		const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

		res.json({ success: true, data: updatedUser });
	} catch (error: any) {
		if (error.code === 'SQLITE_CONSTRAINT') {
			return res.status(409).json({ error: 'Email already exists' });
		}
		console.error('Update user error:', error);
		res.status(500).json({ error: 'Failed to update user' });
	}
});

// DELETE /api/users/:id - удалить пользователя (только super-admin)
router.delete('/:id', requireRole('super-admin'), (req: AuthRequest, res) => {
	try {
		const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

		if (result.changes === 0) {
			return res.status(404).json({ error: 'User not found' });
		}

		res.json({ success: true, message: 'User deleted successfully' });
	} catch (error) {
		console.error('Delete user error:', error);
		res.status(500).json({ error: 'Failed to delete user' });
	}
});

export default router;
