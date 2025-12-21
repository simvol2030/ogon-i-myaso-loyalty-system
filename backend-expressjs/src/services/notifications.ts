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
	deliveryCity?: string;
	deliveryAddress?: string;
	deliveryEntrance?: string;
	deliveryFloor?: string;
	deliveryApartment?: string;
	deliveryIntercom?: string;
	storeName?: string;
	items: { name: string; quantity: number; price: number }[];
	subtotal: number;
	deliveryCost: number;
	total: number;
	notes?: string;
	telegramUserId?: number; // For "Request Review" button
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
async function sendTelegramMessage(
	botToken: string,
	chatId: string,
	message: string,
	replyMarkup?: any
): Promise<boolean> {
	try {
		const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
		console.log('[Telegram API] Sending message to chat:', chatId);

		const payload: any = {
			chat_id: chatId,
			text: message,
			parse_mode: 'HTML'
		};

		if (replyMarkup) {
			payload.reply_markup = replyMarkup;
		}

		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		console.log('[Telegram API] Response status:', response.status);

		const result = await response.json() as { ok: boolean; description?: string };
		console.log('[Telegram API] Response body:', JSON.stringify(result));

		if (!result.ok) {
			console.error('[Telegram API] ERROR:', result.description);
			return false;
		}

		console.log('[Telegram API] Message sent successfully');
		return true;
	} catch (error) {
		console.error('[Telegram API] Exception while sending message:', error);
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
		message += `🚚 <b>Доставка:</b>\n`;
		if (order.deliveryCity) {
			message += `г. ${order.deliveryCity}\n`;
		}
		message += `${order.deliveryAddress}`;
		if (order.deliveryEntrance) {
			message += `, подъезд ${order.deliveryEntrance}`;
		}
		if (order.deliveryFloor) {
			message += `, этаж ${order.deliveryFloor}`;
		}
		if (order.deliveryApartment) {
			message += `, кв. ${order.deliveryApartment}`;
		}
		if (order.deliveryIntercom) {
			message += `\nДомофон: ${order.deliveryIntercom}`;
		}
		message += '\n\n';
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
 * Build inline keyboard for order notification
 */
function buildOrderKeyboard(orderNumber: string, customerPhone: string, telegramUserId?: number): any {
	// First row: status buttons
	const tgUserId = telegramUserId || 0; // Use 0 if no telegramUserId (guest orders)
	const buttons = [
		[
			{ text: '🟡 Принят', callback_data: `status:accepted:${orderNumber}:${customerPhone}:${tgUserId}` },
			{ text: '🟢 Готов', callback_data: `status:ready:${orderNumber}:${customerPhone}:${tgUserId}` },
			{ text: '🚗 Выехал', callback_data: `status:departed:${orderNumber}:${customerPhone}:${tgUserId}` }
		]
	];

	// Second row: request review button (only if telegramUserId available)
	if (telegramUserId && telegramUserId > 0) {
		buttons.push([
			{ text: '⭐ Запросить отзыв', callback_data: `request_review:${telegramUserId}:${orderNumber}` }
		]);
	}

	return {
		inline_keyboard: buttons
	};
}

/**
 * Notify about new order
 */
export async function notifyNewOrder(order: OrderNotificationData): Promise<void> {
	try {
		console.log('[Notifications] notifyNewOrder called for order:', order.orderNumber);

		const settings = await getSettings();
		console.log('[Notifications] Settings loaded:', {
			hasSettings: !!settings,
			notificationsEnabled: settings?.telegram_notifications_enabled,
			hasToken: !!settings?.telegram_bot_token,
			hasGroupId: !!settings?.telegram_group_id
		});

		if (!settings) {
			console.warn('[Notifications] No settings found, aborting');
			return;
		}

		// Telegram notification to admin group
		if (
			settings.telegram_notifications_enabled &&
			settings.telegram_bot_token &&
			settings.telegram_group_id
		) {
			console.log('[Notifications] Sending Telegram notification to group:', settings.telegram_group_id);
			const message = buildOrderMessage(order);
			const keyboard = buildOrderKeyboard(order.orderNumber, order.customerPhone, order.telegramUserId);
			console.log('[Notifications] Message built, length:', message.length);
			console.log('[Notifications] Keyboard built:', JSON.stringify(keyboard));

			const result = await sendTelegramMessage(
				settings.telegram_bot_token,
				settings.telegram_group_id,
				message,
				keyboard
			);

			console.log('[Notifications] Telegram send result:', result ? 'SUCCESS' : 'FAILED');
		} else {
			console.warn('[Notifications] Telegram notification conditions not met:', {
				enabled: settings.telegram_notifications_enabled,
				hasToken: !!settings.telegram_bot_token,
				hasGroupId: !!settings.telegram_group_id
			});
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
 * Build rating notification message for Telegram
 */
function buildRatingMessage(data: {
	rating: string;
	phone?: string;
	cause?: string;
	feedback?: string;
	timestamp: string;
}): string {
	const ratingEmojis: Record<string, string> = {
		'Отлично': '⭐⭐⭐⭐⭐',
		'Хорошо': '⭐⭐⭐⭐',
		'Удовлетворительно': '⭐⭐⭐',
		'Неудовлетворительно': '⭐'
	};

	let message = `📊 <b>Новый отзыв</b>\n\n`;
	message += `${ratingEmojis[data.rating] || '⭐'} <b>${data.rating}</b>\n\n`;

	if (data.phone) {
		message += `📱 Телефон: ${data.phone}\n`;
	}

	if (data.cause) {
		message += `📝 Причина: ${data.cause}\n`;
	}

	if (data.feedback) {
		message += `💬 Комментарий: ${data.feedback}\n`;
	}

	const date = new Date(data.timestamp);
	message += `\n🕐 ${date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

	return message;
}

/**
 * Send rating to Telegram group
 */
export async function sendRatingToGroup(data: {
	rating: string;
	phone?: string;
	cause?: string;
	feedback?: string;
	timestamp: string;
}): Promise<boolean> {
	try {
		console.log('[Notifications] sendRatingToGroup called for rating:', data.rating);

		const settings = await getSettings();
		console.log('[Notifications] Settings loaded:', {
			hasSettings: !!settings,
			notificationsEnabled: settings?.telegram_notifications_enabled,
			hasToken: !!settings?.telegram_bot_token,
			hasGroupId: !!settings?.telegram_group_id
		});

		if (!settings) {
			console.warn('[Notifications] No settings found, aborting');
			return false;
		}

		// Telegram notification to admin group
		if (
			settings.telegram_notifications_enabled &&
			settings.telegram_bot_token &&
			settings.telegram_group_id
		) {
			console.log('[Notifications] Sending rating notification to group:', settings.telegram_group_id);
			const message = buildRatingMessage(data);
			console.log('[Notifications] Message built, length:', message.length);

			const result = await sendTelegramMessage(
				settings.telegram_bot_token,
				settings.telegram_group_id,
				message
			);

			console.log('[Notifications] Telegram send result:', result ? 'SUCCESS' : 'FAILED');
			return result;
		} else {
			console.warn('[Notifications] Telegram notification conditions not met:', {
				enabled: settings.telegram_notifications_enabled,
				hasToken: !!settings.telegram_bot_token,
				hasGroupId: !!settings.telegram_group_id
			});
			return false;
		}
	} catch (error) {
		console.error('Error sending rating notification:', error);
		return false;
	}
}

/**
 * Clear settings cache (call after updating settings)
 */
export function clearSettingsCache(): void {
	cachedSettings = null;
	cacheExpiry = 0;
}
