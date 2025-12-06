/**
 * Admin API: Shop Settings
 * Manages shop configuration for e-commerce functionality
 */

import { Router } from 'express';
import { db } from '../../db/client';
import { shopSettings } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { clearSettingsCache } from '../../services/notifications';

const router = Router();

/**
 * GET /api/admin/shop-settings - Get shop settings
 */
router.get('/', async (req, res) => {
	try {
		const [settings] = await db
			.select()
			.from(shopSettings)
			.where(eq(shopSettings.id, 1))
			.limit(1);

		if (!settings) {
			// Return defaults if no settings exist
			return res.json({
				success: true,
				data: {
					shopName: 'Shop',
					shopType: 'general',
					currency: 'RUB',
					deliveryEnabled: true,
					pickupEnabled: true,
					deliveryCost: 0,
					freeDeliveryFrom: null,
					minOrderAmount: 0,
					telegramBotToken: null,
					telegramBotUsername: null,
					telegramNotificationsEnabled: false,
					telegramGroupId: null,
					emailNotificationsEnabled: false,
					emailRecipients: [],
					customerTelegramNotifications: false,
					smtpHost: null,
					smtpPort: null,
					smtpUser: null,
					smtpPassword: null,
					smtpFrom: null,
					updatedAt: null
				}
			});
		}

		// Parse email recipients from JSON
		let emailRecipients: string[] = [];
		if (settings.email_recipients) {
			try {
				emailRecipients = JSON.parse(settings.email_recipients);
			} catch (e) {
				emailRecipients = [];
			}
		}

		res.json({
			success: true,
			data: {
				shopName: settings.shop_name,
				shopType: settings.shop_type,
				currency: settings.currency,
				deliveryEnabled: settings.delivery_enabled,
				pickupEnabled: settings.pickup_enabled,
				deliveryCost: settings.delivery_cost ? settings.delivery_cost / 100 : 0,
				freeDeliveryFrom: settings.free_delivery_from ? settings.free_delivery_from / 100 : null,
				minOrderAmount: settings.min_order_amount ? settings.min_order_amount / 100 : 0,
				telegramBotToken: settings.telegram_bot_token,
				telegramBotUsername: settings.telegram_bot_username,
				telegramNotificationsEnabled: settings.telegram_notifications_enabled,
				telegramGroupId: settings.telegram_group_id,
				emailNotificationsEnabled: settings.email_notifications_enabled,
				emailRecipients,
				customerTelegramNotifications: settings.customer_telegram_notifications,
				smtpHost: settings.smtp_host,
				smtpPort: settings.smtp_port,
				smtpUser: settings.smtp_user,
				smtpPassword: settings.smtp_password ? '********' : null, // Mask password
				smtpFrom: settings.smtp_from,
				updatedAt: settings.updated_at
			}
		});
	} catch (error: any) {
		console.error('Error fetching shop settings:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/shop-settings - Update shop settings
 */
router.put('/', async (req, res) => {
	try {
		const {
			shopName,
			shopType,
			currency,
			deliveryEnabled,
			pickupEnabled,
			deliveryCost,
			freeDeliveryFrom,
			minOrderAmount,
			telegramBotToken,
			telegramBotUsername,
			telegramNotificationsEnabled,
			telegramGroupId,
			emailNotificationsEnabled,
			emailRecipients,
			customerTelegramNotifications,
			smtpHost,
			smtpPort,
			smtpUser,
			smtpPassword,
			smtpFrom
		} = req.body;

		// Validate shop type
		const validShopTypes = ['restaurant', 'pet_shop', 'clothing', 'general'];
		if (shopType && !validShopTypes.includes(shopType)) {
			return res.status(400).json({
				success: false,
				error: 'Invalid shop type'
			});
		}

		// Build update object
		const updateData: any = {
			updated_at: new Date().toISOString()
		};

		if (shopName !== undefined) updateData.shop_name = shopName;
		if (shopType !== undefined) updateData.shop_type = shopType;
		if (currency !== undefined) updateData.currency = currency;
		if (deliveryEnabled !== undefined) updateData.delivery_enabled = deliveryEnabled;
		if (pickupEnabled !== undefined) updateData.pickup_enabled = pickupEnabled;
		if (deliveryCost !== undefined) updateData.delivery_cost = Math.round(deliveryCost * 100);
		if (freeDeliveryFrom !== undefined) {
			updateData.free_delivery_from = freeDeliveryFrom ? Math.round(freeDeliveryFrom * 100) : null;
		}
		if (minOrderAmount !== undefined) updateData.min_order_amount = Math.round(minOrderAmount * 100);
		if (telegramBotToken !== undefined) updateData.telegram_bot_token = telegramBotToken || null;
		if (telegramBotUsername !== undefined) updateData.telegram_bot_username = telegramBotUsername || null;
		if (telegramNotificationsEnabled !== undefined) updateData.telegram_notifications_enabled = telegramNotificationsEnabled;
		if (telegramGroupId !== undefined) updateData.telegram_group_id = telegramGroupId || null;
		if (emailNotificationsEnabled !== undefined) updateData.email_notifications_enabled = emailNotificationsEnabled;
		if (emailRecipients !== undefined) {
			updateData.email_recipients = JSON.stringify(emailRecipients || []);
		}
		if (customerTelegramNotifications !== undefined) updateData.customer_telegram_notifications = customerTelegramNotifications;
		if (smtpHost !== undefined) updateData.smtp_host = smtpHost || null;
		if (smtpPort !== undefined) updateData.smtp_port = smtpPort || null;
		if (smtpUser !== undefined) updateData.smtp_user = smtpUser || null;
		if (smtpPassword !== undefined && smtpPassword !== '********') {
			updateData.smtp_password = smtpPassword || null;
		}
		if (smtpFrom !== undefined) updateData.smtp_from = smtpFrom || null;

		// Check if settings exist
		const [existing] = await db
			.select({ id: shopSettings.id })
			.from(shopSettings)
			.where(eq(shopSettings.id, 1))
			.limit(1);

		if (existing) {
			// Update
			await db
				.update(shopSettings)
				.set(updateData)
				.where(eq(shopSettings.id, 1));
		} else {
			// Insert
			await db.insert(shopSettings).values({
				id: 1,
				...updateData
			});
		}

		// Clear notification settings cache
		clearSettingsCache();

		res.json({
			success: true,
			message: 'Settings updated'
		});
	} catch (error: any) {
		console.error('Error updating shop settings:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/shop-settings/test-telegram - Test Telegram notification
 */
router.post('/test-telegram', async (req, res) => {
	try {
		const [settings] = await db
			.select()
			.from(shopSettings)
			.where(eq(shopSettings.id, 1))
			.limit(1);

		if (!settings?.telegram_bot_token || !settings?.telegram_group_id) {
			return res.status(400).json({
				success: false,
				error: 'Telegram bot token and group ID are required'
			});
		}

		// Send test message
		const telegramUrl = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
		const response = await fetch(telegramUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: settings.telegram_group_id,
				text: '✅ Test notification from Shop Admin\n\nIf you see this message, Telegram notifications are configured correctly!',
				parse_mode: 'HTML'
			})
		});

		const result = await response.json();

		if (!result.ok) {
			return res.status(400).json({
				success: false,
				error: result.description || 'Failed to send test message'
			});
		}

		res.json({
			success: true,
			message: 'Test message sent successfully'
		});
	} catch (error: any) {
		console.error('Error testing Telegram:', error);
		res.status(500).json({ success: false, error: 'Failed to send test message' });
	}
});

/**
 * POST /api/admin/shop-settings/test-email - Test email notification
 */
router.post('/test-email', async (req, res) => {
	try {
		const { email } = req.body;

		if (!email) {
			return res.status(400).json({
				success: false,
				error: 'Email address is required'
			});
		}

		const [settings] = await db
			.select()
			.from(shopSettings)
			.where(eq(shopSettings.id, 1))
			.limit(1);

		if (!settings?.smtp_host || !settings?.smtp_port || !settings?.smtp_from) {
			return res.status(400).json({
				success: false,
				error: 'SMTP settings are not configured'
			});
		}

		// Note: Actual email sending would require nodemailer
		// This is a placeholder for the API structure
		res.json({
			success: true,
			message: 'Email feature is not yet implemented. SMTP settings look valid.'
		});
	} catch (error: any) {
		console.error('Error testing email:', error);
		res.status(500).json({ success: false, error: 'Failed to send test email' });
	}
});

export default router;
