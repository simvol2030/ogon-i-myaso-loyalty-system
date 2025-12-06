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

const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '2017');

if (!BOT_TOKEN) {
	throw new Error('BOT_TOKEN is not defined in .env file');
}

// Create bot instance
const bot = new Bot(BOT_TOKEN);

// Create Express app for webhooks
const app = express();
app.use(express.json());

// ===== ПРИВЕТСТВЕННЫЕ СООБЩЕНИЯ =====

const WELCOME_MESSAGE_1 = `💳 Добро пожаловать в программу лояльности сети магазинов "Мурзик & Co"!

🎉 Спасибо, что выбрали нас!

Мы рады приветствовать вас в нашей программе лояльности. Теперь каждая покупка приносит вам выгоду!`;

const WELCOME_BONUS = `🎁 СТАРТОВЫЙ БОНУС

Мы начислили вам 500 мурзи-коинов на счёт!

Используйте их при следующей покупке и получите скидку! 💰`;

const PROGRAM_RULES = `📋 КАК РАБОТАЕТ ПРОГРАММА

💚 НАЧИСЛЕНИЕ БАЛЛОВ:
• Покупаете на 1000₽ → получаете 40 мурзи-коинов (4%)
• Баллы начисляются автоматически после каждой покупки

💳 СПИСАНИЕ БАЛЛОВ:
• Можете списать до 20% от суммы чека
• 1 мурзи-коин = 1 рубль скидки
• Выбираете сами: списать или накапливать

⏰ СРОК ДЕЙСТВИЯ:
• Баллы действуют 1.5 месяца (45 дней)
• После истечения срока баллы сгорают
• Успейте использовать их вовремя!

🏪 ГДЕ ИСПОЛЬЗОВАТЬ:
• Покажите QR код карты кассиру
• Кассир применит скидку автоматически
• Вы видите результат сразу в чеке!`;

// ===== HANDLER: /start =====
bot.command('start', async (ctx) => {
	const firstName = ctx.from?.first_name || 'друг';
	const telegramUserId = ctx.from?.id;

	console.log(`📝 Новый пользователь: ${firstName} (ID: ${telegramUserId})`);

	// Сообщение 1: Приветствие
	if (NODE_ENV === 'production' && WEB_APP_URL.startsWith('https://')) {
		const keyboard = new InlineKeyboard()
			.webApp('Мурзи-коины', WEB_APP_URL);
		await ctx.reply(WELCOME_MESSAGE_1, {
			reply_markup: keyboard
		});
	} else {
		await ctx.reply(WELCOME_MESSAGE_1 + '\n\n💻 Локальный тест: ' + WEB_APP_URL);
	}

	// Задержка 1 секунда
	await new Promise(resolve => setTimeout(resolve, 1000));

	// Сообщение 2: Стартовый бонус
	if (NODE_ENV === 'production' && WEB_APP_URL.startsWith('https://')) {
		const keyboard = new InlineKeyboard()
			.webApp('Мурзи-коины', WEB_APP_URL);
		await ctx.reply(WELCOME_BONUS, {
			reply_markup: keyboard
		});
	} else {
		await ctx.reply(WELCOME_BONUS + '\n\n💻 Локальный тест: ' + WEB_APP_URL);
	}

	// Задержка 1 секунда
	await new Promise(resolve => setTimeout(resolve, 1000));

	// Сообщение 3: Правила программы
	if (NODE_ENV === 'production' && WEB_APP_URL.startsWith('https://')) {
		const keyboard = new InlineKeyboard()
			.webApp('Мурзи-коины', WEB_APP_URL);
		await ctx.reply(PROGRAM_RULES, {
			reply_markup: keyboard
		});
	} else {
		// Локальное тестирование - без кнопки (Telegram требует HTTPS!)
		await ctx.reply(PROGRAM_RULES + '\n\n💻 Локальный тест: ' + WEB_APP_URL);
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

// ===== HANDLER: /rules =====
bot.command('rules', async (ctx) => {
	await ctx.reply(PROGRAM_RULES);
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
