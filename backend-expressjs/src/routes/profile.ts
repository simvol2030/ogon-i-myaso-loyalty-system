/**
 * Profile API routes (public - for Telegram Web App users)
 */

import { Router } from 'express';
import { db } from '../db/client';
import { loyaltyUsers } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * PUT /api/profile/birthday - Update user birthday
 */
router.put('/birthday', async (req, res) => {
	try {
		const { telegramUserId, birthday } = req.body;

		// Validation
		if (!telegramUserId) {
			return res.status(400).json({
				success: false,
				error: 'Missing telegramUserId'
			});
		}

		if (!birthday) {
			return res.status(400).json({
				success: false,
				error: 'Missing birthday'
			});
		}

		// Validate birthday format (MM-DD)
		const birthdayRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
		if (!birthdayRegex.test(birthday)) {
			return res.status(400).json({
				success: false,
				error: 'Invalid birthday format. Use MM-DD (e.g., 12-25)'
			});
		}

		// Find user
		const [user] = await db
			.select()
			.from(loyaltyUsers)
			.where(eq(loyaltyUsers.telegram_user_id, telegramUserId))
			.limit(1);

		if (!user) {
			return res.status(404).json({
				success: false,
				error: 'User not found'
			});
		}

		// Update birthday
		await db
			.update(loyaltyUsers)
			.set({
				birthday,
				last_activity: new Date().toISOString()
			})
			.where(eq(loyaltyUsers.id, user.id));

		res.json({
			success: true,
			message: 'Birthday saved',
			data: { birthday }
		});

	} catch (error: any) {
		console.error('Error saving birthday:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

/**
 * GET /api/profile/:telegramUserId/birthday - Get user birthday
 */
router.get('/:telegramUserId/birthday', async (req, res) => {
	try {
		const telegramUserId = parseInt(req.params.telegramUserId);

		if (isNaN(telegramUserId)) {
			return res.status(400).json({
				success: false,
				error: 'Invalid telegramUserId'
			});
		}

		const [user] = await db
			.select({ birthday: loyaltyUsers.birthday })
			.from(loyaltyUsers)
			.where(eq(loyaltyUsers.telegram_user_id, telegramUserId))
			.limit(1);

		if (!user) {
			return res.status(404).json({
				success: false,
				error: 'User not found'
			});
		}

		res.json({
			success: true,
			data: { birthday: user.birthday }
		});

	} catch (error: any) {
		console.error('Error fetching birthday:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error'
		});
	}
});

export default router;
