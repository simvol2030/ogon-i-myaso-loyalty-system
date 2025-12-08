/**
 * Admin Stories Routes
 * CRUD для управления Web Stories (highlights, items, settings, analytics)
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { eq, desc, asc, sql, and, gte, lte, count } from 'drizzle-orm';
import { db } from '../../db/client';
import {
	storiesHighlights,
	storiesItems,
	storiesSettings,
	storiesViews
} from '../../db/schema';
import { authenticateSession, requireRole } from '../../middleware/session-auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticateSession);
router.use(requireRole('super-admin', 'editor'));

// =====================================================
// UPLOAD CONFIGURATION
// =====================================================

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'stories');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
	fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
	storage,
	limits: {
		fileSize: 50 * 1024 * 1024 // 50MB max
	},
	fileFilter: (req, file, cb) => {
		const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

		if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, MP4, WebM'));
		}
	}
});

// =====================================================
// HELPERS
// =====================================================

function toSnakeCase(obj: Record<string, any>): Record<string, any> {
	const result: Record<string, any> = {};
	for (const key in obj) {
		const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
		result[snakeKey] = obj[key];
	}
	return result;
}

function toCamelCase(obj: Record<string, any>): Record<string, any> {
	const result: Record<string, any> = {};
	for (const key in obj) {
		const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
		result[camelKey] = obj[key];
	}
	return result;
}

/**
 * Safely delete a media file - prevents path traversal attacks
 */
function safeDeleteFile(mediaUrl: string | null): void {
	if (!mediaUrl) return;

	// Only process URLs that start with /api/uploads/stories/
	if (!mediaUrl.startsWith('/api/uploads/stories/')) {
		console.warn('[Stories] Attempted to delete file outside stories folder:', mediaUrl);
		return;
	}

	// Extract just the filename (no path components)
	const filename = path.basename(mediaUrl);
	if (!filename || filename.includes('..')) {
		console.warn('[Stories] Invalid filename:', filename);
		return;
	}

	const filePath = path.join(UPLOADS_DIR, filename);

	// Verify the resolved path is within UPLOADS_DIR
	const resolvedPath = path.resolve(filePath);
	const resolvedUploadsDir = path.resolve(UPLOADS_DIR);

	if (!resolvedPath.startsWith(resolvedUploadsDir)) {
		console.warn('[Stories] Path traversal attempt blocked:', mediaUrl);
		return;
	}

	if (fs.existsSync(resolvedPath)) {
		fs.unlinkSync(resolvedPath);
	}
}

/**
 * Parse and validate ID parameter
 */
function parseId(idParam: string): number | null {
	const id = parseInt(idParam, 10);
	return isNaN(id) || id <= 0 ? null : id;
}

// =====================================================
// HIGHLIGHTS CRUD
// =====================================================

// GET /api/admin/stories/highlights - List all highlights
router.get('/highlights', async (req: Request, res: Response) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 50;
		const offset = (page - 1) * limit;
		const includeInactive = req.query.includeInactive === 'true';

		// Build query
		const whereClause = includeInactive ? undefined : eq(storiesHighlights.is_active, true);

		// Get highlights with items count
		const highlights = await db
			.select({
				id: storiesHighlights.id,
				title: storiesHighlights.title,
				cover_image: storiesHighlights.cover_image,
				position: storiesHighlights.position,
				is_active: storiesHighlights.is_active,
				created_at: storiesHighlights.created_at,
				updated_at: storiesHighlights.updated_at,
				items_count: sql<number>`(SELECT COUNT(*) FROM stories_items WHERE highlight_id = ${storiesHighlights.id})`
			})
			.from(storiesHighlights)
			.where(whereClause)
			.orderBy(asc(storiesHighlights.position))
			.limit(limit)
			.offset(offset);

		// Get total count
		const [{ total }] = await db
			.select({ total: count() })
			.from(storiesHighlights)
			.where(whereClause);

		res.json({
			success: true,
			data: {
				highlights: highlights.map(h => toCamelCase(h)),
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit)
				}
			}
		});
	} catch (error) {
		console.error('[Stories] Error fetching highlights:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch highlights' });
	}
});

// PUT /api/admin/stories/highlights/reorder - Reorder highlights
// NOTE: This must come BEFORE /highlights/:id routes
router.put('/highlights/reorder', async (req: Request, res: Response) => {
	try {
		const { items } = req.body; // [{id: 1, position: 0}, {id: 2, position: 1}, ...]

		if (!Array.isArray(items)) {
			return res.status(400).json({ success: false, error: 'Items array required' });
		}

		// Update positions
		for (const item of items) {
			await db
				.update(storiesHighlights)
				.set({ position: item.position })
				.where(eq(storiesHighlights.id, item.id));
		}

		res.json({ success: true });
	} catch (error) {
		console.error('[Stories] Error reordering highlights:', error);
		res.status(500).json({ success: false, error: 'Failed to reorder highlights' });
	}
});

// PUT /api/admin/stories/highlights/bulk-status - Bulk enable/disable
// NOTE: This must come BEFORE /highlights/:id routes
router.put('/highlights/bulk-status', async (req: Request, res: Response) => {
	try {
		const { ids, isActive } = req.body;

		if (!Array.isArray(ids) || ids.length === 0) {
			return res.status(400).json({ success: false, error: 'IDs array required' });
		}

		if (typeof isActive !== 'boolean') {
			return res.status(400).json({ success: false, error: 'isActive boolean required' });
		}

		// Update all specified highlights
		for (const id of ids) {
			await db
				.update(storiesHighlights)
				.set({ is_active: isActive })
				.where(eq(storiesHighlights.id, id));
		}

		res.json({
			success: true,
			data: { updated: ids.length }
		});
	} catch (error) {
		console.error('[Stories] Error bulk updating highlights:', error);
		res.status(500).json({ success: false, error: 'Failed to update highlights' });
	}
});

// GET /api/admin/stories/highlights/:id - Get single highlight with items
router.get('/highlights/:id', async (req: Request, res: Response) => {
	try {
		const id = parseId(req.params.id);
		if (id === null) {
			return res.status(400).json({ success: false, error: 'Invalid highlight ID' });
		}

		const [highlight] = await db
			.select()
			.from(storiesHighlights)
			.where(eq(storiesHighlights.id, id));

		if (!highlight) {
			return res.status(404).json({ success: false, error: 'Highlight not found' });
		}

		// Get items
		const items = await db
			.select()
			.from(storiesItems)
			.where(eq(storiesItems.highlight_id, id))
			.orderBy(asc(storiesItems.position));

		res.json({
			success: true,
			data: {
				...toCamelCase(highlight),
				items: items.map(i => toCamelCase(i))
			}
		});
	} catch (error) {
		console.error('[Stories] Error fetching highlight:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch highlight' });
	}
});

// POST /api/admin/stories/highlights - Create highlight
router.post('/highlights', async (req: Request, res: Response) => {
	try {
		const { title, coverImage, isActive = true } = req.body;

		if (!title?.trim()) {
			return res.status(400).json({ success: false, error: 'Title is required' });
		}

		// Get max position
		const [maxPos] = await db
			.select({ maxPosition: sql<number>`COALESCE(MAX(position), -1)` })
			.from(storiesHighlights);

		const [highlight] = await db
			.insert(storiesHighlights)
			.values({
				title: title.trim(),
				cover_image: coverImage || null,
				position: (maxPos?.maxPosition ?? -1) + 1,
				is_active: isActive
			})
			.returning();

		res.status(201).json({
			success: true,
			data: toCamelCase(highlight)
		});
	} catch (error) {
		console.error('[Stories] Error creating highlight:', error);
		res.status(500).json({ success: false, error: 'Failed to create highlight' });
	}
});

// PUT /api/admin/stories/highlights/:id - Update highlight
router.put('/highlights/:id', async (req: Request, res: Response) => {
	try {
		const id = parseId(req.params.id);
		if (id === null) {
			return res.status(400).json({ success: false, error: 'Invalid highlight ID' });
		}
		const { title, coverImage, isActive } = req.body;

		const updateData: Record<string, any> = {};
		if (title !== undefined) updateData.title = title.trim();
		if (coverImage !== undefined) updateData.cover_image = coverImage;
		if (isActive !== undefined) updateData.is_active = isActive;

		if (Object.keys(updateData).length === 0) {
			return res.status(400).json({ success: false, error: 'No fields to update' });
		}

		const [updated] = await db
			.update(storiesHighlights)
			.set(updateData)
			.where(eq(storiesHighlights.id, id))
			.returning();

		if (!updated) {
			return res.status(404).json({ success: false, error: 'Highlight not found' });
		}

		res.json({
			success: true,
			data: toCamelCase(updated)
		});
	} catch (error) {
		console.error('[Stories] Error updating highlight:', error);
		res.status(500).json({ success: false, error: 'Failed to update highlight' });
	}
});

// DELETE /api/admin/stories/highlights/:id - Delete highlight
router.delete('/highlights/:id', async (req: Request, res: Response) => {
	try {
		const id = parseId(req.params.id);
		if (id === null) {
			return res.status(400).json({ success: false, error: 'Invalid highlight ID' });
		}

		// Delete associated media files (using safe deletion)
		const items = await db
			.select({ media_url: storiesItems.media_url, thumbnail_url: storiesItems.thumbnail_url })
			.from(storiesItems)
			.where(eq(storiesItems.highlight_id, id));

		for (const item of items) {
			safeDeleteFile(item.media_url);
			safeDeleteFile(item.thumbnail_url);
		}

		// Delete cover image
		const [highlight] = await db
			.select({ cover_image: storiesHighlights.cover_image })
			.from(storiesHighlights)
			.where(eq(storiesHighlights.id, id));

		safeDeleteFile(highlight?.cover_image ?? null);

		// Delete highlight (cascade deletes items)
		await db
			.delete(storiesHighlights)
			.where(eq(storiesHighlights.id, id));

		res.json({ success: true });
	} catch (error) {
		console.error('[Stories] Error deleting highlight:', error);
		res.status(500).json({ success: false, error: 'Failed to delete highlight' });
	}
});

// POST /api/admin/stories/highlights/:id/duplicate - Duplicate highlight
router.post('/highlights/:id/duplicate', async (req: Request, res: Response) => {
	try {
		const id = parseId(req.params.id);
		if (id === null) {
			return res.status(400).json({ success: false, error: 'Invalid highlight ID' });
		}

		// Get original highlight
		const [original] = await db
			.select()
			.from(storiesHighlights)
			.where(eq(storiesHighlights.id, id));

		if (!original) {
			return res.status(404).json({ success: false, error: 'Highlight not found' });
		}

		// Get original items
		const originalItems = await db
			.select()
			.from(storiesItems)
			.where(eq(storiesItems.highlight_id, id))
			.orderBy(asc(storiesItems.position));

		// Get max position
		const [maxPos] = await db
			.select({ maxPosition: sql<number>`COALESCE(MAX(position), -1)` })
			.from(storiesHighlights);

		// Create new highlight
		const [newHighlight] = await db
			.insert(storiesHighlights)
			.values({
				title: `${original.title} (копия)`,
				cover_image: original.cover_image,
				position: (maxPos?.maxPosition ?? -1) + 1,
				is_active: false // Start as inactive
			})
			.returning();

		// Duplicate items
		if (originalItems.length > 0) {
			await db.insert(storiesItems).values(
				originalItems.map(item => ({
					highlight_id: newHighlight.id,
					type: item.type,
					media_url: item.media_url,
					thumbnail_url: item.thumbnail_url,
					duration: item.duration,
					link_url: item.link_url,
					link_text: item.link_text,
					position: item.position,
					is_active: item.is_active
				}))
			);
		}

		res.status(201).json({
			success: true,
			data: toCamelCase(newHighlight)
		});
	} catch (error) {
		console.error('[Stories] Error duplicating highlight:', error);
		res.status(500).json({ success: false, error: 'Failed to duplicate highlight' });
	}
});

// =====================================================
// STORY ITEMS CRUD
// =====================================================

// GET /api/admin/stories/highlights/:highlightId/items - Get items for highlight
router.get('/highlights/:highlightId/items', async (req: Request, res: Response) => {
	try {
		const highlightId = parseId(req.params.highlightId);
		if (highlightId === null) {
			return res.status(400).json({ success: false, error: 'Invalid highlight ID' });
		}

		const items = await db
			.select()
			.from(storiesItems)
			.where(eq(storiesItems.highlight_id, highlightId))
			.orderBy(asc(storiesItems.position));

		res.json({
			success: true,
			data: items.map(i => toCamelCase(i))
		});
	} catch (error) {
		console.error('[Stories] Error fetching items:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch items' });
	}
});

// PUT /api/admin/stories/items/reorder - Reorder items within highlight
// NOTE: This must come BEFORE /items/:id routes
router.put('/items/reorder', async (req: Request, res: Response) => {
	try {
		const { items } = req.body; // [{id: 1, position: 0}, ...]

		if (!Array.isArray(items)) {
			return res.status(400).json({ success: false, error: 'Items array required' });
		}

		for (const item of items) {
			await db
				.update(storiesItems)
				.set({ position: item.position })
				.where(eq(storiesItems.id, item.id));
		}

		res.json({ success: true });
	} catch (error) {
		console.error('[Stories] Error reordering items:', error);
		res.status(500).json({ success: false, error: 'Failed to reorder items' });
	}
});

// POST /api/admin/stories/items - Create item
router.post('/items', async (req: Request, res: Response) => {
	try {
		const {
			highlightId,
			type,
			mediaUrl,
			thumbnailUrl,
			duration = 5,
			linkUrl,
			linkText,
			isActive = true
		} = req.body;

		if (!highlightId || !type || !mediaUrl) {
			return res.status(400).json({
				success: false,
				error: 'highlightId, type, and mediaUrl are required'
			});
		}

		// Validate highlight exists
		const [highlight] = await db
			.select({ id: storiesHighlights.id })
			.from(storiesHighlights)
			.where(eq(storiesHighlights.id, highlightId));

		if (!highlight) {
			return res.status(404).json({ success: false, error: 'Highlight not found' });
		}

		// Get max position
		const [maxPos] = await db
			.select({ maxPosition: sql<number>`COALESCE(MAX(position), -1)` })
			.from(storiesItems)
			.where(eq(storiesItems.highlight_id, highlightId));

		const [item] = await db
			.insert(storiesItems)
			.values({
				highlight_id: highlightId,
				type,
				media_url: mediaUrl,
				thumbnail_url: thumbnailUrl || null,
				duration,
				link_url: linkUrl || null,
				link_text: linkText || null,
				position: (maxPos?.maxPosition ?? -1) + 1,
				is_active: isActive
			})
			.returning();

		res.status(201).json({
			success: true,
			data: toCamelCase(item)
		});
	} catch (error) {
		console.error('[Stories] Error creating item:', error);
		res.status(500).json({ success: false, error: 'Failed to create item' });
	}
});

// PUT /api/admin/stories/items/:id - Update item
router.put('/items/:id', async (req: Request, res: Response) => {
	try {
		const id = parseId(req.params.id);
		if (id === null) {
			return res.status(400).json({ success: false, error: 'Invalid item ID' });
		}
		const { type, mediaUrl, thumbnailUrl, duration, linkUrl, linkText, isActive } = req.body;

		const updateData: Record<string, any> = {};
		if (type !== undefined) updateData.type = type;
		if (mediaUrl !== undefined) updateData.media_url = mediaUrl;
		if (thumbnailUrl !== undefined) updateData.thumbnail_url = thumbnailUrl;
		if (duration !== undefined) updateData.duration = duration;
		if (linkUrl !== undefined) updateData.link_url = linkUrl;
		if (linkText !== undefined) updateData.link_text = linkText;
		if (isActive !== undefined) updateData.is_active = isActive;

		if (Object.keys(updateData).length === 0) {
			return res.status(400).json({ success: false, error: 'No fields to update' });
		}

		const [updated] = await db
			.update(storiesItems)
			.set(updateData)
			.where(eq(storiesItems.id, id))
			.returning();

		if (!updated) {
			return res.status(404).json({ success: false, error: 'Item not found' });
		}

		res.json({
			success: true,
			data: toCamelCase(updated)
		});
	} catch (error) {
		console.error('[Stories] Error updating item:', error);
		res.status(500).json({ success: false, error: 'Failed to update item' });
	}
});

// DELETE /api/admin/stories/items/:id - Delete item
router.delete('/items/:id', async (req: Request, res: Response) => {
	try {
		const id = parseId(req.params.id);
		if (id === null) {
			return res.status(400).json({ success: false, error: 'Invalid item ID' });
		}

		// Get item to delete associated files
		const [item] = await db
			.select()
			.from(storiesItems)
			.where(eq(storiesItems.id, id));

		if (!item) {
			return res.status(404).json({ success: false, error: 'Item not found' });
		}

		// Delete media files (using safe deletion)
		safeDeleteFile(item.media_url);
		safeDeleteFile(item.thumbnail_url);

		await db.delete(storiesItems).where(eq(storiesItems.id, id));

		res.json({ success: true });
	} catch (error) {
		console.error('[Stories] Error deleting item:', error);
		res.status(500).json({ success: false, error: 'Failed to delete item' });
	}
});

// =====================================================
// MEDIA UPLOAD
// =====================================================

// POST /api/admin/stories/upload - Upload media file
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, error: 'No file uploaded' });
		}

		const file = req.file;
		const isVideo = file.mimetype.startsWith('video/');
		const timestamp = Date.now();
		const randomSuffix = Math.random().toString(36).substring(2, 8);

		// Get settings for WebP conversion
		const [settings] = await db.select().from(storiesSettings).where(eq(storiesSettings.id, 1));
		const autoConvertWebp = settings?.auto_convert_webp ?? true;
		const webpQuality = settings?.webp_quality ?? 85;

		let filename: string;
		let filePath: string;
		let thumbnailUrl: string | null = null;

		if (isVideo) {
			// Save video as-is
			const ext = path.extname(file.originalname) || '.mp4';
			filename = `story_${timestamp}_${randomSuffix}${ext}`;
			filePath = path.join(UPLOADS_DIR, filename);
			fs.writeFileSync(filePath, file.buffer);

			// Generate thumbnail placeholder (first frame extraction would require ffmpeg)
			// For now, we'll skip thumbnail generation for videos
			// Could be implemented later with fluent-ffmpeg
		} else {
			// Process image
			if (autoConvertWebp) {
				filename = `story_${timestamp}_${randomSuffix}.webp`;
				filePath = path.join(UPLOADS_DIR, filename);

				await sharp(file.buffer)
					.resize(1080, 1920, { fit: 'inside', withoutEnlargement: true })
					.webp({ quality: webpQuality })
					.toFile(filePath);
			} else {
				const ext = path.extname(file.originalname) || '.jpg';
				filename = `story_${timestamp}_${randomSuffix}${ext}`;
				filePath = path.join(UPLOADS_DIR, filename);

				await sharp(file.buffer)
					.resize(1080, 1920, { fit: 'inside', withoutEnlargement: true })
					.toFile(filePath);
			}
		}

		const mediaUrl = `/api/uploads/stories/${filename}`;
		const stats = fs.statSync(filePath);

		res.json({
			success: true,
			data: {
				url: mediaUrl,
				thumbnailUrl,
				filename,
				type: isVideo ? 'video' : 'photo',
				size: stats.size
			}
		});
	} catch (error) {
		console.error('[Stories] Error uploading media:', error);
		res.status(500).json({ success: false, error: 'Failed to upload media' });
	}
});

// =====================================================
// SETTINGS
// =====================================================

// GET /api/admin/stories/settings - Get settings
router.get('/settings', async (req: Request, res: Response) => {
	try {
		let [settings] = await db.select().from(storiesSettings).where(eq(storiesSettings.id, 1));

		// Initialize if not exists
		if (!settings) {
			[settings] = await db.insert(storiesSettings).values({ id: 1 }).returning();
		}

		// Parse gradient JSON
		const result = toCamelCase(settings) as any;
		if (result.borderGradient) {
			try {
				result.borderGradient = JSON.parse(result.borderGradient);
			} catch {
				result.borderGradient = null;
			}
		}

		res.json({
			success: true,
			data: result
		});
	} catch (error) {
		console.error('[Stories] Error fetching settings:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch settings' });
	}
});

// PUT /api/admin/stories/settings - Update settings
router.put('/settings', async (req: Request, res: Response) => {
	try {
		const {
			enabled,
			shape,
			borderWidth,
			borderColor,
			borderGradient,
			showTitle,
			titlePosition,
			highlightSize,
			maxVideoDuration,
			maxVideoSizeMb,
			autoConvertWebp,
			webpQuality
		} = req.body;

		const updateData: Record<string, any> = {};

		if (enabled !== undefined) updateData.enabled = enabled;
		if (shape !== undefined) updateData.shape = shape;
		if (borderWidth !== undefined) updateData.border_width = borderWidth;
		if (borderColor !== undefined) updateData.border_color = borderColor;
		if (borderGradient !== undefined) {
			updateData.border_gradient = borderGradient ? JSON.stringify(borderGradient) : null;
		}
		if (showTitle !== undefined) updateData.show_title = showTitle;
		if (titlePosition !== undefined) updateData.title_position = titlePosition;
		if (highlightSize !== undefined) updateData.highlight_size = highlightSize;
		if (maxVideoDuration !== undefined) updateData.max_video_duration = maxVideoDuration;
		if (maxVideoSizeMb !== undefined) updateData.max_video_size_mb = maxVideoSizeMb;
		if (autoConvertWebp !== undefined) updateData.auto_convert_webp = autoConvertWebp;
		if (webpQuality !== undefined) updateData.webp_quality = webpQuality;

		// Ensure settings row exists
		let [existing] = await db.select().from(storiesSettings).where(eq(storiesSettings.id, 1));
		if (!existing) {
			await db.insert(storiesSettings).values({ id: 1 });
		}

		const [updated] = await db
			.update(storiesSettings)
			.set(updateData)
			.where(eq(storiesSettings.id, 1))
			.returning();

		const result = toCamelCase(updated) as any;
		if (result.borderGradient) {
			try {
				result.borderGradient = JSON.parse(result.borderGradient);
			} catch {
				result.borderGradient = null;
			}
		}

		res.json({
			success: true,
			data: result
		});
	} catch (error) {
		console.error('[Stories] Error updating settings:', error);
		res.status(500).json({ success: false, error: 'Failed to update settings' });
	}
});

// =====================================================
// ANALYTICS
// =====================================================

// GET /api/admin/stories/analytics - Get overall analytics
router.get('/analytics', async (req: Request, res: Response) => {
	try {
		const days = parseInt(req.query.days as string) || 30;
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);
		const startDateStr = startDate.toISOString();

		// Total views
		const [totalViewsResult] = await db
			.select({ count: count() })
			.from(storiesViews)
			.where(gte(storiesViews.created_at, startDateStr));

		// Unique viewers
		const uniqueViewersResult = await db
			.selectDistinct({ user_id: storiesViews.user_id, session_id: storiesViews.session_id })
			.from(storiesViews)
			.where(gte(storiesViews.created_at, startDateStr));

		// Average view duration
		const [avgDurationResult] = await db
			.select({ avg: sql<number>`AVG(view_duration)` })
			.from(storiesViews)
			.where(gte(storiesViews.created_at, startDateStr));

		// Completion rate
		const [completedResult] = await db
			.select({ count: count() })
			.from(storiesViews)
			.where(and(
				gte(storiesViews.created_at, startDateStr),
				eq(storiesViews.completed, true)
			));

		// Link click rate
		const [clickedResult] = await db
			.select({ count: count() })
			.from(storiesViews)
			.where(and(
				gte(storiesViews.created_at, startDateStr),
				eq(storiesViews.link_clicked, true)
			));

		const totalViews = totalViewsResult?.count || 0;
		const completionRate = totalViews > 0 ? (completedResult?.count || 0) / totalViews * 100 : 0;
		const linkClickRate = totalViews > 0 ? (clickedResult?.count || 0) / totalViews * 100 : 0;

		// Views by day
		const viewsByDay = await db
			.select({
				date: sql<string>`DATE(created_at)`,
				views: count()
			})
			.from(storiesViews)
			.where(gte(storiesViews.created_at, startDateStr))
			.groupBy(sql`DATE(created_at)`)
			.orderBy(sql`DATE(created_at)`);

		// Top highlights
		const topHighlights = await db
			.select({
				id: storiesHighlights.id,
				title: storiesHighlights.title,
				views: count(storiesViews.id)
			})
			.from(storiesHighlights)
			.leftJoin(storiesItems, eq(storiesItems.highlight_id, storiesHighlights.id))
			.leftJoin(storiesViews, eq(storiesViews.story_item_id, storiesItems.id))
			.where(gte(storiesViews.created_at, startDateStr))
			.groupBy(storiesHighlights.id)
			.orderBy(desc(count(storiesViews.id)))
			.limit(5);

		res.json({
			success: true,
			data: {
				totalViews,
				uniqueViewers: uniqueViewersResult.length,
				avgViewDuration: avgDurationResult?.avg || 0,
				completionRate,
				linkClickRate,
				viewsByDay: viewsByDay.map(v => ({ date: v.date, views: v.views })),
				topHighlights: topHighlights.map(h => ({
					id: h.id,
					title: h.title,
					views: h.views
				}))
			}
		});
	} catch (error) {
		console.error('[Stories] Error fetching analytics:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
	}
});

// GET /api/admin/stories/analytics/:highlightId - Get analytics for specific highlight
router.get('/analytics/:highlightId', async (req: Request, res: Response) => {
	try {
		const highlightId = parseId(req.params.highlightId);
		if (highlightId === null) {
			return res.status(400).json({ success: false, error: 'Invalid highlight ID' });
		}
		const days = parseInt(req.query.days as string) || 30;
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);
		const startDateStr = startDate.toISOString();

		// Get highlight info
		const [highlight] = await db
			.select()
			.from(storiesHighlights)
			.where(eq(storiesHighlights.id, highlightId));

		if (!highlight) {
			return res.status(404).json({ success: false, error: 'Highlight not found' });
		}

		// Get items with their analytics
		const items = await db
			.select({
				id: storiesItems.id,
				type: storiesItems.type,
				media_url: storiesItems.media_url,
				views: count(storiesViews.id),
				avgDuration: sql<number>`AVG(${storiesViews.view_duration})`,
				completions: sql<number>`SUM(CASE WHEN ${storiesViews.completed} = 1 THEN 1 ELSE 0 END)`,
				linkClicks: sql<number>`SUM(CASE WHEN ${storiesViews.link_clicked} = 1 THEN 1 ELSE 0 END)`
			})
			.from(storiesItems)
			.leftJoin(storiesViews, and(
				eq(storiesViews.story_item_id, storiesItems.id),
				gte(storiesViews.created_at, startDateStr)
			))
			.where(eq(storiesItems.highlight_id, highlightId))
			.groupBy(storiesItems.id)
			.orderBy(asc(storiesItems.position));

		const totalViews = items.reduce((sum, item) => sum + (item.views || 0), 0);
		const totalCompletions = items.reduce((sum, item) => sum + (item.completions || 0), 0);
		const totalClicks = items.reduce((sum, item) => sum + (item.linkClicks || 0), 0);

		res.json({
			success: true,
			data: {
				highlightId,
				title: highlight.title,
				totalViews,
				completionRate: totalViews > 0 ? totalCompletions / totalViews * 100 : 0,
				linkClickRate: totalViews > 0 ? totalClicks / totalViews * 100 : 0,
				itemsAnalytics: items.map(item => ({
					itemId: item.id,
					type: item.type,
					mediaUrl: item.media_url,
					views: item.views || 0,
					avgDuration: item.avgDuration || 0,
					completionRate: item.views > 0 ? (item.completions || 0) / item.views * 100 : 0,
					linkClicks: item.linkClicks || 0
				}))
			}
		});
	} catch (error) {
		console.error('[Stories] Error fetching highlight analytics:', error);
		res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
	}
});

export default router;
