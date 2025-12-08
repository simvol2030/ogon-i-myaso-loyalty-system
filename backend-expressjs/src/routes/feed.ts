/**
 * Feed API Routes (Public)
 * Публичный API для ленты постов и статей
 */

import { Router, Request, Response } from 'express';
import {
	getActiveTags,
	getFeedPosts,
	getFeedPostById,
	incrementViewsCount,
	setReaction
} from '../db/queries/feed';

const router = Router();

/**
 * GET /api/feed - Получить посты ленты с пагинацией и фильтрами
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 50)
 * - type: 'post' | 'article' (optional)
 * - tag: string - slug тега для фильтрации (optional)
 * - telegramUserId: string - ID пользователя для получения его реакций (optional)
 *
 * Response:
 * {
 *   "posts": [...],
 *   "total": 100,
 *   "page": 1,
 *   "limit": 20,
 *   "totalPages": 5
 * }
 */
router.get('/', async (req: Request, res: Response) => {
	try {
		const page = Math.max(1, parseInt(req.query.page as string) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
		const type = req.query.type as 'post' | 'article' | undefined;
		const tagSlug = req.query.tag as string | undefined;
		const telegramUserId = req.query.telegramUserId as string | undefined;

		const { posts, total } = await getFeedPosts(
			{
				page,
				limit,
				type: type && ['post', 'article'].includes(type) ? type : undefined,
				tagSlug
			},
			telegramUserId
		);

		// Форматируем посты для фронтенда
		const formattedPosts = posts.map((post) => ({
			id: post.id,
			type: post.type,
			title: post.title,
			content: post.type === 'article' ? post.excerpt || post.content.substring(0, 200) : post.content,
			fullContent: post.type === 'article' ? undefined : post.content, // Полный контент только для постов
			excerpt: post.excerpt,
			authorName: post.author_name,
			publishedAt: post.published_at,
			viewsCount: post.views_count,
			likesCount: post.likes_count,
			dislikesCount: post.dislikes_count,
			userReaction: post.userReaction || null,
			images: post.images.map((img) => ({
				id: img.id,
				url: `/api/uploads/feed/${img.filename}`,
				altText: img.alt_text,
				positionInContent: img.position_in_content
			})),
			tags: post.tags.map((tag) => ({
				id: tag.id,
				name: tag.name,
				slug: tag.slug,
				color: tag.color
			}))
		}));

		return res.json({
			posts: formattedPosts,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit)
		});
	} catch (error) {
		console.error('[FEED API] Error getting feed posts:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});

/**
 * GET /api/feed/tags - Получить список активных тегов
 *
 * Response:
 * {
 *   "tags": [
 *     { "id": 1, "name": "Новости", "slug": "news", "color": "#3b82f6" }
 *   ]
 * }
 */
router.get('/tags', async (req: Request, res: Response) => {
	try {
		const tags = await getActiveTags();

		return res.json({
			tags: tags.map((tag) => ({
				id: tag.id,
				name: tag.name,
				slug: tag.slug,
				color: tag.color
			}))
		});
	} catch (error) {
		console.error('[FEED API] Error getting tags:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});

/**
 * GET /api/feed/:id - Получить один пост/статью по ID
 *
 * Query params:
 * - telegramUserId: string - ID пользователя для получения его реакции (optional)
 *
 * Response: полные данные поста с изображениями и тегами
 */
router.get('/:id', async (req: Request, res: Response) => {
	try {
		const id = parseInt(req.params.id);
		const telegramUserId = req.query.telegramUserId as string | undefined;

		if (!id || isNaN(id)) {
			return res.status(400).json({
				error: 'Invalid post ID'
			});
		}

		const post = await getFeedPostById(id, telegramUserId);

		if (!post) {
			return res.status(404).json({
				error: 'Post not found'
			});
		}

		// Проверяем что пост опубликован
		if (!post.is_published) {
			return res.status(404).json({
				error: 'Post not found'
			});
		}

		// FIX H4: Убран инкремент views из API - он происходит в SSR (+page.server.ts)
		// Это предотвращает двойной подсчёт при загрузке страницы

		return res.json({
			id: post.id,
			type: post.type,
			title: post.title,
			content: post.content, // Полный контент для детальной страницы
			excerpt: post.excerpt,
			authorName: post.author_name,
			publishedAt: post.published_at,
			viewsCount: post.views_count, // FIX H4: Без +1, т.к. инкремент в SSR
			likesCount: post.likes_count,
			dislikesCount: post.dislikes_count,
			userReaction: post.userReaction || null,
			images: post.images.map((img) => ({
				id: img.id,
				url: `/api/uploads/feed/${img.filename}`,
				altText: img.alt_text,
				positionInContent: img.position_in_content,
				sortOrder: img.sort_order
			})),
			tags: post.tags.map((tag) => ({
				id: tag.id,
				name: tag.name,
				slug: tag.slug,
				color: tag.color
			}))
		});
	} catch (error) {
		console.error('[FEED API] Error getting post:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});

/**
 * POST /api/feed/:id/reaction - Поставить/изменить/убрать реакцию
 *
 * Body:
 * {
 *   "telegramUserId": "123456789",
 *   "type": "like" | "dislike" | null  // null = убрать реакцию
 * }
 *
 * Response:
 * {
 *   "userReaction": "like" | "dislike" | null,
 *   "likesCount": 15,
 *   "dislikesCount": 2
 * }
 */
router.post('/:id/reaction', async (req: Request, res: Response) => {
	try {
		const postId = parseInt(req.params.id);
		const { telegramUserId, type } = req.body;

		if (!postId || isNaN(postId)) {
			return res.status(400).json({
				error: 'Invalid post ID'
			});
		}

		if (!telegramUserId || typeof telegramUserId !== 'string') {
			return res.status(400).json({
				error: 'telegramUserId is required'
			});
		}

		// Валидация типа реакции
		if (type !== null && type !== 'like' && type !== 'dislike') {
			return res.status(400).json({
				error: 'Invalid reaction type. Use "like", "dislike", or null to remove'
			});
		}

		// Проверяем что пост существует и опубликован
		const post = await getFeedPostById(postId);
		if (!post || !post.is_published) {
			return res.status(404).json({
				error: 'Post not found'
			});
		}

		const result = await setReaction(postId, telegramUserId, type);

		return res.json({
			userReaction: result.userReaction,
			likesCount: result.likes_count,
			dislikesCount: result.dislikes_count
		});
	} catch (error) {
		console.error('[FEED API] Error setting reaction:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});

export default router;
