/**
 * Admin Free Delivery Settings API
 * /api/admin/free-delivery-settings/*
 *
 * CRUD operations for free delivery settings management
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db/client';
import { freeDeliverySettings, deliveryLocations } from '../../db/schema';
import { eq, isNotNull, sql } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/admin/free-delivery-settings
 *
 * Get free delivery settings
 *
 * Returns: Free delivery settings object
 */
router.get('/', async (req: Request, res: Response) => {
	try {
		// Get settings (create default if not exists)
		let [settings] = await db
			.select()
			.from(freeDeliverySettings)
			.where(eq(freeDeliverySettings.id, 1))
			.limit(1);

		if (!settings) {
			// Create default settings
			[settings] = await db
				.insert(freeDeliverySettings)
				.values({ id: 1 })
				.returning();
		}

		// Get locations with free delivery threshold
		const locationsWithThreshold = await db
			.select({
				id: deliveryLocations.id,
				name: deliveryLocations.name,
				price: deliveryLocations.price,
				free_delivery_threshold: deliveryLocations.free_delivery_threshold,
				is_enabled: deliveryLocations.is_enabled
			})
			.from(deliveryLocations)
			.where(isNotNull(deliveryLocations.free_delivery_threshold))
			.orderBy(deliveryLocations.name);

		res.json({
			success: true,
			data: {
				...settings,
				locations_with_threshold: locationsWithThreshold
			}
		});
	} catch (error) {
		console.error('Error fetching free delivery settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch free delivery settings'
		});
	}
});

/**
 * PUT /api/admin/free-delivery-settings
 *
 * Update free delivery settings
 *
 * Body:
 * - is_enabled: boolean (optional)
 * - default_threshold: number (optional) - in rubles
 * - widget_enabled: boolean (optional)
 * - widget_title: string (optional)
 * - widget_text: string (optional)
 * - widget_icon: string (optional)
 * - toast_enabled: boolean (optional)
 * - toast_text: string (optional)
 * - toast_show_threshold: number (optional) - in rubles
 *
 * Returns: Updated settings
 */
router.put('/', async (req: Request, res: Response) => {
	try {
		const {
			is_enabled,
			default_threshold,
			widget_enabled,
			widget_title,
			widget_text,
			widget_icon,
			toast_enabled,
			toast_text,
			toast_show_threshold
		} = req.body;

		const updates: any = {};

		// Validate and set fields
		if (is_enabled !== undefined) {
			updates.is_enabled = Boolean(is_enabled);
		}

		if (default_threshold !== undefined) {
			if (typeof default_threshold !== 'number' || default_threshold < 0) {
				return res.status(400).json({
					success: false,
					error: 'Invalid default_threshold (must be >= 0)'
				});
			}
			updates.default_threshold = Math.round(default_threshold);
		}

		if (widget_enabled !== undefined) {
			updates.widget_enabled = Boolean(widget_enabled);
		}

		if (widget_title !== undefined) {
			if (typeof widget_title !== 'string') {
				return res.status(400).json({
					success: false,
					error: 'Invalid widget_title'
				});
			}
			updates.widget_title = widget_title.trim();
		}

		if (widget_text !== undefined) {
			if (typeof widget_text !== 'string') {
				return res.status(400).json({
					success: false,
					error: 'Invalid widget_text'
				});
			}
			updates.widget_text = widget_text;
		}

		if (widget_icon !== undefined) {
			if (typeof widget_icon !== 'string') {
				return res.status(400).json({
					success: false,
					error: 'Invalid widget_icon'
				});
			}
			updates.widget_icon = widget_icon;
		}

		if (toast_enabled !== undefined) {
			updates.toast_enabled = Boolean(toast_enabled);
		}

		if (toast_text !== undefined) {
			if (typeof toast_text !== 'string') {
				return res.status(400).json({
					success: false,
					error: 'Invalid toast_text'
				});
			}
			updates.toast_text = toast_text;
		}

		if (toast_show_threshold !== undefined) {
			if (typeof toast_show_threshold !== 'number' || toast_show_threshold < 0) {
				return res.status(400).json({
					success: false,
					error: 'Invalid toast_show_threshold (must be >= 0)'
				});
			}
			updates.toast_show_threshold = Math.round(toast_show_threshold);
		}

		if (Object.keys(updates).length === 0) {
			return res.status(400).json({
				success: false,
				error: 'No fields to update'
			});
		}

		updates.updated_at = sql`CURRENT_TIMESTAMP`;

		// Check if settings exist
		const [existing] = await db
			.select()
			.from(freeDeliverySettings)
			.where(eq(freeDeliverySettings.id, 1))
			.limit(1);

		let result;
		if (!existing) {
			// Insert new settings
			[result] = await db
				.insert(freeDeliverySettings)
				.values({ id: 1, ...updates })
				.returning();
		} else {
			// Update existing settings
			[result] = await db
				.update(freeDeliverySettings)
				.set(updates)
				.where(eq(freeDeliverySettings.id, 1))
				.returning();
		}

		res.json({
			success: true,
			data: result
		});
	} catch (error) {
		console.error('Error updating free delivery settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update free delivery settings'
		});
	}
});

export default router;
