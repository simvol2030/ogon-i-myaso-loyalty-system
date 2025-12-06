/**
 * 1С Integration API Routes
 *
 * Endpoints для интеграции с 1С:Розница 3.0
 *
 * Сценарий работы:
 * 1. 1С → GET /api/1c/check-amount?storeId=1 → получить сумму предчека
 * 2. Loyalty → POST /api/1c/apply-discount → применить скидку
 * 3. 1С → POST /api/1c/confirm → подтвердить транзакцию
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { pendingDiscounts, activeChecks } from '../db/schema';
import { eq, and, sql, inArray, lt } from 'drizzle-orm';

const router = Router();

// ==================== BUG-4 FIX: Персистентное хранилище предчека ====================
// Используем таблицу active_checks вместо in-memory Map
// Это решает проблему потери данных при рестарте backend

const ACTIVE_CHECK_TTL_SECONDS = 60; // TTL для суммы чека

/**
 * Получить активную сумму чека для магазина из БД
 */
async function getActiveCheck(storeId: number) {
	const now = new Date().toISOString();

	// Удаляем expired записи для этого магазина
	await db.delete(activeChecks)
		.where(lt(activeChecks.expires_at, now));

	// Получаем текущую запись
	const result = await db.select()
		.from(activeChecks)
		.where(eq(activeChecks.store_id, storeId))
		.limit(1);

	return result[0] || null;
}

/**
 * Сохранить/обновить сумму чека для магазина в БД
 */
async function setActiveCheck(storeId: number, storeName: string, checkAmount: number) {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + ACTIVE_CHECK_TTL_SECONDS * 1000).toISOString();

	// UPSERT: вставить или обновить
	await db.insert(activeChecks)
		.values({
			store_id: storeId,
			store_name: storeName,
			check_amount: checkAmount,
			created_at: now.toISOString(),
			expires_at: expiresAt
		})
		.onConflictDoUpdate({
			target: activeChecks.store_id,
			set: {
				store_name: storeName,
				check_amount: checkAmount,
				created_at: now.toISOString(),
				expires_at: expiresAt
			}
		});
}

/**
 * Очистка всех expired записей (вызывается периодически)
 */
async function cleanupExpiredChecks() {
	const now = new Date().toISOString();
	const result = await db.delete(activeChecks)
		.where(lt(activeChecks.expires_at, now))
		.returning();

	if (result.length > 0) {
		console.log(`[1C API] Cleaned up ${result.length} expired active checks`);
	}
}

// ==================== GET /api/1c/check-amount ====================
/**
 * Получить сумму текущего предчека
 *
 * Query params:
 * - storeId: number - ID магазина
 *
 * Response:
 * {
 *   "checkAmount": 1500.00,
 *   "storeId": 1,
 *   "timestamp": "2025-10-29T15:30:00Z"
 * }
 */
router.get('/check-amount', async (req: Request, res: Response) => {
	try {
		const storeId = parseInt(req.query.storeId as string);

		if (!storeId || isNaN(storeId)) {
			return res.status(400).json({
				error: 'Invalid storeId parameter'
			});
		}

		// 🔴 BUG-4 FIX: Читаем из БД вместо in-memory Map
		const data = await getActiveCheck(storeId);

		if (!data) {
			// Данных нет - либо agent не запущен, либо еще не отправил
			console.warn(`[1C API] No data from agent for store ${storeId}`);
			return res.status(404).json({
				error: 'No data from agent',
				message: 'Агент еще не отправил данные. Проверьте что Agent запущен на кассе.',
				checkAmount: 0,
				storeId
			});
		}

		console.log(`[1C API] Check amount retrieved: ${data.check_amount}₽ (store: ${data.store_name})`);

		return res.json({
			checkAmount: data.check_amount,
			storeId: data.store_id,
			storeName: data.store_name,
			timestamp: data.created_at
		});

	} catch (error) {
		console.error('[1C API] Error getting check amount:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});

// ==================== POST /api/1c/set-check-amount ====================
/**
 * Установить сумму предчека (вызывается из 1С)
 * DEPRECATED: Используйте /register-amount с аутентификацией
 *
 * Body:
 * {
 *   "checkAmount": 1500.00,
 *   "storeId": 1
 * }
 */
router.post('/set-check-amount', async (req: Request, res: Response) => {
	try {
		const { checkAmount, storeId } = req.body;

		if (!checkAmount || !storeId) {
			return res.status(400).json({
				error: 'Missing required fields: checkAmount, storeId'
			});
		}

		// 🔴 BUG-4 FIX: Сохраняем в БД вместо in-memory Map
		await setActiveCheck(
			parseInt(storeId),
			`Store ${storeId}`, // Временное название (этот endpoint deprecated)
			parseFloat(checkAmount)
		);

		console.log(`[1C API] Pre-check set for store ${storeId}: ${checkAmount}₽`);

		return res.json({
			success: true,
			checkAmount: parseFloat(checkAmount),
			storeId: parseInt(storeId)
		});

	} catch (error) {
		console.error('[1C API] Error setting check amount:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});

// ==================== POST /api/1c/register-amount ====================
/**
 * Agent регистрирует сумму чека (Reverse Polling Architecture)
 *
 * Вызывается агентом когда сумма в amount.json меняется.
 *
 * Body:
 * {
 *   "storeId": 1,
 *   "storeName": "Ашукино",
 *   "amount": 3681.00,
 *   "timestamp": "2025-11-07T12:00:00Z"
 * }
 *
 * Headers:
 * - x-store-api-key: string - API ключ магазина (для аутентификации)
 */
router.post('/register-amount', async (req: Request, res: Response) => {
	try {
		const { storeId, storeName, amount, timestamp } = req.body;

		if (!storeId || !storeName || amount === undefined) {
			return res.status(400).json({
				error: 'Missing required fields: storeId, storeName, amount'
			});
		}

		// 🔴 Аутентификация: проверка API ключа магазина
		const apiKey = req.headers['x-store-api-key'] as string;
		const expectedKey = process.env[`STORE_${storeId}_API_KEY`];

		if (!expectedKey) {
			console.error(`[1C API] STORE_${storeId}_API_KEY not configured!`);
			return res.status(500).json({
				error: 'Server misconfiguration - API key not set for this store'
			});
		}

		if (apiKey !== expectedKey) {
			console.warn(`[1C API] Unauthorized register-amount attempt for store ${storeId}`);
			return res.status(401).json({
				error: 'Unauthorized - invalid API key'
			});
		}

		// 🔴 BUG-4 FIX: Сохраняем в БД вместо in-memory Map
		await setActiveCheck(
			parseInt(storeId),
			storeName,
			parseFloat(amount)
		);

		console.log(`[1C API] Amount registered: ${amount}₽ from ${storeName} (store ${storeId})`);

		return res.json({
			success: true,
			checkAmount: parseFloat(amount),
			storeId: parseInt(storeId),
			storeName
		});

	} catch (error) {
		console.error('[1C API] Error registering amount:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});


// ==================== DEPRECATED ENDPOINTS (Removed 2025-01-19) ====================
/**
 * DEPRECATED: The following endpoints were removed as they are no longer used:
 *
 * 1. POST /api/1c/apply-discount (previously lines 201-360)
 *    - Replaced by: /api/1c/pending-discounts (agent polling)
 *    - Reason: Direct TWA -> 1C communication deprecated
 *    - Migration: Use /api/cashier/redeem -> pending_discounts table -> agent polling
 *
 * 2. POST /api/1c/confirm (previously lines 361-436)
 *    - Replaced by: /api/1c/confirm-discount
 *    - Reason: Simpler flow, no duplicate transaction logic
 *    - Migration: Agent calls /confirm-discount after applying discount.txt
 *
 * Current Architecture:
 *   1С → amount.json → Agent → TWA
 *                               ↓
 *                       /cashier/redeem
 *                               ↓
 *                   pending_discounts table
 *                               ↓
 *          Agent polling /pending-discounts
 *                               ↓
 *                     discount.txt → 1С
 *                               ↓
 *                   /confirm-discount
 *
 * See CLAUDE.md for full architecture documentation.
 * Original code backed up in: 1c.ts.backup
 */

// ==================== GET /api/1c/pending-discounts ====================
/**
 * Агент забирает pending скидки для своего магазина
 *
 * Query params:
 * - storeId: number - ID магазина
 *
 * Headers:
 * - x-store-api-key: string - API ключ магазина (для безопасности)
 *
 * Response:
 * [
 *   { id: 42, discountAmount: 150, transactionId: 123, createdAt: "..." },
 *   ...
 * ]
 */
router.get('/pending-discounts', async (req: Request, res: Response) => {
	try {
		const storeId = parseInt(req.query.storeId as string);

		if (!storeId || isNaN(storeId)) {
			return res.status(400).json({
				error: 'Invalid storeId parameter'
			});
		}

		// 🔴 FIX #5: Простая аутентификация по API ключу
		const apiKey = req.headers['x-store-api-key'] as string;
		const expectedKey = process.env[`STORE_${storeId}_API_KEY`];

		// КРИТИЧНО: Проверка что ключ настроен
		if (!expectedKey) {
			console.error(`[1C API] STORE_${storeId}_API_KEY not configured in environment!`);
			return res.status(500).json({
				error: 'Server misconfiguration - API key not set'
			});
		}

		if (apiKey !== expectedKey) {
			console.warn(`[1C API] Unauthorized access attempt to store ${storeId}`);
			return res.status(401).json({
				error: 'Unauthorized - invalid API key'
			});
		}

		// 🔴 FIX #3: Атомарный UPDATE - сразу помечаем как processing
		// 🔴 FIX: Also recover stuck "processing" discounts older than 60 seconds
		const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

		const discounts = await db.update(pendingDiscounts)
			.set({ status: 'processing', applied_at: new Date().toISOString() })
			.where(and(
				eq(pendingDiscounts.store_id, storeId),
				sql`(${pendingDiscounts.status} = 'pending'
					OR (${pendingDiscounts.status} = 'processing'
						AND ${pendingDiscounts.applied_at} < ${oneMinuteAgo}))`
			))
			.returning();

		// Фильтруем expired
		const now = new Date();
		const validDiscounts = discounts.filter(d => new Date(d.expires_at) > now);

		// 🔴 FIX #2: Помечаем expired BATCH UPDATE (не N+1)
		const expiredIds = discounts.filter(d => new Date(d.expires_at) <= now).map(d => d.id);
		if (expiredIds.length > 0) {
			await db.update(pendingDiscounts)
				.set({ status: 'expired' })
				.where(inArray(pendingDiscounts.id, expiredIds));
		}

		console.log(`[1C API] Agent poll: store=${storeId}, pending=${validDiscounts.length}, expired=${expiredIds.length}`);

		// Возвращаем в формате для агента
		return res.json(validDiscounts.map(d => ({
			id: d.id,
			discountAmount: d.discount_amount,
			transactionId: d.transaction_id,
			createdAt: d.created_at,
			expiresAt: d.expires_at
		})));

	} catch (error) {
		console.error('[1C API] Error getting pending discounts:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});

// ==================== POST /api/1c/confirm-discount ====================
/**
 * Агент подтверждает применение скидки в 1С
 *
 * Body:
 * {
 *   "id": 42,
 *   "status": "applied" | "failed",
 *   "errorMessage"?: "..." (опционально при failed)
 * }
 */
router.post('/confirm-discount', async (req: Request, res: Response) => {
	try {
		const { id, status, errorMessage } = req.body;

		if (!id || !status) {
			return res.status(400).json({
				error: 'Missing required fields: id, status'
			});
		}

		if (!['applied', 'failed'].includes(status)) {
			return res.status(400).json({
				error: 'Invalid status. Must be "applied" or "failed"'
			});
		}

		// Обновляем статус pending discount
		const updated = await db.update(pendingDiscounts)
			.set({
				status,
				applied_at: new Date().toISOString(),
				error_message: errorMessage || null
			})
			.where(eq(pendingDiscounts.id, parseInt(id)))
			.returning();

		if (updated.length === 0) {
			return res.status(404).json({
				error: 'Pending discount not found'
			});
		}

		console.log(`[1C API] Discount confirmed: id=${id}, status=${status}`);

		return res.json({
			success: true,
			discount: updated[0]
		});

	} catch (error) {
		console.error('[1C API] Error confirming discount:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});

// ==================== GET /api/1c/health ====================
/**
 * Health check endpoint
 * MEDIUM-3 FIX: Расширенная информация для диагностики агентов
 */
router.get('/health', async (req: Request, res: Response) => {
	try {
		// Получаем статистику из БД
		const activeChecksCount = await db.select({ count: sql<number>`count(*)` })
			.from(activeChecks);

		const pendingCount = await db.select({ count: sql<number>`count(*)` })
			.from(pendingDiscounts)
			.where(eq(pendingDiscounts.status, 'pending'));

		// Очищаем expired записи
		await cleanupExpiredChecks();

		res.json({
			status: 'ok',
			service: '1C Integration API',
			timestamp: new Date().toISOString(),
			activeChecksCount: activeChecksCount[0]?.count || 0,
			pendingDiscountsCount: pendingCount[0]?.count || 0,
			version: '2.0.0' // BUG-4 FIX: persistent storage
		});
	} catch (error) {
		console.error('[1C API] Health check error:', error);
		res.status(500).json({
			status: 'error',
			service: '1C Integration API',
			timestamp: new Date().toISOString(),
			error: 'Database connection failed'
		});
	}
});

// ==================== GET /api/1c/agent-status ====================
/**
 * MEDIUM-3 FIX: Статус агента для конкретного магазина
 * Позволяет диагностировать проблемы с подключением агента
 */
router.get('/agent-status', async (req: Request, res: Response) => {
	try {
		const storeId = parseInt(req.query.storeId as string);

		if (!storeId || isNaN(storeId)) {
			return res.status(400).json({
				error: 'Invalid storeId parameter'
			});
		}

		const activeCheck = await getActiveCheck(storeId);

		if (!activeCheck) {
			return res.json({
				storeId,
				agentConnected: false,
				lastSeen: null,
				message: 'Агент не подключен или не отправлял данные'
			});
		}

		const lastSeenDate = new Date(activeCheck.created_at);
		const secondsAgo = Math.floor((Date.now() - lastSeenDate.getTime()) / 1000);

		return res.json({
			storeId,
			agentConnected: secondsAgo < ACTIVE_CHECK_TTL_SECONDS,
			lastSeen: activeCheck.created_at,
			secondsAgo,
			storeName: activeCheck.store_name,
			lastCheckAmount: activeCheck.check_amount
		});

	} catch (error) {
		console.error('[1C API] Agent status error:', error);
		return res.status(500).json({
			error: 'Internal server error'
		});
	}
});

export default router;
