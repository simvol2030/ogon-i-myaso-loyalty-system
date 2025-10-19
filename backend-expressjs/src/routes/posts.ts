import { Router } from 'express';
import db from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Все роуты требуют аутентификации
router.use(authenticateToken);

// GET /api/posts - получить все посты
router.get('/', (req: AuthRequest, res) => {
	try {
		const posts = db.prepare(`
			SELECT
				posts.*,
				users.name as author_name,
				users.email as author_email
			FROM posts
			LEFT JOIN users ON posts.user_id = users.id
			ORDER BY posts.created_at DESC
		`).all();

		res.json({ success: true, data: posts });
	} catch (error) {
		console.error('Get posts error:', error);
		res.status(500).json({ error: 'Failed to fetch posts' });
	}
});

// GET /api/posts/:id - получить один пост
router.get('/:id', (req: AuthRequest, res) => {
	try {
		const post = db.prepare(`
			SELECT
				posts.*,
				users.name as author_name,
				users.email as author_email
			FROM posts
			LEFT JOIN users ON posts.user_id = users.id
			WHERE posts.id = ?
		`).get(req.params.id);

		if (!post) {
			return res.status(404).json({ error: 'Post not found' });
		}

		res.json({ success: true, data: post });
	} catch (error) {
		console.error('Get post error:', error);
		res.status(500).json({ error: 'Failed to fetch post' });
	}
});

// POST /api/posts - создать пост (только super-admin и editor)
router.post('/', requireRole('super-admin', 'editor'), (req: AuthRequest, res) => {
	const { user_id, title, content, published = 0 } = req.body;

	if (!user_id || !title) {
		return res.status(400).json({ error: 'user_id and title are required' });
	}

	try {
		const result = db.prepare(`
			INSERT INTO posts (user_id, title, content, published)
			VALUES (?, ?, ?, ?)
		`).run(user_id, title, content, published);

		const newPost = db.prepare(`
			SELECT
				posts.*,
				users.name as author_name,
				users.email as author_email
			FROM posts
			LEFT JOIN users ON posts.user_id = users.id
			WHERE posts.id = ?
		`).get(result.lastInsertRowid);

		res.status(201).json({ success: true, data: newPost });
	} catch (error: any) {
		console.error('Create post error:', error);
		res.status(500).json({ error: 'Failed to create post' });
	}
});

// PUT /api/posts/:id - обновить пост (только super-admin и editor)
router.put('/:id', requireRole('super-admin', 'editor'), (req: AuthRequest, res) => {
	const { user_id, title, content, published } = req.body;

	if (!user_id || !title) {
		return res.status(400).json({ error: 'user_id and title are required' });
	}

	try {
		const result = db.prepare(`
			UPDATE posts
			SET user_id = ?, title = ?, content = ?, published = ?
			WHERE id = ?
		`).run(user_id, title, content, published, req.params.id);

		if (result.changes === 0) {
			return res.status(404).json({ error: 'Post not found' });
		}

		const updatedPost = db.prepare(`
			SELECT
				posts.*,
				users.name as author_name,
				users.email as author_email
			FROM posts
			LEFT JOIN users ON posts.user_id = users.id
			WHERE posts.id = ?
		`).get(req.params.id);

		res.json({ success: true, data: updatedPost });
	} catch (error) {
		console.error('Update post error:', error);
		res.status(500).json({ error: 'Failed to update post' });
	}
});

// DELETE /api/posts/:id - удалить пост (только super-admin)
router.delete('/:id', requireRole('super-admin'), (req: AuthRequest, res) => {
	try {
		const result = db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);

		if (result.changes === 0) {
			return res.status(404).json({ error: 'Post not found' });
		}

		res.json({ success: true, message: 'Post deleted successfully' });
	} catch (error) {
		console.error('Delete post error:', error);
		res.status(500).json({ error: 'Failed to delete post' });
	}
});

export default router;
