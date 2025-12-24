/**
 * Content API Routes
 * Public endpoints for TWA content (recommendations, offers, products, stores)
 *
 * These endpoints replace direct DB access from frontend due to WSL/Windows conflict
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { offers, products, stores } from '../db/schema';
import { eq, and, isNotNull, ne, desc } from 'drizzle-orm';

const router = Router();

// ==================== GET /api/content/home ====================
/**
 * Get homepage data (recommendations + offers + products)
 *
 * Response:
 * {
 *   "recommendations": Recommendation[],
 *   "monthOffers": Offer[],      // First 2 active offers
 *   "topProducts": Product[]      // First 6 active products
 * }
 */
router.get('/home', async (req: Request, res: Response) => {
	try {
		// Fetch first 2 active offers WITH show_on_home = true (Sprint 2)
		// HIGH FIX #7: Filter out old promotions without image
		// CRITICAL FIX #1 (Cycle 3): Use Drizzle operators instead of sql template
		const offersList = await db
			.select()
			.from(offers)
			.where(
				and(
					eq(offers.is_active, true),
					eq(offers.show_on_home, true),
					isNotNull(offers.image),
					ne(offers.image, '')
				)
			)
			.limit(2)
			.all();

		// Task 3.3: Fetch first 6 active products WITH show_on_home = true (Sprint 3)
		// HIGH FIX #4: Exclude recommendations from top products
		// HIGH FIX #6: Add explicit ordering (newest first)
		const topProductsList = await db
			.select()
			.from(products)
			.where(
				and(
					eq(products.is_active, true),
					eq(products.show_on_home, true),
					eq(products.is_recommendation, false)
				)
			)
			.orderBy(desc(products.id))
			.limit(6)
			.all();

		// Task 3.4: Fetch recommendations WITHOUT PRICE (Sprint 3)
		// HIGH FIX #7: Add explicit ordering (newest first)
		const recommendationProductsList = await db
			.select({
				id: products.id,
				name: products.name,
				description: products.description,
				image: products.image
				// Do NOT select price, old_price, category (recommendations show no pricing)
			})
			.from(products)
			.where(
				and(
					eq(products.is_active, true),
					eq(products.is_recommendation, true)
				)
			)
			.orderBy(desc(products.id))
			.limit(4)
			.all();

		// Fetch first active store for homepage snippet
		const [firstStore] = await db
			.select()
			.from(stores)
			.where(eq(stores.is_active, true))
			.limit(1)
			.all();

		return res.json({
			recommendations: recommendationProductsList, // Sprint 3: Changed from old recommendations table
			monthOffers: offersList,
			topProducts: topProductsList,
			store: firstStore || null // First store for homepage snippet
		});

	} catch (error) {
		console.error('[CONTENT API] Error fetching home data:', error);
		return res.status(500).json({
			error: 'Internal server error',
			details: process.env.NODE_ENV === 'development' ? String(error) : undefined
		});
	}
});

// ==================== GET /api/content/offers ====================
/**
 * Get all active offers
 *
 * Response:
 * {
 *   "offers": Offer[]
 * }
 */
router.get('/offers', async (req: Request, res: Response) => {
	try {
		const offersList = await db
			.select()
			.from(offers)
			.where(eq(offers.is_active, true))
			.all();

		return res.json({
			offers: offersList
		});

	} catch (error) {
		console.error('[CONTENT API] Error fetching offers:', error);
		return res.status(500).json({
			error: 'Internal server error',
			details: process.env.NODE_ENV === 'development' ? String(error) : undefined
		});
	}
});

// ==================== GET /api/content/stores ====================
/**
 * Get all active stores
 *
 * Response:
 * {
 *   "stores": Store[]
 * }
 */
router.get('/stores', async (req: Request, res: Response) => {
	try {
		const storesList = await db
			.select()
			.from(stores)
			.where(eq(stores.is_active, true))
			.all();

		// Transform stores to match frontend format
		const transformedStores = storesList.map(store => ({
			...store,
			features: JSON.parse(store.features) // Parse JSON string to array
		}));

		return res.json({
			stores: transformedStores
		});

	} catch (error) {
		console.error('[CONTENT API] Error fetching stores:', error);
		return res.status(500).json({
			error: 'Internal server error',
			details: process.env.NODE_ENV === 'development' ? String(error) : undefined
		});
	}
});

// ==================== GET /api/content/products ====================
/**
 * Get all active products
 *
 * Response:
 * {
 *   "products": Product[]
 * }
 */
router.get('/products', async (req: Request, res: Response) => {
	try {
		// HIGH FIX #3: Add explicit ordering for deterministic results
		const productsList = await db
			.select()
			.from(products)
			.where(eq(products.is_active, true))
			.orderBy(desc(products.id))
			.all();

		return res.json({
			products: productsList
		});

	} catch (error) {
		console.error('[CONTENT API] Error fetching products:', error);
		return res.status(500).json({
			error: 'Internal server error',
			details: process.env.NODE_ENV === 'development' ? String(error) : undefined
		});
	}
});

export default router;
