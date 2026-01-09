/**
 * Admin Delivery Locations API
 * /api/admin/delivery-locations/*
 *
 * CRUD operations for delivery locations management
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db/client';
import { deliveryLocations } from '../../db/schema';
import { eq, like, desc, sql, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/admin/delivery-locations
 *
 * Get all delivery locations (enabled and disabled) with pagination and search
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 50, max: 100)
 * - search: string (optional) - Search by location name
 * - enabled: boolean (optional) - Filter by enabled status
 *
 * Returns: Paginated list of delivery locations
 */
router.get('/', async (req: Request, res: Response) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
		const offset = (page - 1) * limit;
		const { search, enabled } = req.query;

		// Build query conditions
		const conditions = [];

		if (search && typeof search === 'string') {
			conditions.push(like(deliveryLocations.name, `%${search}%`));
		}

		if (enabled !== undefined) {
			const isEnabled = enabled === 'true' || enabled === '1';
			conditions.push(eq(deliveryLocations.is_enabled, isEnabled));
		}

		// Get total count
		const [{ count }] = await db
			.select({ count: sql<number>`count(*)` })
			.from(deliveryLocations)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		// Get paginated data
		const locations = await db
			.select()
			.from(deliveryLocations)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(deliveryLocations.name)
			.limit(limit)
			.offset(offset);

		res.json({
			success: true,
			data: locations,
			pagination: {
				page,
				limit,
				total: count,
				totalPages: Math.ceil(count / limit)
			}
		});
	} catch (error) {
		console.error('Error fetching delivery locations (admin):', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch delivery locations'
		});
	}
});

/**
 * POST /api/admin/delivery-locations
 *
 * Create a new delivery location
 *
 * Body:
 * - name: string (required) - Location name
 * - price: number (required) - Delivery price in kopeks
 * - is_enabled: boolean (optional, default: true)
 * - free_delivery_threshold: number | null (optional) - Free delivery threshold in rubles
 *
 * Returns: Created delivery location
 */
router.post('/', async (req: Request, res: Response) => {
	try {
		const { name, price, is_enabled = true, free_delivery_threshold } = req.body;

		// Validation
		if (!name || typeof name !== 'string' || name.trim() === '') {
			return res.status(400).json({
				success: false,
				error: 'Location name is required'
			});
		}

		if (price === undefined || typeof price !== 'number' || price < 0) {
			return res.status(400).json({
				success: false,
				error: 'Valid price is required (must be >= 0)'
			});
		}

		// Check for duplicate name
		const existing = await db
			.select()
			.from(deliveryLocations)
			.where(eq(deliveryLocations.name, name.trim()))
			.limit(1);

		if (existing.length > 0) {
			return res.status(409).json({
				success: false,
				error: 'Location with this name already exists'
			});
		}

		// Validate free_delivery_threshold if provided
		let validatedThreshold: number | null = null;
		if (free_delivery_threshold !== undefined && free_delivery_threshold !== null) {
			if (typeof free_delivery_threshold !== 'number' || free_delivery_threshold < 0) {
				return res.status(400).json({
					success: false,
					error: 'Invalid free_delivery_threshold (must be >= 0 or null)'
				});
			}
			validatedThreshold = Math.round(free_delivery_threshold);
		}

		// Create location
		const [location] = await db
			.insert(deliveryLocations)
			.values({
				name: name.trim(),
				price: Math.round(price), // Ensure integer
				is_enabled: Boolean(is_enabled),
				free_delivery_threshold: validatedThreshold
			})
			.returning();

		res.status(201).json({
			success: true,
			data: location
		});
	} catch (error) {
		console.error('Error creating delivery location:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create delivery location'
		});
	}
});

/**
 * PUT /api/admin/delivery-locations/:id
 *
 * Update a delivery location
 *
 * Body:
 * - name: string (optional)
 * - price: number (optional)
 * - is_enabled: boolean (optional)
 * - free_delivery_threshold: number | null (optional) - Free delivery threshold in rubles
 *
 * Returns: Updated delivery location
 */
router.put('/:id', async (req: Request, res: Response) => {
	try {
		const id = parseInt(req.params.id);
		const { name, price, is_enabled, free_delivery_threshold } = req.body;

		if (isNaN(id)) {
			return res.status(400).json({
				success: false,
				error: 'Invalid location ID'
			});
		}

		// Check if location exists
		const [existing] = await db
			.select()
			.from(deliveryLocations)
			.where(eq(deliveryLocations.id, id))
			.limit(1);

		if (!existing) {
			return res.status(404).json({
				success: false,
				error: 'Delivery location not found'
			});
		}

		// Build update object
		const updates: any = {};

		if (name !== undefined) {
			if (typeof name !== 'string' || name.trim() === '') {
				return res.status(400).json({
					success: false,
					error: 'Invalid name'
				});
			}

			// Check for duplicate name (excluding current location)
			const [duplicate] = await db
				.select()
				.from(deliveryLocations)
				.where(and(
					eq(deliveryLocations.name, name.trim()),
					sql`${deliveryLocations.id} != ${id}`
				))
				.limit(1);

			if (duplicate) {
				return res.status(409).json({
					success: false,
					error: 'Location with this name already exists'
				});
			}

			updates.name = name.trim();
		}

		if (price !== undefined) {
			if (typeof price !== 'number' || price < 0) {
				return res.status(400).json({
					success: false,
					error: 'Invalid price (must be >= 0)'
				});
			}
			updates.price = Math.round(price);
		}

		if (is_enabled !== undefined) {
			updates.is_enabled = Boolean(is_enabled);
		}

		// Handle free_delivery_threshold - can be set to null to disable
		if (free_delivery_threshold !== undefined) {
			if (free_delivery_threshold === null) {
				updates.free_delivery_threshold = null;
			} else if (typeof free_delivery_threshold !== 'number' || free_delivery_threshold < 0) {
				return res.status(400).json({
					success: false,
					error: 'Invalid free_delivery_threshold (must be >= 0 or null)'
				});
			} else {
				updates.free_delivery_threshold = Math.round(free_delivery_threshold);
			}
		}

		if (Object.keys(updates).length === 0) {
			return res.status(400).json({
				success: false,
				error: 'No fields to update'
			});
		}

		updates.updated_at = sql`CURRENT_TIMESTAMP`;

		// Update location
		const [updated] = await db
			.update(deliveryLocations)
			.set(updates)
			.where(eq(deliveryLocations.id, id))
			.returning();

		res.json({
			success: true,
			data: updated
		});
	} catch (error) {
		console.error('Error updating delivery location:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update delivery location'
		});
	}
});

/**
 * DELETE /api/admin/delivery-locations/:id
 *
 * Delete a delivery location
 *
 * Returns: Success message
 */
router.delete('/:id', async (req: Request, res: Response) => {
	try {
		const id = parseInt(req.params.id);

		if (isNaN(id)) {
			return res.status(400).json({
				success: false,
				error: 'Invalid location ID'
			});
		}

		// Check if location exists
		const [existing] = await db
			.select()
			.from(deliveryLocations)
			.where(eq(deliveryLocations.id, id))
			.limit(1);

		if (!existing) {
			return res.status(404).json({
				success: false,
				error: 'Delivery location not found'
			});
		}

		// Delete location
		await db
			.delete(deliveryLocations)
			.where(eq(deliveryLocations.id, id));

		res.json({
			success: true,
			message: 'Delivery location deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting delivery location:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete delivery location'
		});
	}
});

/**
 * PATCH /api/admin/delivery-locations/:id/toggle
 *
 * Toggle enable/disable status of a delivery location
 *
 * Returns: Updated delivery location
 */
router.patch('/:id/toggle', async (req: Request, res: Response) => {
	try {
		const id = parseInt(req.params.id);

		if (isNaN(id)) {
			return res.status(400).json({
				success: false,
				error: 'Invalid location ID'
			});
		}

		// Get current status
		const [existing] = await db
			.select()
			.from(deliveryLocations)
			.where(eq(deliveryLocations.id, id))
			.limit(1);

		if (!existing) {
			return res.status(404).json({
				success: false,
				error: 'Delivery location not found'
			});
		}

		// Toggle status
		const [updated] = await db
			.update(deliveryLocations)
			.set({
				is_enabled: !existing.is_enabled,
				updated_at: sql`CURRENT_TIMESTAMP`
			})
			.where(eq(deliveryLocations.id, id))
			.returning();

		res.json({
			success: true,
			data: updated
		});
	} catch (error) {
		console.error('Error toggling delivery location:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to toggle delivery location'
		});
	}
});

export default router;
