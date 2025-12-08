/**
 * Admin API: Feed Management
 * CRUD для постов, статей, тегов и изображений ленты
 */

import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { authenticateSession, requireRole } from '../../middleware/session-auth';
import {
	// Tags
	getAllTags,
	getTagById,
	createTag,
	updateTag,
	deleteTag,
	// Posts
	getFeedPosts,
	getFeedPostById,
	createFeedPost,
	updateFeedPost,
	deleteFeedPost,
	hardDeleteFeedPost,
	togglePublishFeedPost,
	// Images
	getPostImages,
	addPostImage,
	deletePostImage,
	reorderPostImages,
	// Tags for posts
	setPostTags,
	getPostTags
} from '../../db/queries/feed';

const router = Router();

// Uploads directory for feed images
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'feed');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
	fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer configuration - store in memory for processing
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB max
		files: 20 // Max 20 images per request
	},
	fileFilter: (req, file, cb) => {
		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('Разрешены только изображения (JPEG, PNG, WebP, GIF)'));
		}
	}
});

// 🔒 SECURITY: All admin routes require authentication
router.use(authenticateSession);

// ============================================================
// TAGS MANAGEMENT
// ============================================================

/**
 * GET /api/admin/feed/tags - Get all tags (for admin)
 */
router.get('/tags', async (req, res) => {
	try {
		const tags = await getAllTags();
		res.json({
			success: true,
			data: { tags }
		});
	} catch (error: any) {
		console.error('Error fetching tags:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/feed/tags - Create a new tag
 * ONLY: super-admin, editor
 */
router.post('/tags', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const { name, slug, color, sort_order } = req.body;

		if (!name || !slug) {
			return res.status(400).json({
				success: false,
				error: 'Name and slug are required'
			});
		}

		// Validate slug format (lowercase, alphanumeric, dashes only)
		if (!/^[a-z0-9-]+$/.test(slug)) {
			return res.status(400).json({
				success: false,
				error: 'Slug must contain only lowercase letters, numbers, and dashes'
			});
		}

		const tag = await createTag({
			name,
			slug,
			color: color || '#ff6b00',
			sort_order: sort_order || 0
		});

		res.status(201).json({
			success: true,
			data: { tag }
		});
	} catch (error: any) {
		console.error('Error creating tag:', error);
		if (error.message?.includes('UNIQUE constraint')) {
			return res.status(400).json({ success: false, error: 'Тег с таким slug уже существует' });
		}
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/feed/tags/:id - Update a tag
 * ONLY: super-admin, editor
 */
router.put('/tags/:id', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const id = parseInt(req.params.id);
		const { name, slug, color, sort_order, is_active } = req.body;

		const existing = await getTagById(id);
		if (!existing) {
			return res.status(404).json({ success: false, error: 'Тег не найден' });
		}

		// Validate slug if provided
		if (slug && !/^[a-z0-9-]+$/.test(slug)) {
			return res.status(400).json({
				success: false,
				error: 'Slug must contain only lowercase letters, numbers, and dashes'
			});
		}

		const tag = await updateTag(id, {
			...(name !== undefined && { name }),
			...(slug !== undefined && { slug }),
			...(color !== undefined && { color }),
			...(sort_order !== undefined && { sort_order }),
			...(is_active !== undefined && { is_active })
		});

		res.json({
			success: true,
			data: { tag }
		});
	} catch (error: any) {
		console.error('Error updating tag:', error);
		if (error.message?.includes('UNIQUE constraint')) {
			return res.status(400).json({ success: false, error: 'Тег с таким slug уже существует' });
		}
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * DELETE /api/admin/feed/tags/:id - Delete a tag
 * ONLY: super-admin
 */
router.delete('/tags/:id', requireRole('super-admin'), async (req, res) => {
	try {
		const id = parseInt(req.params.id);

		const existing = await getTagById(id);
		if (!existing) {
			return res.status(404).json({ success: false, error: 'Тег не найден' });
		}

		await deleteTag(id);

		res.json({
			success: true,
			message: 'Тег удалён'
		});
	} catch (error: any) {
		console.error('Error deleting tag:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

// ============================================================
// POSTS MANAGEMENT
// ============================================================

/**
 * GET /api/admin/feed/posts - Get all posts (including unpublished)
 */
router.get('/posts', async (req, res) => {
	try {
		const page = Math.max(1, parseInt(req.query.page as string) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
		const type = req.query.type as 'post' | 'article' | undefined;

		const { posts, total } = await getFeedPosts({
			page,
			limit,
			type: type && ['post', 'article'].includes(type) ? type : undefined,
			includeUnpublished: true
		});

		res.json({
			success: true,
			data: {
				posts: posts.map((post) => ({
					id: post.id,
					type: post.type,
					title: post.title,
					excerpt: post.excerpt || (post.content ? post.content.substring(0, 100) + '...' : ''),
					isPublished: post.is_published,
					publishedAt: post.published_at,
					viewsCount: post.views_count,
					likesCount: post.likes_count,
					dislikesCount: post.dislikes_count,
					imagesCount: post.images.length,
					tags: post.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
					createdAt: post.created_at,
					updatedAt: post.updated_at
				})),
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit)
			}
		});
	} catch (error: any) {
		console.error('Error fetching posts:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/admin/feed/posts/:id - Get single post for editing
 */
router.get('/posts/:id', async (req, res) => {
	try {
		const id = parseInt(req.params.id);
		const post = await getFeedPostById(id);

		if (!post) {
			return res.status(404).json({ success: false, error: 'Пост не найден' });
		}

		res.json({
			success: true,
			data: {
				post: {
					id: post.id,
					type: post.type,
					title: post.title,
					content: post.content,
					excerpt: post.excerpt,
					authorName: post.author_name,
					isPublished: post.is_published,
					publishedAt: post.published_at,
					viewsCount: post.views_count,
					likesCount: post.likes_count,
					dislikesCount: post.dislikes_count,
					images: post.images.map((img) => ({
						id: img.id,
						filename: img.filename,
						url: `/api/uploads/feed/${img.filename}`,
						altText: img.alt_text,
						positionInContent: img.position_in_content,
						sortOrder: img.sort_order
					})),
					tags: post.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug, color: t.color })),
					createdAt: post.created_at,
					updatedAt: post.updated_at
				}
			}
		});
	} catch (error: any) {
		console.error('Error fetching post:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/feed/posts - Create a new post
 * ONLY: super-admin, editor
 */
router.post('/posts', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const { type, title, content, excerpt, authorName, tagIds, isPublished } = req.body;

		// Validation
		if (!content) {
			return res.status(400).json({
				success: false,
				error: 'Контент обязателен'
			});
		}

		if (type === 'article' && !title) {
			return res.status(400).json({
				success: false,
				error: 'Заголовок обязателен для статей'
			});
		}

		const post = await createFeedPost({
			type: type || 'post',
			title: title || null,
			content,
			excerpt: excerpt || null,
			author_name: authorName || null,
			is_published: isPublished || false,
			published_at: isPublished ? new Date().toISOString() : null
		});

		// Set tags if provided
		if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
			await setPostTags(post.id, tagIds);
		}

		// Fetch complete post with relations
		const completePost = await getFeedPostById(post.id);

		res.status(201).json({
			success: true,
			data: { post: completePost }
		});
	} catch (error: any) {
		console.error('Error creating post:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/feed/posts/:id - Update a post
 * ONLY: super-admin, editor
 */
router.put('/posts/:id', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const id = parseInt(req.params.id);
		const { type, title, content, excerpt, authorName, tagIds } = req.body;

		const existing = await getFeedPostById(id);
		if (!existing) {
			return res.status(404).json({ success: false, error: 'Пост не найден' });
		}

		// Validation
		if (type === 'article' && title === '') {
			return res.status(400).json({
				success: false,
				error: 'Заголовок обязателен для статей'
			});
		}

		await updateFeedPost(id, {
			...(type !== undefined && { type }),
			...(title !== undefined && { title }),
			...(content !== undefined && { content }),
			...(excerpt !== undefined && { excerpt }),
			...(authorName !== undefined && { author_name: authorName })
		});

		// Update tags if provided
		if (tagIds !== undefined && Array.isArray(tagIds)) {
			await setPostTags(id, tagIds);
		}

		// Fetch updated post
		const updatedPost = await getFeedPostById(id);

		res.json({
			success: true,
			data: { post: updatedPost }
		});
	} catch (error: any) {
		console.error('Error updating post:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PATCH /api/admin/feed/posts/:id/publish - Toggle publish status
 * ONLY: super-admin, editor
 */
router.patch('/posts/:id/publish', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const id = parseInt(req.params.id);
		const { isPublished } = req.body;

		const existing = await getFeedPostById(id);
		if (!existing) {
			return res.status(404).json({ success: false, error: 'Пост не найден' });
		}

		const post = await togglePublishFeedPost(id, isPublished);

		res.json({
			success: true,
			data: {
				post: {
					id: post?.id,
					isPublished: post?.is_published,
					publishedAt: post?.published_at
				}
			}
		});
	} catch (error: any) {
		console.error('Error toggling publish:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * DELETE /api/admin/feed/posts/:id - Soft delete a post
 * ONLY: super-admin, editor
 */
router.delete('/posts/:id', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const id = parseInt(req.params.id);
		const hard = req.query.hard === 'true';

		const existing = await getFeedPostById(id);
		if (!existing) {
			return res.status(404).json({ success: false, error: 'Пост не найден' });
		}

		if (hard) {
			// Delete images from disk
			for (const image of existing.images) {
				const filepath = path.join(UPLOADS_DIR, image.filename);
				if (fs.existsSync(filepath)) {
					fs.unlinkSync(filepath);
				}
			}
			await hardDeleteFeedPost(id);
		} else {
			await deleteFeedPost(id);
		}

		res.json({
			success: true,
			message: hard ? 'Пост полностью удалён' : 'Пост деактивирован'
		});
	} catch (error: any) {
		console.error('Error deleting post:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

// ============================================================
// IMAGES MANAGEMENT
// ============================================================

/**
 * GET /api/admin/feed/posts/:postId/images - Get all images for a post
 */
router.get('/posts/:postId/images', async (req, res) => {
	try {
		const postId = parseInt(req.params.postId);
		const images = await getPostImages(postId);

		res.json({
			success: true,
			data: {
				images: images.map((img) => ({
					id: img.id,
					filename: img.filename,
					originalName: img.original_name,
					url: `/api/uploads/feed/${img.filename}`,
					altText: img.alt_text,
					positionInContent: img.position_in_content,
					sortOrder: img.sort_order
				}))
			}
		});
	} catch (error: any) {
		console.error('Error fetching post images:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/feed/posts/:postId/images - Upload image(s)
 * ONLY: super-admin, editor
 */
router.post(
	'/posts/:postId/images',
	requireRole('super-admin', 'editor'),
	upload.array('images', 20),
	async (req, res) => {
		try {
			const postId = parseInt(req.params.postId);
			const files = req.files as Express.Multer.File[];
			const positionInContent = req.body.positionInContent
				? parseInt(req.body.positionInContent)
				: null;

			if (!files || files.length === 0) {
				return res.status(400).json({ success: false, error: 'Файлы не загружены' });
			}

			// Check post exists
			const post = await getFeedPostById(postId);
			if (!post) {
				return res.status(404).json({ success: false, error: 'Пост не найден' });
			}

			// Get current max sort order
			const existingImages = await getPostImages(postId);
			let maxOrder =
				existingImages.length > 0
					? Math.max(...existingImages.map((img) => img.sort_order))
					: -1;

			const uploadedImages: any[] = [];

			for (const file of files) {
				// Generate unique filename
				const timestamp = Date.now();
				const randomSuffix = Math.random().toString(36).substring(2, 8);
				const filename = `feed_${postId}_${timestamp}_${randomSuffix}.webp`;
				const filepath = path.join(UPLOADS_DIR, filename);

				// Process image with sharp:
				// - Convert to WebP
				// - Resize to max 1200px width for articles, 800px for posts
				const maxWidth = post.type === 'article' ? 1200 : 800;
				await sharp(file.buffer)
					.resize(maxWidth, maxWidth, {
						fit: 'inside',
						withoutEnlargement: true
					})
					.webp({ quality: 85 })
					.toFile(filepath);

				// Save to database
				maxOrder++;
				const result = await addPostImage({
					post_id: postId,
					filename: filename,
					original_name: file.originalname,
					alt_text: null,
					position_in_content: positionInContent,
					sort_order: maxOrder
				});

				uploadedImages.push({
					id: result.id,
					filename: result.filename,
					originalName: result.original_name,
					url: `/api/uploads/feed/${result.filename}`,
					altText: result.alt_text,
					positionInContent: result.position_in_content,
					sortOrder: result.sort_order
				});
			}

			res.status(201).json({
				success: true,
				data: { images: uploadedImages }
			});
		} catch (error: any) {
			console.error('Error uploading feed images:', error);
			res.status(500).json({ success: false, error: error.message || 'Internal server error' });
		}
	}
);

/**
 * PUT /api/admin/feed/posts/:postId/images/:imageId - Update image metadata
 * ONLY: super-admin, editor
 */
router.put(
	'/posts/:postId/images/:imageId',
	requireRole('super-admin', 'editor'),
	async (req, res) => {
		try {
			const postId = parseInt(req.params.postId);
			const imageId = parseInt(req.params.imageId);
			const { altText, positionInContent } = req.body;

			const images = await getPostImages(postId);
			const image = images.find((img) => img.id === imageId);

			if (!image) {
				return res.status(404).json({ success: false, error: 'Изображение не найдено' });
			}

			// Update via direct DB call (we need to add this function or use db directly)
			const { db } = await import('../../db/client');
			const { feedPostImages } = await import('../../db/schema');
			const { eq } = await import('drizzle-orm');

			await db
				.update(feedPostImages)
				.set({
					...(altText !== undefined && { alt_text: altText }),
					...(positionInContent !== undefined && { position_in_content: positionInContent })
				})
				.where(eq(feedPostImages.id, imageId));

			const updatedImages = await getPostImages(postId);
			const updatedImage = updatedImages.find((img) => img.id === imageId);

			res.json({
				success: true,
				data: {
					image: {
						id: updatedImage?.id,
						filename: updatedImage?.filename,
						url: `/api/uploads/feed/${updatedImage?.filename}`,
						altText: updatedImage?.alt_text,
						positionInContent: updatedImage?.position_in_content,
						sortOrder: updatedImage?.sort_order
					}
				}
			});
		} catch (error: any) {
			console.error('Error updating image:', error);
			res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}
);

/**
 * PUT /api/admin/feed/posts/:postId/images/reorder - Reorder images
 * Body: { imageIds: [3, 1, 2] } - new order
 * ONLY: super-admin, editor
 */
router.put(
	'/posts/:postId/images/reorder',
	requireRole('super-admin', 'editor'),
	async (req, res) => {
		try {
			const postId = parseInt(req.params.postId);
			const { imageIds } = req.body;

			if (!Array.isArray(imageIds) || imageIds.length === 0) {
				return res.status(400).json({ success: false, error: 'imageIds должен быть массивом' });
			}

			await reorderPostImages(postId, imageIds);

			const images = await getPostImages(postId);

			res.json({
				success: true,
				data: {
					images: images.map((img) => ({
						id: img.id,
						filename: img.filename,
						url: `/api/uploads/feed/${img.filename}`,
						altText: img.alt_text,
						positionInContent: img.position_in_content,
						sortOrder: img.sort_order
					}))
				}
			});
		} catch (error: any) {
			console.error('Error reordering images:', error);
			res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}
);

/**
 * DELETE /api/admin/feed/posts/:postId/images/:imageId - Delete image
 * ONLY: super-admin, editor
 * FIX B2: Проверка принадлежности к посту ПЕРЕД удалением
 */
router.delete(
	'/posts/:postId/images/:imageId',
	requireRole('super-admin', 'editor'),
	async (req, res) => {
		try {
			const postId = parseInt(req.params.postId);
			const imageId = parseInt(req.params.imageId);

			// FIX B2: Сначала проверяем существование и принадлежность к посту
			const images = await getPostImages(postId);
			const imageToDelete = images.find((img) => img.id === imageId);

			if (!imageToDelete) {
				return res.status(404).json({ success: false, error: 'Изображение не найдено' });
			}

			// FIX B2: Проверяем принадлежность ПЕРЕД удалением
			if (imageToDelete.post_id !== postId) {
				return res
					.status(403)
					.json({ success: false, error: 'Изображение не принадлежит этому посту' });
			}

			// Теперь безопасно удаляем из БД
			await deletePostImage(imageId);

			// Delete file from disk
			const filepath = path.join(UPLOADS_DIR, imageToDelete.filename);
			if (fs.existsSync(filepath)) {
				fs.unlinkSync(filepath);
			}

			res.json({ success: true, message: 'Изображение удалено' });
		} catch (error: any) {
			console.error('Error deleting image:', error);
			res.status(500).json({ success: false, error: 'Internal server error' });
		}
	}
);

export default router;
