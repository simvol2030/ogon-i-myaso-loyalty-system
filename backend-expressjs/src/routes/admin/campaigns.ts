/**
 * Admin API: Campaigns Management (рассылки)
 * CRUD операции + отправка кампаний
 *
 * ROUTE ORDERING: Static routes MUST come before parametric routes (/:id)
 */

import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { authenticateSession, requireRole } from '../../middleware/session-auth';
import {
	getAllCampaigns,
	getCampaignsCount,
	getCampaignById,
	createCampaign,
	updateCampaign,
	deleteCampaign,
	cancelCampaign,
	getCampaignRecipients,
	getCampaignRecipientsStats
} from '../../db/queries/campaigns';
import {
	startCampaign,
	scheduleCampaign
} from '../../services/campaignService';
import { getSegmentCount, type SegmentFilters } from '../../services/segmentationService';
import { createCampaignImage, getAllCampaignImages, deleteCampaignImage, getCampaignImageById } from '../../db/queries/campaignImages';
import { safeJsonParse, validatePagination } from '../../utils/helpers';

const router = Router();

// Uploads directory
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'campaigns');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
	fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer configuration
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
	fileFilter: (req, file, cb) => {
		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('Разрешены только изображения (JPEG, PNG, WebP, GIF)'));
		}
	}
});

// 🔒 All routes require authentication
router.use(authenticateSession);

// ==================== STATIC ROUTES FIRST ====================
// These must be defined BEFORE parametric routes like /:id

/**
 * POST /api/admin/campaigns/preview-audience - Превью аудитории
 */
router.post('/preview-audience', async (req, res) => {
	try {
		const { targetType, targetFilters } = req.body;

		let count = 0;

		if (targetType === 'all') {
			count = await getSegmentCount({});
		} else if (targetFilters) {
			count = await getSegmentCount(targetFilters as SegmentFilters);
		}

		res.json({
			success: true,
			data: { count }
		});
	} catch (error: any) {
		console.error('Error previewing audience:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/admin/campaigns/images - Список изображений
 */
router.get('/images', async (req, res) => {
	try {
		const { page, limit, offset } = validatePagination(
			req.query.page as string,
			req.query.limit as string
		);

		const images = await getAllCampaignImages({ limit, offset });

		res.json({
			success: true,
			data: {
				images: images.map(img => ({
					id: img.id,
					url: `/api/uploads/campaigns/${img.filename}`,
					filename: img.filename,
					originalName: img.original_name,
					size: img.size,
					createdAt: img.created_at
				}))
			}
		});
	} catch (error: any) {
		console.error('Error fetching campaign images:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/campaigns/images/upload - Загрузить изображение
 * ONLY: super-admin, editor
 */
router.post('/images/upload', requireRole('super-admin', 'editor'), upload.single('image'), async (req, res) => {
	try {
		const file = req.file;

		if (!file) {
			return res.status(400).json({ success: false, error: 'Файл не загружен' });
		}

		// Generate unique filename
		const timestamp = Date.now();
		const randomSuffix = Math.random().toString(36).substring(2, 8);
		const filename = `campaign_${timestamp}_${randomSuffix}.webp`;
		const filepath = path.join(UPLOADS_DIR, filename);

		// Process image with sharp
		await sharp(file.buffer)
			.resize(1280, 1280, {
				fit: 'inside',
				withoutEnlargement: true
			})
			.webp({ quality: 85 })
			.toFile(filepath);

		// Get file size
		const stats = fs.statSync(filepath);

		// Save to DB
		const image = await createCampaignImage({
			filename,
			original_name: file.originalname,
			mime_type: 'image/webp',
			size: stats.size
		});

		const imageUrl = `/api/uploads/campaigns/${filename}`;

		res.status(201).json({
			success: true,
			data: {
				id: image.id,
				url: imageUrl,
				filename
			}
		});
	} catch (error: any) {
		console.error('Error uploading campaign image:', error);
		res.status(500).json({ success: false, error: error.message || 'Internal server error' });
	}
});

/**
 * DELETE /api/admin/campaigns/images/:imageId - Удалить изображение
 * ONLY: super-admin
 */
router.delete('/images/:imageId', requireRole('super-admin'), async (req, res) => {
	try {
		const imageId = parseInt(req.params.imageId);

		if (isNaN(imageId)) {
			return res.status(400).json({ success: false, error: 'Invalid image ID' });
		}

		const image = await getCampaignImageById(imageId);

		if (!image) {
			return res.status(404).json({ success: false, error: 'Изображение не найдено' });
		}

		// Delete file
		const filepath = path.join(UPLOADS_DIR, image.filename);
		if (fs.existsSync(filepath)) {
			fs.unlinkSync(filepath);
		}

		// Delete from DB
		await deleteCampaignImage(imageId);

		res.json({ success: true, message: 'Изображение удалено' });
	} catch (error: any) {
		console.error('Error deleting campaign image:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

// ==================== CAMPAIGNS LIST & CREATE ====================

/**
 * GET /api/admin/campaigns - Список кампаний
 */
router.get('/', async (req, res) => {
	try {
		const { status } = req.query;
		const { page, limit, offset } = validatePagination(
			req.query.page as string,
			req.query.limit as string
		);

		const campaigns = await getAllCampaigns({
			status: status as string | undefined,
			limit,
			offset
		});

		const total = await getCampaignsCount(status as string | undefined);

		res.json({
			success: true,
			data: {
				campaigns: campaigns.map(c => ({
					id: c.id,
					title: c.title,
					messageText: c.message_text,
					messageImage: c.message_image,
					buttonText: c.button_text,
					buttonUrl: c.button_url,
					offerId: c.offer_id,
					targetType: c.target_type,
					targetFilters: safeJsonParse(c.target_filters, null),
					triggerType: c.trigger_type,
					triggerConfig: safeJsonParse(c.trigger_config, null),
					status: c.status,
					scheduledAt: c.scheduled_at,
					startedAt: c.started_at,
					completedAt: c.completed_at,
					totalRecipients: c.total_recipients,
					sentCount: c.sent_count,
					deliveredCount: c.delivered_count,
					failedCount: c.failed_count,
					createdAt: c.created_at,
					updatedAt: c.updated_at
				})),
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit)
				}
			}
		});
	} catch (error: any) {
		console.error('Error fetching campaigns:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/campaigns - Создать кампанию
 * ONLY: super-admin, editor
 */
router.post('/', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const {
			title,
			messageText,
			messageImage,
			buttonText,
			buttonUrl,
			offerId,
			targetType = 'all',
			targetFilters,
			triggerType = 'manual',
			triggerConfig,
			scheduledAt
		} = req.body;

		// Validation
		if (!title || !messageText) {
			return res.status(400).json({
				success: false,
				error: 'Название и текст сообщения обязательны'
			});
		}

		const campaign = await createCampaign({
			title,
			message_text: messageText,
			message_image: messageImage || null,
			button_text: buttonText || null,
			button_url: buttonUrl || null,
			offer_id: offerId || null,
			target_type: targetType,
			target_filters: targetFilters ? JSON.stringify(targetFilters) : null,
			trigger_type: triggerType,
			trigger_config: triggerConfig ? JSON.stringify(triggerConfig) : null,
			status: scheduledAt ? 'scheduled' : 'draft',
			scheduled_at: scheduledAt || null,
			created_by: (req as any).admin?.id || null
		});

		res.status(201).json({
			success: true,
			data: {
				id: campaign.id,
				title: campaign.title,
				status: campaign.status,
				createdAt: campaign.created_at
			}
		});
	} catch (error: any) {
		console.error('Error creating campaign:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

// ==================== PARAMETRIC ROUTES LAST ====================
// These must be defined AFTER static routes

/**
 * GET /api/admin/campaigns/:id - Получить кампанию
 */
router.get('/:id', async (req, res) => {
	try {
		const campaignId = parseInt(req.params.id);

		if (isNaN(campaignId)) {
			return res.status(400).json({ success: false, error: 'Invalid campaign ID' });
		}

		const campaign = await getCampaignById(campaignId);

		if (!campaign) {
			return res.status(404).json({ success: false, error: 'Кампания не найдена' });
		}

		// Получаем статистику получателей
		const recipientStats = await getCampaignRecipientsStats(campaignId);

		res.json({
			success: true,
			data: {
				id: campaign.id,
				title: campaign.title,
				messageText: campaign.message_text,
				messageImage: campaign.message_image,
				buttonText: campaign.button_text,
				buttonUrl: campaign.button_url,
				offerId: campaign.offer_id,
				targetType: campaign.target_type,
				targetFilters: safeJsonParse(campaign.target_filters, null),
				triggerType: campaign.trigger_type,
				triggerConfig: safeJsonParse(campaign.trigger_config, null),
				status: campaign.status,
				scheduledAt: campaign.scheduled_at,
				startedAt: campaign.started_at,
				completedAt: campaign.completed_at,
				stats: {
					totalRecipients: campaign.total_recipients,
					sentCount: campaign.sent_count,
					deliveredCount: campaign.delivered_count,
					failedCount: campaign.failed_count,
					...recipientStats
				},
				createdAt: campaign.created_at,
				updatedAt: campaign.updated_at
			}
		});
	} catch (error: any) {
		console.error('Error fetching campaign:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/campaigns/:id - Обновить кампанию
 * ONLY: super-admin, editor
 */
router.put('/:id', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const campaignId = parseInt(req.params.id);

		if (isNaN(campaignId)) {
			return res.status(400).json({ success: false, error: 'Invalid campaign ID' });
		}

		const campaign = await getCampaignById(campaignId);

		if (!campaign) {
			return res.status(404).json({ success: false, error: 'Кампания не найдена' });
		}

		if (campaign.status !== 'draft') {
			return res.status(400).json({
				success: false,
				error: 'Можно редактировать только черновики'
			});
		}

		const {
			title,
			messageText,
			messageImage,
			buttonText,
			buttonUrl,
			offerId,
			targetType,
			targetFilters,
			triggerType,
			triggerConfig
		} = req.body;

		const updated = await updateCampaign(campaignId, {
			title,
			message_text: messageText,
			message_image: messageImage,
			button_text: buttonText,
			button_url: buttonUrl,
			offer_id: offerId,
			target_type: targetType,
			target_filters: targetFilters ? JSON.stringify(targetFilters) : null,
			trigger_type: triggerType,
			trigger_config: triggerConfig ? JSON.stringify(triggerConfig) : null
		});

		res.json({
			success: true,
			data: { id: updated?.id, updatedAt: updated?.updated_at }
		});
	} catch (error: any) {
		console.error('Error updating campaign:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * DELETE /api/admin/campaigns/:id - Удалить кампанию
 * ONLY: super-admin
 */
router.delete('/:id', requireRole('super-admin'), async (req, res) => {
	try {
		const campaignId = parseInt(req.params.id);

		if (isNaN(campaignId)) {
			return res.status(400).json({ success: false, error: 'Invalid campaign ID' });
		}

		const campaign = await getCampaignById(campaignId);

		if (!campaign) {
			return res.status(404).json({ success: false, error: 'Кампания не найдена' });
		}

		if (campaign.status === 'sending') {
			return res.status(400).json({
				success: false,
				error: 'Нельзя удалить кампанию во время отправки'
			});
		}

		await deleteCampaign(campaignId);

		res.json({ success: true, message: 'Кампания удалена' });
	} catch (error: any) {
		console.error('Error deleting campaign:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/campaigns/:id/send - Запустить отправку
 * ONLY: super-admin, editor
 */
router.post('/:id/send', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const campaignId = parseInt(req.params.id);

		if (isNaN(campaignId)) {
			return res.status(400).json({ success: false, error: 'Invalid campaign ID' });
		}

		const result = await startCampaign(campaignId);

		if (!result.success) {
			return res.status(400).json({ success: false, error: result.error });
		}

		// Get campaign stats after sending
		const campaign = await getCampaignById(campaignId);
		const sent = campaign?.delivered_count || 0;
		const failed = campaign?.failed_count || 0;

		res.json({
			success: true,
			message: 'Рассылка завершена',
			data: {
				sent,
				failed,
				total: campaign?.total_recipients || 0
			}
		});
	} catch (error: any) {
		console.error('Error starting campaign:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/campaigns/:id/schedule - Запланировать отправку
 * ONLY: super-admin, editor
 */
router.post('/:id/schedule', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const campaignId = parseInt(req.params.id);

		if (isNaN(campaignId)) {
			return res.status(400).json({ success: false, error: 'Invalid campaign ID' });
		}

		const { scheduledAt } = req.body;

		if (!scheduledAt) {
			return res.status(400).json({
				success: false,
				error: 'Укажите дату и время отправки'
			});
		}

		const result = await scheduleCampaign(campaignId, scheduledAt);

		if (!result.success) {
			return res.status(400).json({ success: false, error: result.error });
		}

		res.json({
			success: true,
			message: 'Рассылка запланирована'
		});
	} catch (error: any) {
		console.error('Error scheduling campaign:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/campaigns/:id/cancel - Отменить кампанию
 * ONLY: super-admin, editor
 */
router.post('/:id/cancel', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const campaignId = parseInt(req.params.id);

		if (isNaN(campaignId)) {
			return res.status(400).json({ success: false, error: 'Invalid campaign ID' });
		}

		const campaign = await getCampaignById(campaignId);

		if (!campaign) {
			return res.status(404).json({ success: false, error: 'Кампания не найдена' });
		}

		if (campaign.status === 'completed' || campaign.status === 'cancelled') {
			return res.status(400).json({
				success: false,
				error: 'Кампания уже завершена или отменена'
			});
		}

		await cancelCampaign(campaignId);

		res.json({
			success: true,
			message: 'Кампания отменена'
		});
	} catch (error: any) {
		console.error('Error cancelling campaign:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/admin/campaigns/:id/recipients - Получатели кампании
 */
router.get('/:id/recipients', async (req, res) => {
	try {
		const campaignId = parseInt(req.params.id);

		if (isNaN(campaignId)) {
			return res.status(400).json({ success: false, error: 'Invalid campaign ID' });
		}

		const { status } = req.query;
		const { page, limit, offset } = validatePagination(
			req.query.page as string,
			req.query.limit as string,
			50
		);

		const recipients = await getCampaignRecipients(campaignId, {
			status: status as string | undefined,
			limit,
			offset
		});

		const stats = await getCampaignRecipientsStats(campaignId);

		res.json({
			success: true,
			data: {
				recipients: recipients.map(r => ({
					id: r.id,
					userId: r.loyalty_user_id,
					userName: [r.user_first_name, r.user_last_name].filter(Boolean).join(' ') || 'Без имени',
					status: r.status,
					sentAt: r.sent_at,
					error: r.error_message
				})),
				stats,
				pagination: {
					page,
					limit,
					total: stats.total,
					totalPages: Math.ceil(stats.total / limit)
				}
			}
		});
	} catch (error: any) {
		console.error('Error fetching recipients:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

export default router;
