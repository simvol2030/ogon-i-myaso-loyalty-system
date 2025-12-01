/**
 * Admin API: Stores Management
 * Based on API-CONTRACT-Stores.md
 */

import { Router } from 'express';
import { db } from '../../db/client';
import { stores, cashierTransactions } from '../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { authenticateSession, requireRole } from '../../middleware/session-auth';
import { safeJsonParse } from '../../utils/json';
import { validateStoreData } from '../../utils/validation';

const router = Router();

// 🔒 SECURITY: All admin routes require authentication
router.use(authenticateSession);

/**
 * GET /api/admin/stores - Список магазинов
 */
router.get('/', async (req, res) => {
	try {
		const { status = 'all' } = req.query;

		const conditions: any[] = [];

		if (status === 'active') {
			conditions.push(eq(stores.is_active, true));
		} else if (status === 'inactive') {
			conditions.push(eq(stores.is_active, false));
		}

		// Get stores with stats
		const storesData = await db
			.select({
				id: stores.id,
				name: stores.name,
				city: stores.city, // Sprint 4 Task 1.4: Add city field
				address: stores.address,
				phone: stores.phone,
				hours: stores.hours,
				features: stores.features,
				icon_color: stores.icon_color,
				coords_lat: stores.coords_lat,
				coords_lng: stores.coords_lng,
				status: stores.status,
				is_active: stores.is_active,
				transactionCount: sql<number>`(
					SELECT COUNT(*)
					FROM ${cashierTransactions}
					WHERE ${cashierTransactions.store_id} = ${stores.id}
				)`,
				totalRevenue: sql<number>`(
					SELECT COALESCE(SUM(${cashierTransactions.purchase_amount}), 0)
					FROM ${cashierTransactions}
					WHERE ${cashierTransactions.store_id} = ${stores.id}
				)`
			})
			.from(stores)
			.orderBy(desc(stores.id));

		// 🔒 FIX: Safe JSON parsing with fallback
		const storesResult = storesData.map((s) => ({
			id: s.id,
			name: s.name,
			city: s.city, // Sprint 4 Task 1.4: Return city field
			address: s.address,
			phone: s.phone,
			hours: s.hours,
			features: safeJsonParse<string[]>(s.features, []),
			iconColor: s.icon_color,
			coordinates: {
				lat: s.coords_lat,
				lng: s.coords_lng
			},
			status: s.status,
			isActive: Boolean(s.is_active),
			stats: {
				totalTransactions: Number(s.transactionCount),
				totalRevenue: Number(s.totalRevenue)
			}
		}));

		res.json({
			success: true,
			data: {
				stores: storesResult,
				pagination: {
					page: 1,
					limit: storesResult.length,
					total: storesResult.length,
					totalPages: 1
				}
			}
		});
	} catch (error: any) {
		console.error('Error fetching stores:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/stores - Создать магазин
 * ONLY: super-admin, editor
 */
router.post('/', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const { name, city, address, phone, hours, features, iconColor, coordinates, isActive } = req.body; // Sprint 4 Task 1.4: Add city

		// 🔒 FIX: Add validation
		const validation = validateStoreData(req.body);
		if (!validation.valid) {
			return res.status(400).json({
				success: false,
				error: validation.errors.join('; ')
			});
		}

		const result = await db
			.insert(stores)
			.values({
				name,
				city, // Sprint 4 Task 1.4: Insert city field
				address,
				phone,
				hours,
				features: JSON.stringify(features),
				icon_color: iconColor,
				coords_lat: coordinates.lat,
				coords_lng: coordinates.lng,
				status: 'open',
				closed: false,
				is_active: isActive
			})
			.returning();

		const created = result[0];

		res.status(201).json({
			success: true,
			data: {
				id: created.id,
				name: created.name,
				city: created.city, // Sprint 4 Task 1.4: Return city in response
				address: created.address,
				phone: created.phone,
				hours: created.hours,
				features: safeJsonParse<string[]>(created.features, []),
				iconColor: created.icon_color,
				coordinates: {
					lat: created.coords_lat,
					lng: created.coords_lng
				},
				status: created.status,
				isActive: Boolean(created.is_active)
			}
		});
	} catch (error: any) {
		console.error('Error creating store:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/stores/:id - Обновить магазин
 * ONLY: super-admin, editor
 */
router.put('/:id', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const storeId = parseInt(req.params.id);
		const { name, city, address, phone, hours, features, iconColor, coordinates, isActive } = req.body; // Sprint 4 Task 1.4: Add city

		// 🔒 FIX: Add validation
		const validation = validateStoreData(req.body);
		if (!validation.valid) {
			return res.status(400).json({
				success: false,
				error: validation.errors.join('; ')
			});
		}

		const result = await db
			.update(stores)
			.set({
				name,
				city, // Sprint 4 Task 1.4: Update city field
				address,
				phone,
				hours,
				features: JSON.stringify(features),
				icon_color: iconColor,
				coords_lat: coordinates.lat,
				coords_lng: coordinates.lng,
				is_active: isActive
			})
			.where(eq(stores.id, storeId))
			.returning();

		if (result.length === 0) {
			return res.status(404).json({ success: false, error: 'Магазин не найден' });
		}

		const updated = result[0];

		res.json({
			success: true,
			data: {
				id: updated.id,
				name: updated.name,
				city: updated.city, // Sprint 4 Task 1.4: Return city in response
				address: updated.address,
				phone: updated.phone,
				hours: updated.hours,
				features: safeJsonParse<string[]>(updated.features, []),
				iconColor: updated.icon_color,
				coordinates: {
					lat: updated.coords_lat,
					lng: updated.coords_lng
				},
				status: updated.status,
				isActive: Boolean(updated.is_active)
			}
		});
	} catch (error: any) {
		console.error('Error updating store:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * DELETE /api/admin/stores/:id - Удалить магазин
 * ONLY: super-admin
 */
router.delete('/:id', requireRole('super-admin'), async (req, res) => {
	try {
		const storeId = parseInt(req.params.id);
		const { soft = 'true' } = req.query;

		if (soft === 'true') {
			await db.update(stores).set({ is_active: false }).where(eq(stores.id, storeId));
			res.json({ success: true, message: 'Магазин деактивирован' });
		} else {
			await db.delete(stores).where(eq(stores.id, storeId));
			res.json({ success: true, message: 'Магазин удален' });
		}
	} catch (error: any) {
		console.error('Error deleting store:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

export default router;
