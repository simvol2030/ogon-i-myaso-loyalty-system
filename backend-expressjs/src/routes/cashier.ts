import { Router } from 'express';
import { queries } from '../db/database';
import { db } from '../db/client';
import { loyaltyUsers, cashierTransactions, transactions } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { validateId, validatePurchaseAmount, validatePointsToRedeem, validateTransactionMetadata } from '../utils/validation';
import { calculateAvailableBalance } from '../utils/balanceCalculator';
import { getLoyaltySettings } from '../db/queries/loyaltySettings';

const router = Router();

// 🔴 FIX #4: Simple idempotency protection (in-memory cache with TTL)
// Protects against accidental double-clicks and network retries
// Key format: `customerId_storeId_amount_type` → timestamp
// TTL: 10 seconds (sufficient for retry protection)
const recentTransactions = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 10000; // 10 seconds

function checkAndRecordTransaction(customerId: number, storeId: number, amount: number, type: 'earn' | 'spend'): boolean {
	const key = `${customerId}_${storeId}_${amount}_${type}`;
	const now = Date.now();

	// Cleanup old entries (simple TTL enforcement)
	for (const [k, timestamp] of recentTransactions.entries()) {
		if (now - timestamp > IDEMPOTENCY_TTL_MS) {
			recentTransactions.delete(k);
		}
	}

	// Check if duplicate
	const lastTxTime = recentTransactions.get(key);
	if (lastTxTime && (now - lastTxTime) < IDEMPOTENCY_TTL_MS) {
		return false; // Duplicate detected
	}

	// Record new transaction
	recentTransactions.set(key, now);
	return true; // Allowed
}

/**
 * POST /api/cashier/earn
 * Начислить баллы за покупку
 */
router.post('/earn', async (req, res) => {
	const { customerId, storeId, purchaseAmount, metadata } = req.body;

	try {
		// 1. Validate customerId
		const customerIdValidation = validateId(customerId?.toString());
		if (!customerIdValidation.valid) {
			return res.status(400).json({
				success: false,
				error: customerIdValidation.error,
				code: 'INVALID_CUSTOMER'
			});
		}

		// 2. Validate storeId
		const storeIdValidation = validateId(storeId?.toString());
		if (!storeIdValidation.valid) {
			return res.status(400).json({
				success: false,
				error: storeIdValidation.error,
				code: 'INVALID_STORE'
			});
		}

		// 3. Validate purchaseAmount
		const amountValidation = validatePurchaseAmount(purchaseAmount);
		if (!amountValidation.valid) {
			return res.status(400).json({
				success: false,
				error: amountValidation.error,
				code: 'INVALID_AMOUNT'
			});
		}

		// 4. Validate metadata (optional)
		const metadataValidation = validateTransactionMetadata(metadata);
		if (!metadataValidation.valid) {
			return res.status(400).json({
				success: false,
				error: metadataValidation.error,
				code: 'INVALID_METADATA'
			});
		}

		const customerIdNum = parseInt(customerId.toString());
		const storeIdNum = parseInt(storeId.toString());

		// 🔴 FIX #4: Idempotency check - prevent duplicate earn transactions
		if (!checkAndRecordTransaction(customerIdNum, storeIdNum, purchaseAmount, 'earn')) {
			console.warn(`[CASHIER EARN] Duplicate transaction detected: customer=${customerIdNum}, amount=${purchaseAmount}₽`);
			return res.status(409).json({
				success: false,
				error: 'Дубликат транзакции. Эта операция уже была выполнена недавно.',
				code: 'DUPLICATE_TRANSACTION'
			});
		}

		// 5. Check customer exists
		const customer = await queries.getLoyaltyUserById(customerIdNum);
		if (!customer) {
			return res.status(404).json({
				success: false,
				error: 'Покупатель не найден',
				code: 'INVALID_CUSTOMER'
			});
		}

		if (!customer.is_active) {
			return res.status(400).json({
				success: false,
				error: 'Аккаунт покупателя неактивен',
				code: 'INVALID_CUSTOMER'
			});
		}

		// 6. Check store exists
		const store = await queries.getStoreById(storeIdNum);
		if (!store) {
			return res.status(404).json({
				success: false,
				error: 'Магазин не найден',
				code: 'INVALID_STORE'
			});
		}

		// 7. Get loyalty settings and calculate points earned
		// BUG-S1 FIX: Read earning_percent from settings instead of hardcoded 0.04
		const loyaltySettings = await getLoyaltySettings();
		const earningPercent = loyaltySettings.earning_percent / 100; // Convert 4.0 to 0.04
		const pointsEarned = Math.round(purchaseAmount * earningPercent);

		// 8. Execute operations in ATOMIC TRANSACTION (БАГ #3 FIX)
		const result = await db.transaction(async (tx) => {
			// 8a. Update customer balance atomically
			const [updatedCustomer] = await tx.update(loyaltyUsers)
				.set({
					current_balance: sql`current_balance + ${pointsEarned}`,
					last_activity: new Date().toISOString()
				})
				.where(eq(loyaltyUsers.id, customerIdNum))
				.returning();

			if (!updatedCustomer) {
				throw new Error('Failed to update customer balance');
			}

			// 8b. Update customer stats
			await tx.update(loyaltyUsers)
				.set({ total_purchases: customer.total_purchases + 1 })
				.where(eq(loyaltyUsers.id, customerIdNum));

			// 8c. Create cashier transaction record
			const [cashierTx] = await tx.insert(cashierTransactions)
				.values({
					customer_id: customerIdNum,
					store_id: storeIdNum,
					type: 'earn',
					purchase_amount: purchaseAmount,
					points_amount: pointsEarned,
					discount_amount: 0,
					metadata: metadata ? JSON.stringify(metadata) : null,
					synced_with_1c: false
				})
				.returning();

			// 8d. Create global transaction record
			await tx.insert(transactions)
				.values({
					loyalty_user_id: customerIdNum,
					store_id: storeIdNum,
					title: 'Начисление за покупку',
					amount: pointsEarned,
					type: 'earn',
					spent: null,
					store_name: store.name
				});

			return {
				cashierTx,
				newBalance: updatedCustomer.current_balance
			};
		});

		// 9. Log transaction
		console.log('✅ Cashier earn transaction completed:', {
			customerId: customerIdNum,
			storeId: storeIdNum,
			pointsEarned,
			purchaseAmount,
			newBalance: result.newBalance
		});

		// 10. Return success response
		res.json({
			success: true,
			transaction: {
				id: result.cashierTx.id,
				customerId: customerIdNum,
				pointsEarned,
				newBalance: result.newBalance,
				purchaseAmount,
				createdAt: result.cashierTx.created_at
			}
		});
	} catch (error: any) {
		console.error('❌ Cashier earn transaction error:', error);
		res.status(500).json({
			success: false,
			error: 'Произошла ошибка при начислении баллов. Попробуйте снова.',
			code: 'INTERNAL_ERROR'
		});
	}
});

/**
 * POST /api/cashier/redeem
 * Списать баллы за скидку
 */
router.post('/redeem', async (req, res) => {
	const { customerId, storeId, purchaseAmount, pointsToRedeem, metadata } = req.body;

	try {
		// 1. Validate customerId
		const customerIdValidation = validateId(customerId?.toString());
		if (!customerIdValidation.valid) {
			return res.status(400).json({
				success: false,
				error: customerIdValidation.error,
				code: 'INVALID_CUSTOMER'
			});
		}

		// 2. Validate storeId
		const storeIdValidation = validateId(storeId?.toString());
		if (!storeIdValidation.valid) {
			return res.status(400).json({
				success: false,
				error: storeIdValidation.error,
				code: 'INVALID_STORE'
			});
		}

		// 3. Validate purchaseAmount
		const amountValidation = validatePurchaseAmount(purchaseAmount);
		if (!amountValidation.valid) {
			return res.status(400).json({
				success: false,
				error: amountValidation.error,
				code: 'INVALID_AMOUNT'
			});
		}

		// 4. Validate metadata (optional)
		const metadataValidation = validateTransactionMetadata(metadata);
		if (!metadataValidation.valid) {
			return res.status(400).json({
				success: false,
				error: metadataValidation.error,
				code: 'INVALID_METADATA'
			});
		}

		const customerIdNum = parseInt(customerId.toString());
		const storeIdNum = parseInt(storeId.toString());

		// 🔴 FIX #4: Idempotency check - prevent duplicate redeem transactions
		if (!checkAndRecordTransaction(customerIdNum, storeIdNum, pointsToRedeem, 'spend')) {
			console.warn(`[CASHIER REDEEM] Duplicate transaction detected: customer=${customerIdNum}, points=${pointsToRedeem}₽`);
			return res.status(409).json({
				success: false,
				error: 'Дубликат транзакции. Эта операция уже была выполнена недавно.',
				code: 'DUPLICATE_TRANSACTION'
			});
		}

		// 5. Check customer exists
		let customer = await queries.getLoyaltyUserById(customerIdNum); // 🔴 FIX: let (not const) - may be reassigned after expiration sync
		if (!customer) {
			return res.status(404).json({
				success: false,
				error: 'Покупатель не найден',
				code: 'INVALID_CUSTOMER'
			});
		}

		if (!customer.is_active) {
			return res.status(400).json({
				success: false,
				error: 'Аккаунт покупателя неактивен',
				code: 'INVALID_CUSTOMER'
			});
		}


		// 6. Check available balance (excluding expired points) - FIX for 45-day expiration
		const balanceCheck = await calculateAvailableBalance(customerIdNum, customer.current_balance);
		if (balanceCheck.needsSync) {
			console.log(
				`[CASHIER REDEEM] Customer ${customerIdNum} has ${balanceCheck.expiredPoints} expired points - syncing now`
			);

			// 🔴 FIX Bug #3: Sync expired points immediately to avoid showing incorrect balance
			const { expireOldPoints } = await import('../jobs/expirePoints');
			await expireOldPoints(false); // Run synchronously to update database

			// Re-fetch customer with updated balance
			const updatedCustomer = await queries.getLoyaltyUserById(customerIdNum);
			if (!updatedCustomer) {
				return res.status(404).json({
					success: false,
					error: 'Покупатель не найден после синхронизации',
					code: 'INVALID_CUSTOMER'
				});
			}
			customer = updatedCustomer; // Update customer object with fresh data
			console.log(`[CASHIER REDEEM] Balance synchronized: ${updatedCustomer.current_balance}₽`);
		}

		// Use available balance (not total balance) for validation
		const effectiveBalance = balanceCheck.availableBalance;

		// 7. Get loyalty settings for max discount percentage
		const loyaltySettings = await getLoyaltySettings();

		// 7. Validate pointsToRedeem against available balance and purchase amount
		const pointsValidation = validatePointsToRedeem(
			pointsToRedeem,
			effectiveBalance, // Use available balance, not total balance
			purchaseAmount,
			loyaltySettings.max_discount_percent // Dynamic max discount from settings
		);
		if (!pointsValidation.valid) {
			const errorMessage = pointsValidation.error ?? 'Ошибка валидации баллов';
			return res.status(400).json({
				success: false,
				error: errorMessage,
				code: errorMessage.includes('Недостаточно баллов')
					? 'INSUFFICIENT_BALANCE'
					: 'MAX_DISCOUNT_EXCEEDED'
			});
		}

		// 7. Check store exists
		const store = await queries.getStoreById(storeIdNum);
		if (!store) {
			return res.status(404).json({
				success: false,
				error: 'Магазин не найден',
				code: 'INVALID_STORE'
			});
		}

		// 8. Calculate discount and cashback using settings fetched earlier (line 327)
		const earningPercent = loyaltySettings.earning_percent / 100; // Convert 4.0 to 0.04
		const discountAmount = pointsToRedeem;
		const finalAmount = purchaseAmount - discountAmount;
		const cashbackEarned = Math.round(finalAmount * earningPercent); // % from settings (banker's rounding)

		// 9. Execute operations in ATOMIC TRANSACTION (БАГ #3 FIX)
		const result = await db.transaction(async (tx) => {
			// 9a. Update customer balance: -pointsToRedeem + cashbackEarned
			const balanceDelta = -pointsToRedeem + cashbackEarned;

			const [updatedCustomer] = await tx.update(loyaltyUsers)
				.set({
					current_balance: sql`current_balance + ${balanceDelta}`,
					last_activity: new Date().toISOString()
				})
				.where(eq(loyaltyUsers.id, customerIdNum))
				.returning();

			if (!updatedCustomer) {
				throw new Error('Failed to update customer balance');
			}

			// 🔴 FIX: Race condition protection - verify balance didn't go negative
			// This catches concurrent redemptions that both passed validation
			if (updatedCustomer.current_balance < 0) {
				throw new Error(
					`Недостаточно баллов (обнаружена одновременная транзакция). ` +
					`Доступно: ${updatedCustomer.current_balance + pointsToRedeem - cashbackEarned} баллов`
				);
			}

			// 9b. Update customer stats (Проблема #8: total_purchases при redeem)
			await tx.update(loyaltyUsers)
				.set({
					total_purchases: customer.total_purchases + 1,
					total_saved: customer.total_saved + discountAmount
				})
				.where(eq(loyaltyUsers.id, customerIdNum));

			// 9c. Create cashier transaction record
			const [cashierTx] = await tx.insert(cashierTransactions)
				.values({
					customer_id: customerIdNum,
					store_id: storeIdNum,
					type: 'spend',
					purchase_amount: purchaseAmount,
					points_amount: cashbackEarned, // Начисленные баллы (4% от finalAmount)
					discount_amount: discountAmount,
					metadata: metadata ? JSON.stringify(metadata) : null,
					synced_with_1c: false
				})
				.returning();

			// 9d. Create global transaction record (spend)
			await tx.insert(transactions)
				.values({
					loyalty_user_id: customerIdNum,
					store_id: storeIdNum,
					title: 'Списание за покупку',
					amount: pointsToRedeem,
					type: 'spend',
					spent: `${discountAmount} ₽`,
					store_name: store.name
				});

			// 9e. Create global transaction record (earn cashback)
			if (cashbackEarned > 0) {
				await tx.insert(transactions)
					.values({
						loyalty_user_id: customerIdNum,
						store_id: storeIdNum,
						title: `Начисление кешбэка (${loyaltySettings.earning_percent}% от оплаты)`,
						amount: cashbackEarned,
						type: 'earn',
						spent: null,
						store_name: store.name
					});
			}

			return {
				cashierTx,
				newBalance: updatedCustomer.current_balance,
				cashbackEarned
			};
		});

		// 10. Log transaction
		console.log('✅ Cashier redeem transaction completed:', {
			customerId: customerIdNum,
			storeId: storeIdNum,
			pointsRedeemed: pointsToRedeem,
			discountAmount,
			finalAmount,
			cashbackEarned: result.cashbackEarned,
			newBalance: result.newBalance
		});

		// 11. Return success response
		res.json({
			success: true,
			transaction: {
				id: result.cashierTx.id,
				customerId: customerIdNum,
				pointsRedeemed: pointsToRedeem,
				cashbackEarned: result.cashbackEarned, // 4% от оплаченной суммы
				discountAmount,
				finalAmount,
				newBalance: result.newBalance,
				createdAt: result.cashierTx.created_at
			}
		});
	} catch (error: any) {
		console.error('❌ Cashier redeem transaction error:', error);

		// Check if it's a balance error
		if (error.message && error.message.includes('Недостаточно баллов')) {
			return res.status(400).json({
				success: false,
				error: error.message,
				code: 'INSUFFICIENT_BALANCE'
			});
		}

		res.status(500).json({
			success: false,
			error: 'Произошла ошибка при списании баллов. Попробуйте снова.',
			code: 'INTERNAL_ERROR'
		});
	}
});

export default router;
