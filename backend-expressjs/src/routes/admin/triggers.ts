/**
 * Admin API: Trigger Templates Management (триггеры рассылок)
 * CRUD операции для настройки автоматических триггеров
 */

import { Router } from 'express';
import { authenticateSession, requireRole } from '../../middleware/session-auth';
import {
	getAllTriggerTemplates,
	getTriggerTemplateById,
	createTriggerTemplate,
	updateTriggerTemplate,
	deleteTriggerTemplate,
	toggleTriggerTemplate,
	getTriggerLogs,
	getTriggerLogsStats
} from '../../db/queries/triggerTemplates';

const router = Router();

// 🔒 All routes require authentication
router.use(authenticateSession);

// Event type descriptions for UI
const EVENT_TYPE_INFO: Record<string, { name: string; description: string; configFields: string[] }> = {
	manual: {
		name: 'Ручной запуск',
		description: 'Триггер активируется вручную',
		configFields: []
	},
	scheduled: {
		name: 'По расписанию',
		description: 'Одноразовая отправка в указанное время',
		configFields: ['datetime']
	},
	recurring: {
		name: 'Повторяющийся',
		description: 'Регулярная отправка по cron-расписанию',
		configFields: ['cron', 'timezone']
	},
	offer_created: {
		name: 'Создана акция',
		description: 'Срабатывает при создании новой акции',
		configFields: []
	},
	inactive_days: {
		name: 'Неактивность',
		description: 'Клиент не заходил N дней',
		configFields: ['days']
	},
	balance_reached: {
		name: 'Баланс достиг',
		description: 'Баланс клиента достиг указанной суммы',
		configFields: ['min_balance']
	},
	balance_low: {
		name: 'Низкий баланс',
		description: 'Баланс клиента ниже указанной суммы',
		configFields: ['max_balance']
	},
	birthday: {
		name: 'День рождения',
		description: 'В день рождения клиента',
		configFields: ['days_before']
	},
	registration_anniversary: {
		name: 'Годовщина регистрации',
		description: 'N лет с момента регистрации',
		configFields: ['years']
	},
	first_purchase: {
		name: 'Первая покупка',
		description: 'После первой покупки клиента',
		configFields: []
	},
	purchase_milestone: {
		name: 'Юбилейная покупка',
		description: 'N-ая покупка клиента (10, 50, 100...)',
		configFields: ['count']
	}
};

/**
 * GET /api/admin/triggers/event-types - Получить типы событий
 */
router.get('/event-types', (req, res) => {
	res.json({
		success: true,
		data: Object.entries(EVENT_TYPE_INFO).map(([type, info]) => ({
			type,
			...info
		}))
	});
});

/**
 * GET /api/admin/triggers - Список триггеров
 */
router.get('/', async (req, res) => {
	try {
		const { isActive } = req.query;

		const triggers = await getAllTriggerTemplates({
			isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
		});

		res.json({
			success: true,
			data: {
				triggers: triggers.map(t => ({
					id: t.id,
					name: t.name,
					description: t.description,
					eventType: t.event_type,
					eventTypeName: EVENT_TYPE_INFO[t.event_type]?.name || t.event_type,
					eventConfig: t.event_config ? JSON.parse(t.event_config) : null,
					messageTemplate: t.message_template,
					imageUrl: t.image_url,
					buttonText: t.button_text,
					buttonUrl: t.button_url,
					isActive: t.is_active,
					autoSend: t.auto_send,
					createdAt: t.created_at,
					updatedAt: t.updated_at
				}))
			}
		});
	} catch (error: any) {
		console.error('Error fetching triggers:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/admin/triggers/:id - Получить триггер
 */
router.get('/:id', async (req, res) => {
	try {
		const triggerId = parseInt(req.params.id);
		const trigger = await getTriggerTemplateById(triggerId);

		if (!trigger) {
			return res.status(404).json({ success: false, error: 'Триггер не найден' });
		}

		// Получаем статистику логов
		const logsStats = await getTriggerLogsStats(triggerId);

		res.json({
			success: true,
			data: {
				id: trigger.id,
				name: trigger.name,
				description: trigger.description,
				eventType: trigger.event_type,
				eventTypeName: EVENT_TYPE_INFO[trigger.event_type]?.name || trigger.event_type,
				eventConfig: trigger.event_config ? JSON.parse(trigger.event_config) : null,
				messageTemplate: trigger.message_template,
				imageUrl: trigger.image_url,
				buttonText: trigger.button_text,
				buttonUrl: trigger.button_url,
				isActive: trigger.is_active,
				autoSend: trigger.auto_send,
				stats: logsStats,
				createdAt: trigger.created_at,
				updatedAt: trigger.updated_at
			}
		});
	} catch (error: any) {
		console.error('Error fetching trigger:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/triggers - Создать триггер
 * ONLY: super-admin, editor
 */
router.post('/', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const {
			name,
			description,
			eventType,
			eventConfig,
			messageTemplate,
			imageUrl,
			buttonText,
			buttonUrl,
			isActive = true,
			autoSend = false
		} = req.body;

		// Validation
		if (!name || !eventType || !messageTemplate) {
			return res.status(400).json({
				success: false,
				error: 'Название, тип события и шаблон сообщения обязательны'
			});
		}

		// Validate event type
		if (!EVENT_TYPE_INFO[eventType]) {
			return res.status(400).json({
				success: false,
				error: 'Неизвестный тип события'
			});
		}

		const trigger = await createTriggerTemplate({
			name,
			description: description || null,
			event_type: eventType,
			event_config: eventConfig ? JSON.stringify(eventConfig) : null,
			message_template: messageTemplate,
			image_url: imageUrl || null,
			button_text: buttonText || null,
			button_url: buttonUrl || null,
			is_active: isActive,
			auto_send: autoSend
		});

		res.status(201).json({
			success: true,
			data: {
				id: trigger.id,
				name: trigger.name,
				eventType: trigger.event_type,
				isActive: trigger.is_active,
				createdAt: trigger.created_at
			}
		});
	} catch (error: any) {
		console.error('Error creating trigger:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/triggers/:id - Обновить триггер
 * ONLY: super-admin, editor
 */
router.put('/:id', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const triggerId = parseInt(req.params.id);
		const trigger = await getTriggerTemplateById(triggerId);

		if (!trigger) {
			return res.status(404).json({ success: false, error: 'Триггер не найден' });
		}

		const {
			name,
			description,
			eventType,
			eventConfig,
			messageTemplate,
			imageUrl,
			buttonText,
			buttonUrl,
			isActive,
			autoSend
		} = req.body;

		// Validate event type if provided
		if (eventType && !EVENT_TYPE_INFO[eventType]) {
			return res.status(400).json({
				success: false,
				error: 'Неизвестный тип события'
			});
		}

		const updated = await updateTriggerTemplate(triggerId, {
			name,
			description,
			event_type: eventType,
			event_config: eventConfig ? JSON.stringify(eventConfig) : undefined,
			message_template: messageTemplate,
			image_url: imageUrl,
			button_text: buttonText,
			button_url: buttonUrl,
			is_active: isActive,
			auto_send: autoSend
		});

		res.json({
			success: true,
			data: { id: updated?.id, updatedAt: updated?.updated_at }
		});
	} catch (error: any) {
		console.error('Error updating trigger:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * DELETE /api/admin/triggers/:id - Удалить триггер
 * ONLY: super-admin
 */
router.delete('/:id', requireRole('super-admin'), async (req, res) => {
	try {
		const triggerId = parseInt(req.params.id);
		const trigger = await getTriggerTemplateById(triggerId);

		if (!trigger) {
			return res.status(404).json({ success: false, error: 'Триггер не найден' });
		}

		await deleteTriggerTemplate(triggerId);

		res.json({ success: true, message: 'Триггер удалён' });
	} catch (error: any) {
		console.error('Error deleting trigger:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PATCH /api/admin/triggers/:id/toggle - Включить/выключить триггер
 * ONLY: super-admin, editor
 */
router.patch('/:id/toggle', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const triggerId = parseInt(req.params.id);
		const { isActive } = req.body;

		if (typeof isActive !== 'boolean') {
			return res.status(400).json({
				success: false,
				error: 'Параметр isActive обязателен'
			});
		}

		const updated = await toggleTriggerTemplate(triggerId, isActive);

		if (!updated) {
			return res.status(404).json({ success: false, error: 'Триггер не найден' });
		}

		res.json({
			success: true,
			data: {
				id: updated.id,
				isActive: updated.is_active,
				updatedAt: updated.updated_at
			}
		});
	} catch (error: any) {
		console.error('Error toggling trigger:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/admin/triggers/:id/logs - Логи триггера
 */
router.get('/:id/logs', async (req, res) => {
	try {
		const triggerId = parseInt(req.params.id);
		const { page = '1', limit = '50' } = req.query;

		const pageNum = parseInt(page as string);
		const limitNum = parseInt(limit as string);
		const offset = (pageNum - 1) * limitNum;

		const logs = await getTriggerLogs(triggerId, { limit: limitNum, offset });
		const stats = await getTriggerLogsStats(triggerId);

		res.json({
			success: true,
			data: {
				logs: logs.map(log => ({
					id: log.id,
					triggerId: log.trigger_id,
					campaignId: log.campaign_id,
					userId: log.loyalty_user_id,
					userName: [log.user_first_name, log.user_last_name].filter(Boolean).join(' ') || null,
					eventData: log.event_data ? JSON.parse(log.event_data) : null,
					status: log.status,
					error: log.error_message,
					createdAt: log.created_at
				})),
				stats,
				pagination: {
					page: pageNum,
					limit: limitNum,
					total: stats.total,
					totalPages: Math.ceil(stats.total / limitNum)
				}
			}
		});
	} catch (error: any) {
		console.error('Error fetching trigger logs:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

export default router;
