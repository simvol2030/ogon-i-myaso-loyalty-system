/**
 * Admin API: Welcome Messages Management
 * Управление приветственными сообщениями Telegram бота
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { authenticateSession, requireRole } from '../../middleware/session-auth';
import {
	getAllWelcomeMessages,
	getActiveWelcomeMessages,
	getWelcomeMessageById,
	createWelcomeMessage,
	updateWelcomeMessage,
	deleteWelcomeMessage,
	reorderWelcomeMessages
} from '../../db/queries/welcomeMessages';

const router = Router();

// =====================================================
// UPLOAD CONFIGURATION
// =====================================================

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'welcome-messages');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
	fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
	storage,
	limits: {
		fileSize: 10 * 1024 * 1024 // 10MB max for images
	},
	fileFilter: (req, file, cb) => {
		const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

		if (allowedImageTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('Invalid file type. Allowed: JPEG, PNG, WebP, GIF'));
		}
	}
});

/**
 * Safely delete a media file - prevents path traversal attacks
 */
function safeDeleteFile(mediaUrl: string | null): void {
	if (!mediaUrl) return;

	// Only process URLs that start with /api/uploads/welcome-messages/
	if (!mediaUrl.startsWith('/api/uploads/welcome-messages/')) {
		console.warn('[Welcome Messages] Attempted to delete file outside welcome-messages folder:', mediaUrl);
		return;
	}

	// Extract just the filename (no path components)
	const filename = path.basename(mediaUrl);
	if (!filename || filename.includes('..')) {
		console.warn('[Welcome Messages] Invalid filename:', filename);
		return;
	}

	const filePath = path.join(UPLOADS_DIR, filename);

	// Verify the resolved path is within UPLOADS_DIR
	const resolvedPath = path.resolve(filePath);
	const resolvedUploadsDir = path.resolve(UPLOADS_DIR);

	if (!resolvedPath.startsWith(resolvedUploadsDir)) {
		console.warn('[Welcome Messages] Path traversal attempt blocked:', mediaUrl);
		return;
	}

	if (fs.existsSync(resolvedPath)) {
		fs.unlinkSync(resolvedPath);
		console.log('[Welcome Messages] Deleted file:', resolvedPath);
	}
}

// 🔒 All routes require authentication
router.use(authenticateSession);

/**
 * GET /api/admin/welcome-messages - получить все сообщения
 */
router.get('/', async (req, res) => {
	try {
		const messages = await getAllWelcomeMessages();
		res.json({ success: true, data: messages });
	} catch (error) {
		console.error('[WELCOME MESSAGES API] Error fetching messages:', error);
		res.status(500).json({ success: false, error: 'Ошибка получения сообщений' });
	}
});

/**
 * GET /api/admin/welcome-messages/active - получить активные сообщения (для предпросмотра)
 */
router.get('/active', async (req, res) => {
	try {
		const messages = await getActiveWelcomeMessages();
		res.json({ success: true, data: messages });
	} catch (error) {
		console.error('[WELCOME MESSAGES API] Error fetching active messages:', error);
		res.status(500).json({ success: false, error: 'Ошибка получения активных сообщений' });
	}
});

/**
 * GET /api/admin/welcome-messages/:id - получить сообщение по ID
 */
router.get('/:id', async (req, res) => {
	const id = parseInt(req.params.id);

	if (isNaN(id)) {
		return res.status(400).json({ success: false, error: 'Некорректный ID' });
	}

	try {
		const message = await getWelcomeMessageById(id);

		if (!message) {
			return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
		}

		res.json({ success: true, data: message });
	} catch (error) {
		console.error('[WELCOME MESSAGES API] Error fetching message:', error);
		res.status(500).json({ success: false, error: 'Ошибка получения сообщения' });
	}
});

/**
 * POST /api/admin/welcome-messages - создать новое сообщение
 */
router.post('/', requireRole('super-admin', 'editor'), async (req, res) => {
	const { message_text, message_image, button_text, button_url, delay_seconds, is_active, order_number } = req.body;

	// Валидация
	if (!message_text || typeof message_text !== 'string' || message_text.trim().length === 0) {
		return res.status(400).json({ success: false, error: 'Текст сообщения обязателен' });
	}

	if (order_number === undefined || typeof order_number !== 'number') {
		return res.status(400).json({ success: false, error: 'Порядковый номер обязателен' });
	}

	if (delay_seconds !== undefined && (typeof delay_seconds !== 'number' || delay_seconds < 0)) {
		return res.status(400).json({ success: false, error: 'Задержка должна быть неотрицательным числом' });
	}

	try {
		const newMessage = await createWelcomeMessage({
			message_text: message_text.trim(),
			message_image: message_image || null,
			button_text: button_text || null,
			button_url: button_url || null,
			delay_seconds: delay_seconds ?? 1,
			is_active: is_active ?? true,
			order_number
		});

		res.status(201).json({
			success: true,
			data: newMessage,
			message: 'Сообщение создано'
		});
	} catch (error) {
		console.error('[WELCOME MESSAGES API] Error creating message:', error);
		res.status(500).json({ success: false, error: 'Ошибка создания сообщения' });
	}
});

/**
 * PUT /api/admin/welcome-messages/:id - обновить сообщение
 */
router.put('/:id', requireRole('super-admin', 'editor'), async (req, res) => {
	const id = parseInt(req.params.id);
	const { message_text, message_image, button_text, button_url, delay_seconds, is_active, order_number } = req.body;

	if (isNaN(id)) {
		return res.status(400).json({ success: false, error: 'Некорректный ID' });
	}

	try {
		const existingMessage = await getWelcomeMessageById(id);
		if (!existingMessage) {
			return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
		}

		const updateData: {
			message_text?: string;
			message_image?: string | null;
			button_text?: string | null;
			button_url?: string | null;
			delay_seconds?: number;
			is_active?: boolean;
			order_number?: number;
		} = {};

		// Валидация и подготовка данных для обновления
		if (message_text !== undefined) {
			if (typeof message_text !== 'string' || message_text.trim().length === 0) {
				return res.status(400).json({ success: false, error: 'Текст сообщения не может быть пустым' });
			}
			updateData.message_text = message_text.trim();
		}

		if (message_image !== undefined) {
			updateData.message_image = message_image || null;
		}

		if (button_text !== undefined) {
			updateData.button_text = button_text || null;
		}

		if (button_url !== undefined) {
			updateData.button_url = button_url || null;
		}

		if (delay_seconds !== undefined) {
			if (typeof delay_seconds !== 'number' || delay_seconds < 0) {
				return res.status(400).json({ success: false, error: 'Задержка должна быть неотрицательным числом' });
			}
			updateData.delay_seconds = delay_seconds;
		}

		if (is_active !== undefined) {
			if (typeof is_active !== 'boolean') {
				return res.status(400).json({ success: false, error: 'Некорректное значение статуса' });
			}
			updateData.is_active = is_active;
		}

		if (order_number !== undefined) {
			if (typeof order_number !== 'number') {
				return res.status(400).json({ success: false, error: 'Порядковый номер должен быть числом' });
			}
			updateData.order_number = order_number;
		}

		if (Object.keys(updateData).length === 0) {
			return res.status(400).json({ success: false, error: 'Нет данных для обновления' });
		}

		const updatedMessage = await updateWelcomeMessage(id, updateData);

		res.json({
			success: true,
			data: updatedMessage,
			message: 'Сообщение обновлено'
		});
	} catch (error) {
		console.error('[WELCOME MESSAGES API] Error updating message:', error);
		res.status(500).json({ success: false, error: 'Ошибка обновления сообщения' });
	}
});

/**
 * DELETE /api/admin/welcome-messages/:id - удалить сообщение
 */
router.delete('/:id', requireRole('super-admin'), async (req, res) => {
	const id = parseInt(req.params.id);

	if (isNaN(id)) {
		return res.status(400).json({ success: false, error: 'Некорректный ID' });
	}

	try {
		const existingMessage = await getWelcomeMessageById(id);
		if (!existingMessage) {
			return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
		}

		// Delete associated image file if it's a local upload
		if (existingMessage.message_image?.startsWith('/api/uploads/welcome-messages/')) {
			safeDeleteFile(existingMessage.message_image);
		}

		await deleteWelcomeMessage(id);

		res.json({ success: true, message: 'Сообщение удалено' });
	} catch (error) {
		console.error('[WELCOME MESSAGES API] Error deleting message:', error);
		res.status(500).json({ success: false, error: 'Ошибка удаления сообщения' });
	}
});

/**
 * PUT /api/admin/welcome-messages/reorder - изменить порядок сообщений
 * Body: { updates: [{ id: 1, order_number: 1 }, { id: 2, order_number: 2 }, ...] }
 */
router.put('/reorder', requireRole('super-admin', 'editor'), async (req, res) => {
	const { updates } = req.body;

	if (!Array.isArray(updates)) {
		return res.status(400).json({ success: false, error: 'Неверный формат данных' });
	}

	// Валидация структуры
	for (const update of updates) {
		if (!update.id || typeof update.id !== 'number' || !update.order_number || typeof update.order_number !== 'number') {
			return res.status(400).json({ success: false, error: 'Каждый элемент должен содержать id и order_number' });
		}
	}

	try {
		await reorderWelcomeMessages(updates);
		res.json({ success: true, message: 'Порядок сообщений обновлён' });
	} catch (error) {
		console.error('[WELCOME MESSAGES API] Error reordering messages:', error);
		res.status(500).json({ success: false, error: 'Ошибка изменения порядка' });
	}
});

// =====================================================
// MEDIA UPLOAD
// =====================================================

/**
 * POST /api/admin/welcome-messages/upload - Upload image for welcome message
 */
router.post('/upload', requireRole('super-admin', 'editor'), upload.single('file'), async (req: Request, res: Response) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, error: 'No file uploaded' });
		}

		const file = req.file;
		const timestamp = Date.now();
		const randomSuffix = Math.random().toString(36).substring(2, 8);

		// Process image and save
		const filename = `welcome_${timestamp}_${randomSuffix}.webp`;
		const filePath = path.join(UPLOADS_DIR, filename);

		// Resize and convert to WebP for better quality/size ratio
		await sharp(file.buffer)
			.resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 85 })
			.toFile(filePath);

		const mediaUrl = `/api/uploads/welcome-messages/${filename}`;
		const stats = fs.statSync(filePath);

		res.json({
			success: true,
			data: {
				url: mediaUrl,
				filename,
				size: stats.size
			}
		});
	} catch (error) {
		console.error('[WELCOME MESSAGES API] Error uploading image:', error);
		res.status(500).json({ success: false, error: 'Failed to upload image' });
	}
});

export default router;
