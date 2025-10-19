import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/database';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// POST /api/auth/login - вход в систему
router.post('/login', (req, res) => {
	const { email, password } = req.body;

	if (!email || !password) {
		return res.status(400).json({ error: 'Email and password required' });
	}

	try {
		// Ищем админа в базе
		const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email) as any;

		if (!admin || admin.password !== password) {
			return res.status(401).json({ error: 'Invalid credentials' });
		}

		// Генерируем JWT токен
		const token = jwt.sign(
			{
				id: admin.id,
				email: admin.email,
				role: admin.role,
				name: admin.name
			},
			JWT_SECRET,
			{ expiresIn: '7d' }
		);

		res.json({
			success: true,
			token,
			user: {
				id: admin.id,
				email: admin.email,
				role: admin.role,
				name: admin.name
			}
		});
	} catch (error) {
		console.error('Login error:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// GET /api/auth/me - получить текущего пользователя
router.get('/me', (req, res) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (!token) {
		return res.status(401).json({ error: 'Access token required' });
	}

	try {
		const decoded = jwt.verify(token, JWT_SECRET) as any;
		res.json({ user: decoded });
	} catch (error) {
		res.status(403).json({ error: 'Invalid or expired token' });
	}
});

export default router;
