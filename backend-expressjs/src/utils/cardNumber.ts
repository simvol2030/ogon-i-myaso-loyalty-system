/**
 * Card number generation utilities
 * Strategy: Try preferred (last 6 digits of Telegram ID) first, then fallback to random
 */

import { db } from '../db/client';
import { loyaltyUsers } from '../db/schema';
import { eq } from 'drizzle-orm';

const MAX_RETRIES = 10;

/**
 * Generate unique 6-digit card number
 * Strategy: Try preferred (last 6 digits of Telegram ID) first,
 * then fallback to random generation
 *
 * @param telegramUserId - Telegram user ID
 * @returns Promise<string> - Unique 6-digit card number
 * @throws Error if unable to generate unique number after MAX_RETRIES attempts
 */
export async function generateUniqueCardNumber(telegramUserId: number): Promise<string> {
	// 1. Try preferred number (last 6 digits)
	const preferred = telegramUserId.toString().slice(-6).padStart(6, '0');

	const existingPreferred = await db.query.loyaltyUsers.findFirst({
		where: eq(loyaltyUsers.card_number, preferred),
		columns: { id: true }
	});

	if (!existingPreferred) {
		console.log(`[CARD] Using preferred card number: ${preferred}`);
		return preferred;
	}

	// 2. Collision detected - log and generate random
	console.warn(
		`[CARD] Collision detected for preferred ${preferred}, generating random (Telegram ID: ${telegramUserId})`
	);

	// 3. Generate random until unique
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		const random = generateRandomCardNumber();

		const existingRandom = await db.query.loyaltyUsers.findFirst({
			where: eq(loyaltyUsers.card_number, random),
			columns: { id: true }
		});

		if (!existingRandom) {
			console.log(`[CARD] Using random card number: ${random} (attempt ${attempt + 1})`);
			return random;
		}
	}

	// 4. Extremely unlikely - all retries failed
	throw new Error(`Failed to generate unique card number after ${MAX_RETRIES} attempts`);
}

/**
 * Generate random 6-digit number (100000-999999)
 * @returns string - Random 6-digit card number
 */
function generateRandomCardNumber(): string {
	const min = 100000;
	const max = 999999;
	return Math.floor(Math.random() * (max - min + 1) + min).toString();
}
