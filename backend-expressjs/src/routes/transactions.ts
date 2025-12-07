/**
 * Transactions API Routes
 * Endpoints для работы с транзакциями программы лояльности
 *
 * 🔴 SECURITY FIX (Start-5): Added expiry check, dynamic settings, race condition protection
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { transactions, loyaltyUsers, cashierTransactions, pendingDiscounts, stores } from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { calculateAvailableBalance } from '../utils/balanceCalculator';
import { getLoyaltySettings } from '../db/queries/loyaltySettings';

const router = Router();

// ==================== GET /api/transactions/recent ====================
/**
 * Получить последние транзакции для магазина
 *
 * Query params:
 * - storeId: number - ID магазина
 * - limit: number - количество транзакций (default: 10, max: 50)
 *
 * Response: Transaction[]
 * [
 *   {
 *     "id": "TXN-1234567890",
 *     "customerId": "654321",
 *     "customerName": "Мария Сидорова",
 *     "checkAmount": 1000,
 *     "pointsRedeemed": 200,
 *     "cashbackEarned": 40,
 *     "finalAmount": 800,
 *     "timestamp": "2025-11-04T12:30:00Z",
 *     "storeId": 1
 *   }
 * ]
 */
router.get('/recent', async (req: Request, res: Response) => {
	try {
		const storeIdStr = req.query.storeId as string;
		const limitStr = req.query.limit as string;

		if (!storeIdStr) {
			return res.status(400).json({
				error: 'Missing required parameter: storeId'
			});
		}

		const storeId = parseInt(storeIdStr);
		const limit = Math.min(parseInt(limitStr) || 10, 50); // Max 50 transactions

		if (isNaN(storeId)) {
			return res.status(400).json({
				error: 'Invalid storeId format',
				received: storeIdStr
			});
		}

		// Fetch recent transactions for this store
		const recentTransactions = await db
			.select({
				id: transactions.id,
				customerId: loyaltyUsers.card_number,
				customerName: loyaltyUsers.first_name,
				customerLastName: loyaltyUsers.last_name,
				amount: transactions.amount,
				type: transactions.type,
				title: transactions.title,
				checkAmount: transactions.check_amount,
				pointsRedeemed: transactions.points_redeemed,
				cashbackEarned: transactions.cashback_earned,
				createdAt: transactions.created_at
			})
			.from(transactions)
			.innerJoin(loyaltyUsers, eq(transactions.loyalty_user_id, loyaltyUsers.id))
			.where(eq(transactions.store_id, storeId))
			.orderBy(desc(transactions.created_at))
			.limit(limit);

		// Transform to frontend format
		const formattedTransactions = recentTransactions.map(tx => {
			// Use saved values directly (no parsing needed)
			const checkAmount = tx.checkAmount || Math.abs(tx.amount);
			const pointsRedeemed = tx.pointsRedeemed || 0;
			const cashbackEarned = tx.cashbackEarned || 0;
			const finalAmount = checkAmount - pointsRedeemed;

			return {
				id: `TXN-${tx.id}`,
				customerId: tx.customerId,
				customerName: `${tx.customerName} ${tx.customerLastName || ''}`.trim() || 'Без имени',
				checkAmount,
				pointsRedeemed,
				cashbackEarned,
				finalAmount,
				timestamp: tx.createdAt,
				storeId
			};
		});

		console.log(`[TRANSACTIONS API] Found ${formattedTransactions.length} recent transactions for store #${storeId}`);

		return res.json(formattedTransactions);

	} catch (error) {
		console.error('[TRANSACTIONS API] Error fetching recent transactions:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});

// ==================== POST /api/transactions ====================
/**
 * Создать новую транзакцию (earn/redeem)
 *
 * Body:
 * {
 *   "customer": { "id": 1, "cardNumber": "654321", "name": "Мария Сидорова", "balance": 2210 },
 *   "storeId": 1,
 *   "checkAmount": 1000,
 *   "pointsToRedeem": 200,
 *   "cashbackAmount": 40,
 *   "finalAmount": 800
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "transaction": { ... }
 * }
 */
router.post('/', async (req: Request, res: Response) => {
	try {
		const { customer, storeId, checkAmount, pointsToRedeem, cashbackAmount, finalAmount, sellerId, sellerName } = req.body;

		// Validation
		if (!customer || !customer.id) {
			return res.status(400).json({
				error: 'Missing required field: customer.id'
			});
		}

		if (typeof checkAmount !== 'number' || checkAmount <= 0) {
			return res.status(400).json({
				error: 'Invalid checkAmount',
				received: checkAmount
			});
		}

		if (typeof cashbackAmount !== 'number' || cashbackAmount < 0) {
			return res.status(400).json({
				error: 'Invalid cashbackAmount',
				received: cashbackAmount
			});
		}

		if (typeof pointsToRedeem !== 'number' || pointsToRedeem < 0) {
			return res.status(400).json({
				error: 'Invalid pointsToRedeem',
				received: pointsToRedeem
			});
		}

		// Verify customer exists and has enough balance if redeeming
		const customerRecord = await db.query.loyaltyUsers.findFirst({
			where: eq(loyaltyUsers.id, customer.id)
		});

		if (!customerRecord) {
			return res.status(404).json({
				error: 'Customer not found',
				customerId: customer.id
			});
		}

		// 🔴 SECURITY FIX (Start-5): Check available balance with expiry validation
		const balanceCheck = await calculateAvailableBalance(customerRecord.id, customerRecord.current_balance);

		// Use available balance (excluding expired points) for validation
		const effectiveBalance = balanceCheck.availableBalance;

		if (pointsToRedeem > 0 && effectiveBalance < pointsToRedeem) {
			return res.status(400).json({
				error: 'Insufficient balance',
				required: pointsToRedeem,
				available: effectiveBalance,
				message: balanceCheck.needsSync
					? 'Часть баллов истекла из-за неактивности. Доступный баланс обновлён.'
					: undefined
			});
		}

		// Get store info
		const store = await db.query.stores.findFirst({
			where: eq(stores.id, storeId)
		});

		// 🔴 FIX: Validate store exists
		if (!store || !storeId) {
			return res.status(404).json({
				error: 'Store not found',
				storeId: storeId,
				message: 'Invalid store ID. Transaction cannot be created.'
			});
		}

		// 🔴 SECURITY FIX (Start-5): Read earning_percent from settings (NOT trust frontend!)
		const loyaltySettings = await getLoyaltySettings();
		const earningPercent = loyaltySettings.earning_percent / 100; // Convert 4.0 to 0.04
		const maxDiscountPercent = loyaltySettings.max_discount_percent / 100; // Convert 20.0 to 0.20

		// Определяем тип операции
		const isRedeem = pointsToRedeem > 0;
		const discountAmount = pointsToRedeem;

		// 🔴 SECURITY FIX: Validate max discount (20% rule)
		const maxAllowedDiscount = checkAmount * maxDiscountPercent;
		if (pointsToRedeem > maxAllowedDiscount) {
			return res.status(400).json({
				error: 'Max discount exceeded',
				requested: pointsToRedeem,
				maxAllowed: Math.floor(maxAllowedDiscount),
				message: `Скидка не может превышать ${loyaltySettings.max_discount_percent}% от суммы чека`
			});
		}

		// 🔴 SECURITY FIX: Recalculate cashback from settings (don't trust frontend value)
		const actualFinalAmount = checkAmount - discountAmount;
		const serverCalculatedCashback = Math.round(actualFinalAmount * earningPercent);

		// Log if frontend sent different cashback (for debugging)
		if (cashbackAmount !== serverCalculatedCashback) {
			console.warn(`[TRANSACTIONS API] Cashback mismatch: frontend=${cashbackAmount}, server=${serverCalculatedCashback} (using server value)`);
		}

		// 🔴 FIX: ATOMIC TRANSACTION с полной бизнес-логикой (SYNC для SQLite!)
		const result = db.transaction((tx) => {
			// 1. Update customer balance atomically
			const balanceDelta = -pointsToRedeem + serverCalculatedCashback;

			const updatedCustomer = tx.update(loyaltyUsers)
				.set({
					current_balance: sql`current_balance + ${balanceDelta}`,
					last_activity: new Date().toISOString()
				})
				.where(eq(loyaltyUsers.id, customer.id))
				.returning()
				.get(); // SQLite sync: .get() вместо деструктуризации

			if (!updatedCustomer) {
				throw new Error('Failed to update customer balance');
			}

			// 🔴 SECURITY FIX (Start-5): Race condition protection
			// Verify balance didn't go negative (catches concurrent redemptions)
			if (updatedCustomer.current_balance < 0) {
				throw new Error(
					`Недостаточно баллов (обнаружена одновременная транзакция). ` +
					`Доступно: ${updatedCustomer.current_balance + pointsToRedeem - serverCalculatedCashback} баллов`
				);
			}

			// 2. Update customer stats
			tx.update(loyaltyUsers)
				.set({
					total_purchases: customerRecord.total_purchases + 1,
					total_saved: customerRecord.total_saved + discountAmount
				})
				.where(eq(loyaltyUsers.id, customer.id))
				.run();

			// 3. Create cashier_transactions record
			const cashierTx = tx.insert(cashierTransactions)
				.values({
					customer_id: customer.id,
					store_id: storeId,
					type: isRedeem ? 'spend' : 'earn',
					purchase_amount: checkAmount,
					points_amount: serverCalculatedCashback, // 🔴 FIX: Use server-calculated cashback
					discount_amount: discountAmount,
					metadata: null,
					synced_with_1c: false
				})
				.returning()
				.get(); // SQLite sync: .get() для одной записи

			// 4. Create transactions record(s)
			if (isRedeem) {
				// 4a. Spend record (списание баллов)
				const spendTx = tx.insert(transactions).values({
					loyalty_user_id: customer.id,
					store_id: storeId,
					seller_id: sellerId || null,
					seller_name: sellerName || null,
					title: 'Списание за покупку',
					amount: pointsToRedeem,
					type: 'spend',
					check_amount: checkAmount,
					points_redeemed: pointsToRedeem,
					cashback_earned: 0,
					spent: `${discountAmount} ₽`,
					store_name: store?.name || null
				}).returning().get();

				// 4b. Earn record (кешбэк от оплаченной суммы)
				if (serverCalculatedCashback > 0) {
					tx.insert(transactions).values({
						loyalty_user_id: customer.id,
						store_id: storeId,
						seller_id: sellerId || null,
						seller_name: sellerName || null,
						title: `Начисление кешбэка (${loyaltySettings.earning_percent}% от оплаты)`, // 🔴 FIX: Dynamic %
						amount: serverCalculatedCashback,
						type: 'earn',
						check_amount: checkAmount,
						points_redeemed: 0,
						cashback_earned: serverCalculatedCashback,
						spent: null,
						store_name: store?.name || null
					}).run();
				}

				// 4c. Create pending_discount for Agent
				// 🔴 FIX: Foreign key ссылается на transactions.id (НЕ на cashier_transactions)
				// 🔴 FIX #3: Увеличен expiry timeout с 30s до 90s (для медленных систем)
				const EXPIRY_SECONDS = parseInt(process.env.PENDING_DISCOUNT_EXPIRY_SECONDS || '90');
				const expiresAt = new Date(Date.now() + EXPIRY_SECONDS * 1000).toISOString();
				tx.insert(pendingDiscounts).values({
					store_id: storeId,
					customer_card_number: customer.cardNumber || customerRecord.card_number, // ✅ FIX: TypeScript requires this field
					transaction_id: spendTx.id, // ✅ Ссылка на transactions.id (spend record)
					check_amount: checkAmount, // ✅ FIX: Required field for database schema
					discount_amount: pointsToRedeem,
					status: 'pending',
					expires_at: expiresAt
				}).run();

				console.log(`[TRANSACTIONS API] Redeem: -${pointsToRedeem}₽ +${serverCalculatedCashback}₽, pending_discount created`);

			} else {
				// 4d. Только earn record (накопление)
				tx.insert(transactions).values({
					loyalty_user_id: customer.id,
					store_id: storeId,
					seller_id: sellerId || null,
					seller_name: sellerName || null,
					title: `Начисление за покупку (${loyaltySettings.earning_percent}%)`, // 🔴 FIX: Dynamic %
					amount: serverCalculatedCashback,
					type: 'earn',
					check_amount: checkAmount,
					points_redeemed: 0,
					cashback_earned: serverCalculatedCashback,
					spent: null,
					store_name: store?.name || null
				}).run();

				console.log(`[TRANSACTIONS API] Earn: +${serverCalculatedCashback}₽ (${loyaltySettings.earning_percent}%)`);
			}

			return {
				cashierTx,
				newBalance: updatedCustomer.current_balance
			};
		});

		console.log(`[TRANSACTIONS API] Transaction completed for customer #${customer.id}`);
		console.log(`  Balance: ${customerRecord.current_balance} → ${result.newBalance}`);

		// Return formatted response (compatible with frontend)
		// 🔴 FIX: Return server-calculated values, not frontend values
		return res.json({
			success: true,
			transaction: {
				id: `TXN-${result.cashierTx.id}`,
				customerId: customer.cardNumber,
				customerName: customer.name,
				checkAmount,
				pointsRedeemed: pointsToRedeem,
				cashbackEarned: serverCalculatedCashback, // 🔴 FIX: Server value
				finalAmount: actualFinalAmount, // 🔴 FIX: Server value
				timestamp: result.cashierTx.created_at,
				storeId,
				newBalance: result.newBalance // 🔴 FIX: Add new balance for frontend
			}
		});

	} catch (error) {
		console.error('[TRANSACTIONS API] Error creating transaction:', error);

		// 🔴 SECURITY FIX: Handle race condition error specifically
		if (error instanceof Error && error.message.includes('Недостаточно баллов')) {
			return res.status(400).json({
				error: 'Insufficient balance',
				message: error.message,
				code: 'RACE_CONDITION_DETECTED'
			});
		}

		return res.status(500).json({
			error: 'Internal server error',
			details: error instanceof Error ? error.message : String(error)
		});
	}
});

export default router;
