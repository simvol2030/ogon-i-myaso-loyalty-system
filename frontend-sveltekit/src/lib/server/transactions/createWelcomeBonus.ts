import { db } from '../db/client';
import { loyaltyUsers, transactions } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Create welcome bonus transaction with atomic operations
 *
 * TASK-002 FIX: Unified transaction API
 * - Uses atomic db.transaction() wrapper (matches backend pattern)
 * - Updates balance and creates transaction record in single transaction
 * - Prevents orphaned records on partial failures
 * - Updates last_activity
 * - IDEMPOTENT: Safe to call multiple times (checks if bonus already claimed)
 *
 * TASK-007 FIX: Dynamic welcome bonus and transaction title
 * - Welcome bonus amount comes from loyalty_settings
 * - Transaction title uses dynamic points name
 *
 * FIX: better-sqlite3 requires SYNCHRONOUS transactions (no async/await inside)
 *
 * Reference: backend-expressjs/src/routes/cashier.ts (earn endpoint)
 *
 * @param userId - Loyalty user ID (must be positive integer)
 * @param bonusAmount - Amount of welcome bonus (must be positive, max 1,000,000)
 * @param storeId - Optional store ID where user registered
 * @param pointsName - Points name from settings (default: 'Murzikoyns')
 * @returns Result with new balance
 * @throws Error if inputs invalid, user not found, or bonus already claimed
 */
export function createWelcomeBonus(
	userId: number,
	bonusAmount: number,
	storeId?: number | null,
	pointsName: string = 'Murzikoyns'
): {
	success: boolean;
	newBalance: number;
} {
	// AUDIT FIX (Cycle 2): Input validation
	if (!Number.isInteger(userId) || userId <= 0) {
		throw new Error(`Invalid userId: ${userId}. Must be positive integer.`);
	}

	if (!Number.isFinite(bonusAmount) || bonusAmount <= 0) {
		throw new Error(`Invalid bonusAmount: ${bonusAmount}. Must be positive finite number.`);
	}

	if (bonusAmount > 1000000) {
		throw new Error(`Bonus amount ${bonusAmount} exceeds maximum allowed (1,000,000).`);
	}

	// AUDIT FIX (Cycle 2): Validate pointsName is not empty string
	const sanitizedPointsName = pointsName?.trim() || 'Murzikoyns';

	try {
		// Execute operations in ATOMIC TRANSACTION (SYNCHRONOUS for better-sqlite3)
		const result = db.transaction((tx) => {
			// AUDIT FIX (Cycle 2): Idempotency check - verify user exists and bonus not claimed
			const existingUser = tx
				.select({
					id: loyaltyUsers.id,
					first_login_bonus_claimed: loyaltyUsers.first_login_bonus_claimed,
					current_balance: loyaltyUsers.current_balance
				})
				.from(loyaltyUsers)
				.where(eq(loyaltyUsers.id, userId))
				.get();

			if (!existingUser) {
				throw new Error(`User ${userId} not found`);
			}

			if (existingUser.first_login_bonus_claimed) {
				// Bonus already claimed - idempotent return without awarding again
				console.log(
					`[TRANSACTION] Welcome bonus already claimed for user ${userId}, returning current balance`
				);
				return {
					success: true,
					newBalance: existingUser.current_balance
				};
			}

			// AUDIT FIX (Cycle 2): Use single timestamp for consistency
			const now = new Date().toISOString();

			// 1. Update user balance atomically + mark bonus as claimed
			const updatedUsers = tx
				.update(loyaltyUsers)
				.set({
					current_balance: sql`current_balance + ${bonusAmount}`,
					last_activity: now,
					first_login_bonus_claimed: true
				})
				.where(eq(loyaltyUsers.id, userId))
				.returning()
				.all();

			const updatedUser = updatedUsers[0];

			if (!updatedUser) {
				throw new Error(`Failed to update balance for user ${userId}`);
			}

			// 2. Create transaction record
			tx.insert(transactions).values({
				loyalty_user_id: userId,
				title: `Приветственный бонус (${sanitizedPointsName})`,
				amount: bonusAmount,
				type: 'earn',
				store_id: storeId,
				store_name: null,
				spent: null,
				created_at: now
			}).run();

			return {
				success: true,
				newBalance: updatedUser.current_balance
			};
		});

		console.log(
			`[TRANSACTION] Welcome bonus created: user=${userId}, amount=${bonusAmount}, newBalance=${result.newBalance}`
		);

		return result;
	} catch (error) {
		console.error('[TRANSACTION ERROR] Failed to create welcome bonus:', error);
		throw error; // Re-throw to let caller handle
	}
}
