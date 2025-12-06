/**
 * Public API: Shopping Cart
 * Works with session_id (cookies) for guests
 * Based on SHOP_EXTENSION_PLAN.md
 */

import { Router } from 'express';
import { db } from '../../db/client';
import { cartItems, products } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Helper: Get or create session ID from cookies
function getSessionId(req: any, res: any): string {
	let sessionId = req.cookies?.cart_session;
	if (!sessionId) {
		sessionId = uuidv4();
		res.cookie('cart_session', sessionId, {
			httpOnly: true,
			maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
			sameSite: 'lax'
		});
	}
	return sessionId;
}

/**
 * GET /api/cart - Get cart items
 */
router.get('/', async (req, res) => {
	try {
		const sessionId = getSessionId(req, res);

		// Get cart items with product details
		const items = await db
			.select({
				id: cartItems.id,
				productId: cartItems.product_id,
				quantity: cartItems.quantity,
				createdAt: cartItems.created_at,
				// Product details
				productName: products.name,
				productPrice: products.price,
				productOldPrice: products.old_price,
				productImage: products.image,
				productCategory: products.category,
				productQuantityInfo: products.quantity_info,
				productIsActive: products.is_active
			})
			.from(cartItems)
			.leftJoin(products, eq(cartItems.product_id, products.id))
			.where(eq(cartItems.session_id, sessionId))
			.orderBy(desc(cartItems.created_at));

		// Filter out items where product is no longer active
		const activeItems = items.filter(item => item.productIsActive);

		// Calculate totals
		const subtotal = activeItems.reduce((sum, item) => {
			return sum + (item.productPrice || 0) * item.quantity;
		}, 0);

		const itemCount = activeItems.reduce((sum, item) => sum + item.quantity, 0);

		res.json({
			success: true,
			data: {
				items: activeItems.map(item => ({
					id: item.id,
					productId: item.productId,
					quantity: item.quantity,
					product: {
						name: item.productName,
						price: item.productPrice,
						oldPrice: item.productOldPrice,
						image: item.productImage,
						category: item.productCategory,
						quantityInfo: item.productQuantityInfo
					},
					itemTotal: (item.productPrice || 0) * item.quantity
				})),
				summary: {
					itemCount,
					subtotal,
					// TODO: Add delivery cost calculation based on shop settings
					deliveryCost: 0,
					total: subtotal
				}
			}
		});
	} catch (error: any) {
		console.error('Error fetching cart:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/cart/add - Add item to cart
 */
router.post('/add', async (req, res) => {
	try {
		const sessionId = getSessionId(req, res);
		const { productId, quantity = 1 } = req.body;

		if (!productId) {
			return res.status(400).json({ success: false, error: 'Product ID is required' });
		}

		if (quantity < 1) {
			return res.status(400).json({ success: false, error: 'Quantity must be at least 1' });
		}

		// Check if product exists and is active
		const product = await db
			.select()
			.from(products)
			.where(and(eq(products.id, productId), eq(products.is_active, true)))
			.limit(1);

		if (product.length === 0) {
			return res.status(404).json({ success: false, error: 'Product not found or not available' });
		}

		// Check if item already in cart
		const existingItem = await db
			.select()
			.from(cartItems)
			.where(and(
				eq(cartItems.session_id, sessionId),
				eq(cartItems.product_id, productId)
			))
			.limit(1);

		let cartItem;
		if (existingItem.length > 0) {
			// Update quantity
			const newQuantity = existingItem[0].quantity + quantity;
			const result = await db
				.update(cartItems)
				.set({
					quantity: newQuantity,
					updated_at: new Date().toISOString()
				})
				.where(eq(cartItems.id, existingItem[0].id))
				.returning();
			cartItem = result[0];
		} else {
			// Insert new item
			const result = await db
				.insert(cartItems)
				.values({
					session_id: sessionId,
					product_id: productId,
					quantity
				})
				.returning();
			cartItem = result[0];
		}

		// Get updated cart count
		const cartCount = await db
			.select({ quantity: cartItems.quantity })
			.from(cartItems)
			.where(eq(cartItems.session_id, sessionId));

		const totalItems = cartCount.reduce((sum, item) => sum + item.quantity, 0);

		res.status(201).json({
			success: true,
			data: {
				id: cartItem.id,
				productId: cartItem.product_id,
				quantity: cartItem.quantity,
				cartItemCount: totalItems
			},
			message: 'Item added to cart'
		});
	} catch (error: any) {
		console.error('Error adding to cart:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/cart/:id - Update item quantity
 */
router.put('/:id', async (req, res) => {
	try {
		const sessionId = getSessionId(req, res);
		const itemId = parseInt(req.params.id);
		const { quantity } = req.body;

		if (quantity === undefined || quantity < 0) {
			return res.status(400).json({ success: false, error: 'Valid quantity is required' });
		}

		// If quantity is 0, delete the item
		if (quantity === 0) {
			await db
				.delete(cartItems)
				.where(and(
					eq(cartItems.id, itemId),
					eq(cartItems.session_id, sessionId)
				));

			return res.json({
				success: true,
				message: 'Item removed from cart'
			});
		}

		// Update quantity
		const result = await db
			.update(cartItems)
			.set({
				quantity,
				updated_at: new Date().toISOString()
			})
			.where(and(
				eq(cartItems.id, itemId),
				eq(cartItems.session_id, sessionId)
			))
			.returning();

		if (result.length === 0) {
			return res.status(404).json({ success: false, error: 'Cart item not found' });
		}

		res.json({
			success: true,
			data: {
				id: result[0].id,
				quantity: result[0].quantity
			}
		});
	} catch (error: any) {
		console.error('Error updating cart item:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * DELETE /api/cart/:id - Remove item from cart
 */
router.delete('/:id', async (req, res) => {
	try {
		const sessionId = getSessionId(req, res);
		const itemId = parseInt(req.params.id);

		const result = await db
			.delete(cartItems)
			.where(and(
				eq(cartItems.id, itemId),
				eq(cartItems.session_id, sessionId)
			))
			.returning();

		if (result.length === 0) {
			return res.status(404).json({ success: false, error: 'Cart item not found' });
		}

		res.json({
			success: true,
			message: 'Item removed from cart'
		});
	} catch (error: any) {
		console.error('Error removing cart item:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/cart/clear - Clear entire cart
 */
router.post('/clear', async (req, res) => {
	try {
		const sessionId = getSessionId(req, res);

		await db
			.delete(cartItems)
			.where(eq(cartItems.session_id, sessionId));

		res.json({
			success: true,
			message: 'Cart cleared'
		});
	} catch (error: any) {
		console.error('Error clearing cart:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/cart/count - Get cart item count (for header badge)
 */
router.get('/count', async (req, res) => {
	try {
		const sessionId = getSessionId(req, res);

		const items = await db
			.select({ quantity: cartItems.quantity })
			.from(cartItems)
			.where(eq(cartItems.session_id, sessionId));

		const count = items.reduce((sum, item) => sum + item.quantity, 0);

		res.json({
			success: true,
			data: { count }
		});
	} catch (error: any) {
		console.error('Error getting cart count:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

export default router;
