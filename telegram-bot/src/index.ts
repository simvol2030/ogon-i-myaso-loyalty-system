import { Bot, InlineKeyboard } from 'grammy';
import express from 'express';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 🔴 FIX: Автоопределение URL для локального теста
const WEB_APP_URL = process.env.WEB_APP_URL ||
  (NODE_ENV === 'production'
    ? 'https://murzicoin.murzico.ru'
    : 'http://localhost:5173');

const API_BASE_URL = process.env.API_BASE_URL ||
  (NODE_ENV === 'production'
    ? 'https://sl.bot-3.ru/api'
    : 'http://localhost:3000/api');

const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '2017');

if (!BOT_TOKEN) {
	throw new Error('BOT_TOKEN is not defined in .env file');
}

// Create bot instance
const bot = new Bot(BOT_TOKEN);

// Create Express app for webhooks
const app = express();
app.use(express.json());

// ===== ТИПЫ =====

interface WelcomeMessage {
	id: number;
	order_number: number;
	message_text: string;
	message_image: string | null;
	button_text: string | null;
	button_url: string | null;
	delay_seconds: number;
	is_active: boolean;
}

interface APIResponse {
	success: boolean;
	data?: WelcomeMessage[];
	error?: string;
}

interface RegistrationResponse {
	success: boolean;
	data?: {
		user: any;
		welcomeBonus: number;
		alreadyRegistered: boolean;
	};
	error?: string;
}

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С API =====

/**
 * Получить активные приветственные сообщения из базы данных
 */
async function getActiveWelcomeMessages(): Promise<WelcomeMessage[]> {
	try {
		const response = await fetch(`${API_BASE_URL}/bot/welcome-messages/active`);
		const json = await response.json() as APIResponse;

		if (!json.success) {
			console.error('Failed to fetch welcome messages:', json.error);
			return [];
		}

		return json.data || [];
	} catch (error) {
		console.error('Error fetching welcome messages:', error);
		return [];
	}
}

/**
 * Зарегистрировать пользователя в системе лояльности
 */
async function registerUser(ctx: any): Promise<any> {
	try {
		const response = await fetch(`${API_BASE_URL}/bot/register`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				telegramUserId: ctx.from.id,
				chatId: ctx.chat.id,
				firstName: ctx.from.first_name,
				lastName: ctx.from.last_name || null,
				username: ctx.from.username || null,
				languageCode: ctx.from.language_code || 'ru'
			})
		});

		const json = await response.json() as RegistrationResponse;

		if (!json.success) {
			console.error('Failed to register user:', json.error);
			return null;
		}

		return json.data;
	} catch (error) {
		console.error('Error registering user:', error);
		return null;
	}
}

/**
 * Заменить переменные в тексте сообщения
 */
function replaceVariables(
	text: string,
	user: { first_name?: string; last_name?: string; username?: string }
): string {
	return text
		.replace(/\{first_name\}/g, user.first_name || '')
		.replace(/\{last_name\}/g, user.last_name || '')
		.replace(/\{username\}/g, user.username || '')
		.replace(/\{WEB_APP_URL\}/g, WEB_APP_URL);
}

// ===== HANDLER: /start =====
bot.command('start', async (ctx) => {
	const firstName = ctx.from?.first_name || 'друг';
	const lastName = ctx.from?.last_name;
	const username = ctx.from?.username;
	const telegramUserId = ctx.from?.id;

	console.log(`📝 Новый пользователь: ${firstName} (ID: ${telegramUserId})`);

	// Регистрируем пользователя (или получаем существующего)
	const registrationResult = await registerUser(ctx);
	if (!registrationResult) {
		console.error('⚠️ Failed to register user');
		await ctx.reply('Произошла ошибка при регистрации. Попробуйте позже.');
		return;
	}

	const { user, welcomeBonus, alreadyRegistered } = registrationResult;
	console.log(`✅ User registered: card=${user.card_number}, balance=${user.current_balance}₽`);

	// Получить сообщения из базы данных
	const messages = await getActiveWelcomeMessages();

	if (messages.length === 0) {
		console.error('⚠️ No active welcome messages found in database');
		await ctx.reply('Добро пожаловать! Откройте приложение для просмотра вашей карты лояльности.');
		return;
	}

	// Отправить все сообщения по порядку
	for (const message of messages) {
		// Задержка перед отправкой (кроме первого сообщения с delay_seconds = 0)
		if (message.delay_seconds > 0) {
			await new Promise(resolve => setTimeout(resolve, message.delay_seconds * 1000));
		}

		// Заменить переменные в тексте
		const messageText = replaceVariables(message.message_text, {
			first_name: firstName,
			last_name: lastName,
			username: username
		});

		// Создать кнопку если указана
		let keyboard: InlineKeyboard | undefined;
		if (message.button_text && message.button_url) {
			const buttonUrl = replaceVariables(message.button_url, {
				first_name: firstName,
				last_name: lastName,
				username: username
			});

			// Для production используем WebApp кнопку
			if (NODE_ENV === 'production' && buttonUrl.startsWith('https://')) {
				keyboard = new InlineKeyboard().webApp(message.button_text, buttonUrl);
			}
		}

		// Отправить сообщение с изображением или без
		try {
			if (message.message_image) {
				// Отправить фото с подписью
				const photoOptions: any = {
					caption: messageText,
					parse_mode: 'HTML' as const
				};
				if (keyboard) {
					photoOptions.reply_markup = keyboard;
				}
				await ctx.replyWithPhoto(message.message_image, photoOptions);
			} else {
				// Отправить текстовое сообщение
				if (keyboard) {
					await ctx.reply(messageText, { reply_markup: keyboard });
				} else {
					// Для локальной разработки добавляем URL в текст
					const localTestSuffix = NODE_ENV !== 'production' ? `\n\n💻 Локальный тест: ${WEB_APP_URL}` : '';
					await ctx.reply(messageText + localTestSuffix);
				}
			}
		} catch (error) {
			console.error(`Error sending welcome message #${message.order_number}:`, error);
			// Fallback: отправить только текст если фото не удалось
			if (message.message_image) {
				try {
					if (keyboard) {
						await ctx.reply(messageText, { reply_markup: keyboard });
					} else {
						await ctx.reply(messageText);
					}
				} catch (fallbackError) {
					console.error('Fallback message also failed:', fallbackError);
				}
			}
		}
	}
});

// ===== HANDLER: /balance =====
bot.command('balance', async (ctx) => {
	const keyboard = new InlineKeyboard()
		.webApp('Мурзи-коины', WEB_APP_URL);

	await ctx.reply('Откройте карту лояльности чтобы увидеть ваш текущий баланс:', {
		reply_markup: keyboard
	});
});

// ===== HANDLER: Любой текст =====
bot.on('message:text', async (ctx) => {
	const keyboard = new InlineKeyboard()
		.webApp('Мурзи-коины', WEB_APP_URL);

	await ctx.reply(
		'👋 Здравствуйте! Откройте вашу карту лояльности:',
		{ reply_markup: keyboard }
	);
});

// ===== WEBHOOK: Уведомления о транзакциях =====

interface TransactionNotification {
	telegramUserId: number;
	type: 'earn' | 'redeem';
	purchaseAmount: number;
	pointsEarned?: number;
	pointsRedeemed?: number;
	discountAmount?: number;
	newBalance: number;
	storeName?: string;
}

app.post('/notify-transaction', async (req, res) => {
	try {
		const notification: TransactionNotification = req.body;

		console.log('📬 Получено уведомление о транзакции:', notification);

		const {
			telegramUserId,
			type,
			purchaseAmount,
			pointsEarned,
			pointsRedeemed,
			discountAmount,
			newBalance,
			storeName
		} = notification;

		if (!telegramUserId) {
			return res.status(400).json({ error: 'Missing telegramUserId' });
		}

		// Формируем сообщение
		let message = '';

		if (type === 'redeem') {
			// Списание баллов
			message = `💳 ПОКУПКА СО СПИСАНИЕМ МУРЗИ-КОИНОВ

💰 Сумма покупки: ${purchaseAmount.toFixed(2)}₽

✅ СПИСАНО: ${pointsRedeemed} Мурзи-коинов
💸 Скидка: ${discountAmount?.toFixed(2)}₽
🎁 Начислено: ${pointsEarned} Мурзи-коинов (4% кэшбэк)

💎 Новый баланс: ${newBalance.toFixed(2)} мурзи-коинов

Спасибо за покупку! 🎉`;

		} else {
			// Только начисление
			message = `🎁 ПОКУПКА

💰 Сумма покупки: ${purchaseAmount.toFixed(2)}₽

✅ НАЧИСЛЕНО: ${pointsEarned} Мурзи-коинов (4% кэшбэк)

💎 Новый баланс: ${newBalance.toFixed(2)} мурзи-коинов

Копите баллы и получайте скидки! 🚀`;
		}

		// Отправляем уведомление
		// 🔴 FIX: Кнопка только для HTTPS
		if (NODE_ENV === 'production' && WEB_APP_URL.startsWith('https://')) {
			const keyboard = new InlineKeyboard()
				.webApp('Мурзи-коины', WEB_APP_URL);

			await bot.api.sendMessage(telegramUserId, message, {
				reply_markup: keyboard
			});
		} else {
			// Локально - без кнопки
			await bot.api.sendMessage(telegramUserId, message + '\n\n💻 ' + WEB_APP_URL);
		}

		console.log(`✅ Уведомление отправлено пользователю ${telegramUserId}`);

		res.json({ success: true, message: 'Notification sent' });

	} catch (error) {
		console.error('❌ Ошибка отправки уведомления:', error);

		if (error && typeof error === "object" && "error_code" in error && (error as any).error_code === 403) {
			// Пользователь заблокировал бота
			return res.status(200).json({
				success: false,
				error: 'User blocked bot'
			});
		}

		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// ===== WEBHOOK: Отправка рассылки (campaigns) =====

interface CampaignMessage {
	chatId: number;
	text: string;
	imageUrl?: string;
	buttonText?: string;
	buttonUrl?: string;
}

app.post('/send-campaign-message', async (req, res) => {
	try {
		const message: CampaignMessage = req.body;

		console.log('📬 Отправка сообщения кампании:', { chatId: message.chatId, hasImage: !!message.imageUrl });

		const { chatId, text, imageUrl, buttonText, buttonUrl } = message;

		if (!chatId || !text) {
			return res.status(400).json({ error: 'Missing chatId or text' });
		}

		// Build inline keyboard if button is provided
		let keyboard: InlineKeyboard | undefined;
		if (buttonText && buttonUrl) {
			keyboard = new InlineKeyboard();
			// Check if it's a web app URL or regular URL
			if (buttonUrl.startsWith('https://') && buttonUrl.includes(WEB_APP_URL.replace('https://', ''))) {
				keyboard.webApp(buttonText, buttonUrl);
			} else {
				keyboard.url(buttonText, buttonUrl);
			}
		} else if (NODE_ENV === 'production' && WEB_APP_URL.startsWith('https://')) {
			// Default button to open web app
			keyboard = new InlineKeyboard().webApp('Мурзи-коины', WEB_APP_URL);
		}

		// Send message with or without image
		if (imageUrl) {
			// Send photo with caption
			// Determine if imageUrl is local or remote
			const photoUrl = imageUrl.startsWith('http')
				? imageUrl
				: `${process.env.BACKEND_URL || 'http://localhost:3000'}${imageUrl}`;

			await bot.api.sendPhoto(chatId, photoUrl, {
				caption: text,
				reply_markup: keyboard
			});
		} else {
			// Send text message
			await bot.api.sendMessage(chatId, text, {
				reply_markup: keyboard,
				parse_mode: 'HTML'
			});
		}

		console.log(`✅ Сообщение кампании отправлено: chatId=${chatId}`);

		res.json({ success: true });

	} catch (error) {
		console.error('❌ Ошибка отправки сообщения кампании:', error);

		if (error && typeof error === "object" && "error_code" in error) {
			const tgError = error as any;

			if (tgError.error_code === 403) {
				// User blocked bot
				return res.status(200).json({
					success: false,
					error: 'User blocked bot',
					code: 403
				});
			}

			if (tgError.error_code === 400) {
				// Bad request (e.g., chat not found)
				return res.status(200).json({
					success: false,
					error: tgError.description || 'Bad request',
					code: 400
				});
			}
		}

		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

// ===== CALLBACK QUERY HANDLERS =====

/**
 * Handle order status button clicks
 * Format: status:accepted|ready|departed:orderNumber:phone
 */
bot.on('callback_query:data', async (ctx) => {
	const data = ctx.callbackQuery.data;
	console.log('📝 Callback query received:', data);

	try {
		// Parse callback data
		const parts = data.split(':');
		const action = parts[0];

		if (action === 'status') {
			// Status button clicked
			const status = parts[1]; // accepted, ready, departed
			const orderNumber = parts[2];
			const phone = parts[3];
			const telegramUserId = parts[4] ? parseInt(parts[4]) : 0;

			const statusEmojis: Record<string, string> = {
				accepted: '🟡',
				ready: '🟢',
				departed: '🚗'
			};

			const statusLabels: Record<string, string> = {
				accepted: 'Принят',
				ready: 'Готов',
				departed: 'Выехал'
			};

			const customerMessages: Record<string, string> = {
				accepted: 'Ваш заказ принят и скоро будет готов! 🟡',
				ready: 'Ваш заказ готов! Скоро отправим 🟢',
				departed: 'Ваш заказ в пути! Скоро будет доставлен 🚗'
			};

			const emoji = statusEmojis[status] || '📋';
			const label = statusLabels[status] || status;

			// Send notification to customer if telegramUserId is available
			if (telegramUserId > 0) {
				try {
					const customerMessage = `🛍️ <b>Заказ #${orderNumber}</b>\n\n${customerMessages[status] || `Статус обновлён: ${label}`}`;
					await bot.api.sendMessage(telegramUserId, customerMessage, { parse_mode: 'HTML' });
					console.log(`✅ Status notification sent to customer ${telegramUserId}`);
				} catch (error) {
					console.error(`❌ Failed to send status notification to customer ${telegramUserId}:`, error);
				}
			}

			// Answer callback to remove loading state
			await ctx.answerCallbackQuery(`✅ Статус обновлён: ${label}`);

			// Edit message to show updated status
			const originalMessage = ctx.callbackQuery.message?.text || '';
			const updatedMessage = `${originalMessage}\n\n${emoji} <b>Статус обновлён: ${label}</b>\n⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

			// Get original keyboard to preserve buttons
			const originalKeyboard = ctx.callbackQuery.message?.reply_markup;

			// Update message and keep keyboard
			await ctx.editMessageText(updatedMessage, {
				parse_mode: 'HTML',
				reply_markup: originalKeyboard
			});

			console.log(`✅ Status updated: ${status} for order ${orderNumber}`);

		} else if (action === 'request_review') {
			// Request review button clicked
			const telegramUserId = parts[1];
			const orderNumber = parts[2];

			// Build reputation page URL with pre-filled phone
			const reviewUrl = `${WEB_APP_URL}/reputation`;

			// Send review request to customer
			await bot.api.sendMessage(
				parseInt(telegramUserId),
				`⭐ <b>Оцените нас!</b>\n\nВаш заказ #${orderNumber} выполнен.\n\nПожалуйста, поделитесь своим мнением о нашем сервисе и продуктах.`,
				{
					parse_mode: 'HTML',
					reply_markup: new InlineKeyboard().webApp('⭐ Оставить отзыв', reviewUrl)
				}
			);

			// Answer callback
			await ctx.answerCallbackQuery('✅ Запрос на отзыв отправлен клиенту');

			// Edit original message to show request was sent
			const originalMessage = ctx.callbackQuery.message?.text || '';
			const updatedMessage = `${originalMessage}\n\n⭐ <b>Запрос на отзыв отправлен</b>\n⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

			// Get original keyboard to preserve buttons
			const originalKeyboard = ctx.callbackQuery.message?.reply_markup;

			await ctx.editMessageText(updatedMessage, {
				parse_mode: 'HTML',
				reply_markup: originalKeyboard
			});

			console.log(`✅ Review request sent to user ${telegramUserId} for order ${orderNumber}`);
		}

	} catch (error) {
		console.error('❌ Error handling callback query:', error);
		await ctx.answerCallbackQuery('❌ Произошла ошибка');
	}
});

// Health check
app.get('/health', (req, res) => {
	res.json({
		status: 'ok',
		service: 'Murzicoin Loyalty Bot',
		timestamp: new Date().toISOString()
	});
});

// Start webhook server
app.listen(WEBHOOK_PORT, () => {
	console.log(`🌐 Webhook server listening on port ${WEBHOOK_PORT}`);
});

// Error handling
bot.catch((err) => {
	console.error('❌ Error in bot:', err);
});

// Start the bot
bot.start({
	onStart: () => {
		console.log('✅ Telegram bot started successfully!');
		console.log(`🤖 Bot: Murzicoin Loyalty Bot`);
		console.log(`🌐 Web App URL: ${WEB_APP_URL}`);
		console.log(`📡 Webhook port: ${WEBHOOK_PORT}`);
	}
});

// Graceful shutdown
process.once('SIGINT', () => {
	console.log('\n⏹️ Stopping bot...');
	bot.stop();
	process.exit(0);
});

process.once('SIGTERM', () => {
	console.log('\n⏹️ Stopping bot...');
	bot.stop();
	process.exit(0);
});
