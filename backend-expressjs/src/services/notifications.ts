/**
 * Notifications Service
 * Handles Telegram and Email notifications for orders
 */

import { db } from '../db/client';
import { shopSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

// Cache settings for performance
let cachedSettings: any = null;
let cacheExpiry = 0;
const CACHE_TTL = 60000; // 1 minute

interface OrderNotificationData {
	orderNumber: string;
	customerName: string;
	customerPhone: string;
	customerEmail?: string;
	deliveryType: 'pickup' | 'delivery';
	deliveryAddress?: string;
	storeName?: string;
	items: { name: string; quantity: number; price: number }[];
	subtotal: number;
	deliveryCost: number;
	total: number;
	notes?: string;
}

interface StatusChangeData {
	orderNumber: string;
	customerName: string;
	customerPhone: string;
	oldStatus: string;
	newStatus: string;
	notes?: string;
}

// Status labels
const statusLabels: Record<string, string> = {
	new: 'Новый',
	confirmed: 'Подтверждён',
	processing: 'В обработке',
	shipped: 'Отправлен',
	delivered: 'Доставлен',
	cancelled: 'Отменён'
};

/**
 * Get cached shop settings
 */
async function getSettings() {
	const now = Date.now();
	if (cachedSettings && cacheExpiry > now) {
		return cachedSettings;
	}

	const [settings] = await db
		.select()
		.from(shopSettings)
		.where(eq(shopSettings.id, 1))
		.limit(1);

	if (settings) {
		cachedSettings = settings;
		cacheExpiry = now + CACHE_TTL;
	}

	return settings;
}

/**
 * Send Telegram message
 */
async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<boolean> {
	try {
		const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: chatId,
				text: message,
				parse_mode: 'HTML'
			})
		});

		const result = await response.json();
		if (!result.ok) {
			console.error('Telegram API error:', result.description);
			return false;
		}

		return true;
	} catch (error) {
		console.error('Failed to send Telegram message:', error);
		return false;
	}
}

/**
 * Format currency
 */
function formatPrice(amount: number): string {
	return amount.toLocaleString('ru-RU') + ' ₽';
}

/**
 * Build order notification message for Telegram
 */
function buildOrderMessage(order: OrderNotificationData): string {
	let message = `🛍️ <b>Новый заказ #${order.orderNumber}</b>\n\n`;

	// Customer info
	message += `👤 <b>Клиент:</b> ${order.customerName}\n`;
	message += `📱 <b>Телефон:</b> ${order.customerPhone}\n`;
	if (order.customerEmail) {
		message += `📧 <b>Email:</b> ${order.customerEmail}\n`;
	}
	message += '\n';

	// Delivery info
	if (order.deliveryType === 'delivery') {
		message += `🚚 <b>Доставка:</b> ${order.deliveryAddress}\n\n`;
	} else {
		message += `🏪 <b>Самовывоз:</b> ${order.storeName || 'Не указано'}\n\n`;
	}

	// Items
	message += `📦 <b>Позиции:</b>\n`;
	for (const item of order.items) {
		message += `• ${item.name} x${item.quantity} — ${formatPrice(item.price * item.quantity)}\n`;
	}
	message += '\n';

	// Totals
	message += `<b>Подытог:</b> ${formatPrice(order.subtotal)}\n`;
	if (order.deliveryCost > 0) {
		message += `<b>Доставка:</b> ${formatPrice(order.deliveryCost)}\n`;
	}
	message += `💰 <b>Итого:</b> ${formatPrice(order.total)}\n`;

	// Notes
	if (order.notes) {
		message += `\n📝 <b>Примечание:</b> ${order.notes}`;
	}

	return message;
}

/**
 * Build status change message for Telegram
 */
function buildStatusChangeMessage(data: StatusChangeData): string {
	let message = `📋 <b>Заказ #${data.orderNumber}</b>\n\n`;
	message += `👤 ${data.customerName}\n`;
	message += `📱 ${data.customerPhone}\n\n`;
	message += `📌 <b>Статус изменён:</b>\n`;
	message += `${statusLabels[data.oldStatus] || data.oldStatus} → ${statusLabels[data.newStatus] || data.newStatus}`;

	if (data.notes) {
		message += `\n\n📝 ${data.notes}`;
	}

	return message;
}

/**
 * Build customer status notification message
 */
function buildCustomerStatusMessage(data: StatusChangeData): string {
	let message = `🛍️ Ваш заказ #${data.orderNumber}\n\n`;
	message += `Статус: <b>${statusLabels[data.newStatus] || data.newStatus}</b>`;

	// Add status-specific messages
	switch (data.newStatus) {
		case 'confirmed':
			message += '\n\nВаш заказ подтверждён и скоро будет обработан.';
			break;
		case 'processing':
			message += '\n\nВаш заказ готовится.';
			break;
		case 'shipped':
			message += '\n\nВаш заказ отправлен. Ожидайте доставку.';
			break;
		case 'delivered':
			message += '\n\nВаш заказ доставлен. Спасибо за покупку!';
			break;
		case 'cancelled':
			message += '\n\nВаш заказ был отменён.';
			if (data.notes) {
				message += ` Причина: ${data.notes}`;
			}
			break;
	}

	return message;
}

/**
 * Notify about new order
 */
export async function notifyNewOrder(order: OrderNotificationData): Promise<void> {
	try {
		const settings = await getSettings();
		if (!settings) return;

		// Telegram notification to admin group
		if (
			settings.telegram_notifications_enabled &&
			settings.telegram_bot_token &&
			settings.telegram_group_id
		) {
			const message = buildOrderMessage(order);
			await sendTelegramMessage(
				settings.telegram_bot_token,
				settings.telegram_group_id,
				message
			);
		}

		// Email notification (placeholder - would need nodemailer)
		if (settings.email_notifications_enabled && settings.email_recipients) {
			try {
				const recipients = JSON.parse(settings.email_recipients);
				if (recipients.length > 0) {
					console.log(`[Notifications] Email would be sent to: ${recipients.join(', ')}`);
					// TODO: Implement actual email sending with nodemailer
				}
			} catch (e) {
				console.error('Failed to parse email recipients:', e);
			}
		}
	} catch (error) {
		console.error('Error sending new order notification:', error);
	}
}

/**
 * Notify about status change
 */
export async function notifyStatusChange(
	data: StatusChangeData,
	customerTelegramId?: number
): Promise<void> {
	try {
		const settings = await getSettings();
		if (!settings) return;

		// Telegram notification to admin group
		if (
			settings.telegram_notifications_enabled &&
			settings.telegram_bot_token &&
			settings.telegram_group_id
		) {
			const message = buildStatusChangeMessage(data);
			await sendTelegramMessage(
				settings.telegram_bot_token,
				settings.telegram_group_id,
				message
			);
		}

		// Customer Telegram notification
		if (
			settings.customer_telegram_notifications &&
			settings.telegram_bot_token &&
			customerTelegramId
		) {
			const customerMessage = buildCustomerStatusMessage(data);
			await sendTelegramMessage(
				settings.telegram_bot_token,
				customerTelegramId.toString(),
				customerMessage
			);
		}
	} catch (error) {
		console.error('Error sending status change notification:', error);
	}
}

/**
 * Clear settings cache (call after updating settings)
 */
export function clearSettingsCache(): void {
	cachedSettings = null;
	cacheExpiry = 0;
}
