/**
 * Shop API Routes - Public endpoints for shop configuration
 * /api/shop/*
 */

import { Router } from 'express';
import { db } from '../../db/client';
import { deliveryLocations, shopSettings, freeDeliverySettings } from '../../db/schema';
import { eq, like, and, sql, isNotNull } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/shop/delivery-locations
 *
 * Get enabled delivery locations with optional search
 *
 * Query parameters:
 * - search: string (optional) - Search by location name
 * - limit: number (optional) - Max results to return (default: 100)
 *
 * Returns: Array of enabled delivery locations sorted by name
 */
router.get('/delivery-locations', async (req, res) => {
	try {
		const { search, limit = '100' } = req.query;
		const maxLimit = Math.min(parseInt(limit as string) || 100, 300);

		// Build query conditions
		const conditions = [eq(deliveryLocations.is_enabled, true)];

		if (search && typeof search === 'string') {
			conditions.push(like(deliveryLocations.name, `%${search}%`));
		}

		// Execute query
		const locations = await db
			.select({
				id: deliveryLocations.id,
				name: deliveryLocations.name,
				price: deliveryLocations.price,
				free_delivery_threshold: deliveryLocations.free_delivery_threshold
			})
			.from(deliveryLocations)
			.where(and(...conditions))
			.orderBy(deliveryLocations.name)
			.limit(maxLimit);

		res.json({
			success: true,
			data: locations,
			count: locations.length
		});
	} catch (error) {
		console.error('Error fetching delivery locations:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch delivery locations'
		});
	}
});

/**
 * GET /api/shop/settings
 *
 * Get public shop settings (delivery configuration)
 *
 * Returns: Shop settings including:
 * - delivery_enabled: boolean
 * - pickup_enabled: boolean
 * - delivery_cost: number (global delivery cost in kopeks)
 * - free_delivery_from: number | null (free delivery threshold in kopeks)
 * - min_order_amount: number (minimum order amount in kopeks)
 * - currency: string
 */
router.get('/settings', async (req, res) => {
	try {
		const [settings] = await db
			.select({
				delivery_enabled: shopSettings.delivery_enabled,
				pickup_enabled: shopSettings.pickup_enabled,
				delivery_cost: shopSettings.delivery_cost,
				free_delivery_from: shopSettings.free_delivery_from,
				min_order_amount: shopSettings.min_order_amount,
				currency: shopSettings.currency
			})
			.from(shopSettings)
			.where(eq(shopSettings.id, 1))
			.limit(1);

		if (!settings) {
			return res.status(404).json({
				success: false,
				error: 'Shop settings not found'
			});
		}

		res.json({
			success: true,
			data: settings
		});
	} catch (error) {
		console.error('Error fetching shop settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch shop settings'
		});
	}
});

/**
 * GET /api/shop/free-delivery-info
 *
 * Get free delivery information for frontend display
 *
 * Returns: Free delivery settings including widget and toast config
 */
router.get('/free-delivery-info', async (req, res) => {
	try {
		// Get settings
		let [settings] = await db
			.select()
			.from(freeDeliverySettings)
			.where(eq(freeDeliverySettings.id, 1))
			.limit(1);

		// If no settings exist, return disabled state
		if (!settings) {
			return res.json({
				success: true,
				data: {
					enabled: false,
					defaultThreshold: 3000,
					widget: {
						enabled: false,
						title: 'Бесплатная доставка',
						text: 'При заказе от {threshold}₽ доставка бесплатная в выбранные населённые пункты',
						icon: '🚚'
					},
					toast: {
						enabled: false,
						text: 'Добавьте ещё на {remaining}₽ — доставка может быть бесплатной!',
						showThreshold: 500
					},
					locationsCount: 0
				}
			});
		}

		// Count locations with free delivery threshold
		const [{ count }] = await db
			.select({ count: sql<number>`count(*)` })
			.from(deliveryLocations)
			.where(and(
				eq(deliveryLocations.is_enabled, true),
				isNotNull(deliveryLocations.free_delivery_threshold)
			));

		res.json({
			success: true,
			data: {
				enabled: settings.is_enabled,
				defaultThreshold: settings.default_threshold,
				widget: {
					enabled: settings.widget_enabled,
					title: settings.widget_title,
					text: settings.widget_text,
					icon: settings.widget_icon
				},
				toast: {
					enabled: settings.toast_enabled,
					text: settings.toast_text,
					showThreshold: settings.toast_show_threshold
				},
				locationsCount: count
			}
		});
	} catch (error) {
		console.error('Error fetching free delivery info:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch free delivery info'
		});
	}
});

export default router;
