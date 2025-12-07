/**
 * Bot API: User Registration (Public)
 * Публичный endpoint для регистрации пользователя через Telegram бота
 */

import { Router } from 'express';
import { db } from '../../db/client';
import { loyaltyUsers, loyaltySettings } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateUniqueCardNumber } from '../../utils/cardNumber';

const router = Router();

/**
 * POST /api/bot/register
 * Регистрация нового пользователя через Telegram бота
 *
 * Body:
 * {
 *   "telegramUserId": 123456789,
 *   "chatId": 123456789,
 *   "firstName": "John",
 *   "lastName": "Doe", // optional
 *   "username": "johndoe", // optional
 *   "languageCode": "ru" // optional
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user": { id, telegram_user_id, card_number, first_name, current_balance, ... },
 *     "welcomeBonus": 500
 *   }
 * }
 */
router.post('/register', async (req, res) => {
	try {
		const { telegramUserId, chatId, firstName, lastName, username, languageCode } = req.body;

		// Валидация обязательных полей
		if (!telegramUserId || !chatId || !firstName) {
			return res.status(400).json({
				success: false,
				error: 'Missing required fields: telegramUserId, chatId, firstName'
			});
		}

		// Проверить существует ли уже пользователь
		const existingUser = await db.query.loyaltyUsers.findFirst({
			where: eq(loyaltyUsers.telegram_user_id, telegramUserId)
		});

		if (existingUser) {
			// Пользователь уже зарегистрирован, вернуть его данные
			console.log(`[BOT API] User already exists: telegram_user_id=${telegramUserId}, card=${existingUser.card_number}`);
			return res.json({
				success: true,
				data: {
					user: existingUser,
					welcomeBonus: 0, // Бонус уже был начислен
					alreadyRegistered: true
				}
			});
		}

		// Получить настройки программы лояльности (welcome_bonus)
		const settings = await db.query.loyaltySettings.findFirst({
			where: eq(loyaltySettings.id, 1)
		});

		const welcomeBonus = settings?.welcome_bonus || 500.0;

		// Сгенерировать уникальный номер карты (preferred: последние 6 цифр telegram_user_id, fallback: random)
		let cardNumber: string;
		try {
			cardNumber = await generateUniqueCardNumber(telegramUserId);
		} catch (error) {
			console.error('[BOT API] Failed to generate unique card number:', error);
			return res.status(500).json({
				success: false,
				error: 'Failed to generate unique card number. Please try again.'
			});
		}

		// Создать нового пользователя
		const now = new Date().toISOString();

		const [newUser] = await db.insert(loyaltyUsers).values({
			telegram_user_id: telegramUserId,
			chat_id: chatId,
			first_name: firstName,
			last_name: lastName || null,
			username: username || null,
			language_code: languageCode || 'ru',
			card_number: cardNumber,
			current_balance: welcomeBonus,
			total_purchases: 0,
			total_saved: 0,
			first_login_bonus_claimed: true, // Бонус начислен при регистрации
			registration_date: now,
			last_activity: now,
			is_active: true
		}).returning();

		console.log(`[BOT API] New user registered: telegram_user_id=${telegramUserId}, card=${cardNumber}, bonus=${welcomeBonus}₽`);

		res.status(201).json({
			success: true,
			data: {
				user: newUser,
				welcomeBonus,
				alreadyRegistered: false
			}
		});

	} catch (error: any) {
		console.error('[BOT API] Error registering user:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

export default router;
