/**
 * Public API: Orders
 * Handles order creation from checkout
 * Based on SHOP_EXTENSION_PLAN.md
 */

import { Router } from 'express';
import { db } from '../../db/client';
import {
	orders,
	orderItems,
	orderStatusHistory,
	cartItems,
	products,
	shopSettings,
	stores
} from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { notifyNewOrder } from '../../services/notifications';

const router = Router();

// Helper: Get session ID from cookies
function getSessionId(req: any): string | null {
	return req.cookies?.cart_session || null;
}

// Generate order number: PREFIX-YYMMDD-XXXX
function generateOrderNumber(): string {
	const now = new Date();
	const date = now.toISOString().slice(2, 10).replace(/-/g, '');
	const random = Math.floor(1000 + Math.random() * 9000);
	return `ORD-${date}-${random}`;
}

// Convert rubles to kopeks
function toCopecks(rubles: number): number {
	return Math.round(rubles * 100);
}

// Convert kopeks to rubles
function toRubles(copecks: number): number {
	return copecks / 100;
}

/**
 * POST /api/orders - Create order from cart
 */
router.post('/', async (req, res) => {
	try {
		const sessionId = getSessionId(req);

		if (!sessionId) {
			return res.status(400).json({
				success: false,
				error: 'No cart session found'
			});
		}

		const {
			customerName,
			customerPhone,
			customerEmail,
			deliveryType, // 'pickup' | 'delivery'
			deliveryAddress,
			deliveryEntrance,
			deliveryFloor,
			deliveryApartment,
			deliveryIntercom,
			storeId, // For pickup
			notes
		} = req.body;

		// Validate required fields
		if (!customerName || !customerPhone) {
			return res.status(400).json({
				success: false,
				error: 'Customer name and phone are required'
			});
		}

		if (!deliveryType || !['pickup', 'delivery'].includes(deliveryType)) {
			return res.status(400).json({
				success: false,
				error: 'Delivery type must be "pickup" or "delivery"'
			});
		}

		if (deliveryType === 'delivery' && !deliveryAddress) {
			return res.status(400).json({
				success: false,
				error: 'Delivery address is required for delivery orders'
			});
		}

		if (deliveryType === 'pickup' && !storeId) {
			return res.status(400).json({
				success: false,
				error: 'Store selection is required for pickup orders'
			});
		}

		// Get cart items
		const cartData = await db
			.select({
				id: cartItems.id,
				productId: cartItems.product_id,
				quantity: cartItems.quantity,
				productName: products.name,
				productPrice: products.price,
				productIsActive: products.is_active
			})
			.from(cartItems)
			.leftJoin(products, eq(cartItems.product_id, products.id))
			.where(eq(cartItems.session_id, sessionId));

		// Filter active products
		const activeItems = cartData.filter(item => item.productIsActive);

		if (activeItems.length === 0) {
			return res.status(400).json({
				success: false,
				error: 'Cart is empty or contains no available products'
			});
		}

		// Get shop settings for delivery cost
		const settings = await db
			.select()
			.from(shopSettings)
			.where(eq(shopSettings.id, 1))
			.limit(1);

		const shopConfig = settings[0] || {
			delivery_cost: 0,
			free_delivery_from: null,
			min_order_amount: 0,
			delivery_enabled: true,
			pickup_enabled: true
		};

		// Check delivery mode availability
		if (deliveryType === 'delivery' && !shopConfig.delivery_enabled) {
			return res.status(400).json({
				success: false,
				error: 'Delivery is not available'
			});
		}

		if (deliveryType === 'pickup' && !shopConfig.pickup_enabled) {
			return res.status(400).json({
				success: false,
				error: 'Pickup is not available'
			});
		}

		// Calculate subtotal in copecks
		const subtotal = activeItems.reduce((sum, item) => {
			return sum + toCopecks(item.productPrice || 0) * item.quantity;
		}, 0);

		// Check minimum order amount
		if (shopConfig.min_order_amount && subtotal < shopConfig.min_order_amount) {
			return res.status(400).json({
				success: false,
				error: `Minimum order amount is ${toRubles(shopConfig.min_order_amount)} rubles`
			});
		}

		// Calculate delivery cost
		let deliveryCost = 0;
		if (deliveryType === 'delivery') {
			deliveryCost = shopConfig.delivery_cost || 0;

			// Free delivery threshold
			if (shopConfig.free_delivery_from && subtotal >= shopConfig.free_delivery_from) {
				deliveryCost = 0;
			}
		}

		const total = subtotal + deliveryCost;

		// Generate order number
		const orderNumber = generateOrderNumber();

		// Validate store if pickup
		if (deliveryType === 'pickup') {
			const store = await db
				.select()
				.from(stores)
				.where(and(eq(stores.id, storeId), eq(stores.is_active, true)))
				.limit(1);

			if (store.length === 0) {
				return res.status(400).json({
					success: false,
					error: 'Selected store is not available'
				});
			}
		}

		// Create order
		const [newOrder] = await db
			.insert(orders)
			.values({
				order_number: orderNumber,
				status: 'new',
				customer_name: customerName,
				customer_phone: customerPhone,
				customer_email: customerEmail || null,
				delivery_type: deliveryType,
				delivery_address: deliveryType === 'delivery' ? deliveryAddress : null,
				delivery_entrance: deliveryType === 'delivery' ? deliveryEntrance : null,
				delivery_floor: deliveryType === 'delivery' ? deliveryFloor : null,
				delivery_apartment: deliveryType === 'delivery' ? deliveryApartment : null,
				delivery_intercom: deliveryType === 'delivery' ? deliveryIntercom : null,
				store_id: deliveryType === 'pickup' ? storeId : null,
				subtotal,
				delivery_cost: deliveryCost,
				discount_amount: 0,
				total,
				notes: notes || null
			})
			.returning();

		// Create order items (snapshots)
		for (const item of activeItems) {
			await db.insert(orderItems).values({
				order_id: newOrder.id,
				product_id: item.productId,
				product_name: item.productName || 'Unknown product',
				product_price: toCopecks(item.productPrice || 0),
				quantity: item.quantity,
				total: toCopecks(item.productPrice || 0) * item.quantity
			});
		}

		// Create initial status history
		await db.insert(orderStatusHistory).values({
			order_id: newOrder.id,
			old_status: null,
			new_status: 'new',
			changed_by: 'system',
			notes: 'Order created'
		});

		// Clear cart
		await db
			.delete(cartItems)
			.where(eq(cartItems.session_id, sessionId));

		// Send notification (non-blocking)
		let storeName: string | undefined;
		if (deliveryType === 'pickup' && storeId) {
			const [storeData] = await db
				.select({ name: stores.name })
				.from(stores)
				.where(eq(stores.id, storeId))
				.limit(1);
			storeName = storeData?.name;
		}

		notifyNewOrder({
			orderNumber,
			customerName,
			customerPhone,
			customerEmail: customerEmail || undefined,
			deliveryType,
			deliveryAddress: deliveryType === 'delivery' ? deliveryAddress : undefined,
			storeName,
			items: activeItems.map(item => ({
				name: item.productName || 'Unknown',
				quantity: item.quantity,
				price: item.productPrice || 0
			})),
			subtotal: toRubles(subtotal),
			deliveryCost: toRubles(deliveryCost),
			total: toRubles(total),
			notes: notes || undefined
		}).catch(err => console.error('Failed to send notification:', err));

		// Return order details
		res.status(201).json({
			success: true,
			data: {
				id: newOrder.id,
				orderNumber: newOrder.order_number,
				status: newOrder.status,
				subtotal: toRubles(subtotal),
				deliveryCost: toRubles(deliveryCost),
				total: toRubles(total),
				deliveryType,
				customerName,
				customerPhone
			},
			message: 'Order created successfully'
		});

	} catch (error: any) {
		console.error('Error creating order:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/orders/:orderNumber - Get order by number (public)
 */
router.get('/:orderNumber', async (req, res) => {
	try {
		const { orderNumber } = req.params;

		// Get order
		const [order] = await db
			.select()
			.from(orders)
			.where(eq(orders.order_number, orderNumber))
			.limit(1);

		if (!order) {
			return res.status(404).json({
				success: false,
				error: 'Order not found'
			});
		}

		// Get order items
		const items = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, order.id));

		// Get store info if pickup
		let store = null;
		if (order.store_id) {
			const [storeData] = await db
				.select()
				.from(stores)
				.where(eq(stores.id, order.store_id))
				.limit(1);
			store = storeData;
		}

		// Get status history
		const history = await db
			.select()
			.from(orderStatusHistory)
			.where(eq(orderStatusHistory.order_id, order.id))
			.orderBy(desc(orderStatusHistory.created_at));

		res.json({
			success: true,
			data: {
				id: order.id,
				orderNumber: order.order_number,
				status: order.status,
				createdAt: order.created_at,
				customer: {
					name: order.customer_name,
					phone: order.customer_phone,
					email: order.customer_email
				},
				delivery: {
					type: order.delivery_type,
					address: order.delivery_address,
					entrance: order.delivery_entrance,
					floor: order.delivery_floor,
					apartment: order.delivery_apartment,
					intercom: order.delivery_intercom,
					store: store ? {
						id: store.id,
						name: store.name,
						address: store.address
					} : null
				},
				items: items.map(item => ({
					productId: item.product_id,
					productName: item.product_name,
					productPrice: toRubles(item.product_price),
					quantity: item.quantity,
					total: toRubles(item.total)
				})),
				totals: {
					subtotal: toRubles(order.subtotal),
					deliveryCost: toRubles(order.delivery_cost),
					discount: toRubles(order.discount_amount),
					total: toRubles(order.total)
				},
				notes: order.notes,
				statusHistory: history.map(h => ({
					status: h.new_status,
					changedAt: h.created_at,
					notes: h.notes
				}))
			}
		});
	} catch (error: any) {
		console.error('Error fetching order:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/orders/settings/shop - Get shop settings for checkout
 */
router.get('/settings/shop', async (req, res) => {
	try {
		const [settings] = await db
			.select({
				shopName: shopSettings.shop_name,
				deliveryEnabled: shopSettings.delivery_enabled,
				pickupEnabled: shopSettings.pickup_enabled,
				deliveryCost: shopSettings.delivery_cost,
				freeDeliveryFrom: shopSettings.free_delivery_from,
				minOrderAmount: shopSettings.min_order_amount
			})
			.from(shopSettings)
			.where(eq(shopSettings.id, 1))
			.limit(1);

		// Get active stores for pickup
		const activeStores = await db
			.select({
				id: stores.id,
				name: stores.name,
				address: stores.address,
				phone: stores.phone,
				hours: stores.hours
			})
			.from(stores)
			.where(and(eq(stores.is_active, true), eq(stores.closed, false)));

		res.json({
			success: true,
			data: {
				shopName: settings?.shopName || 'Shop',
				deliveryEnabled: settings?.deliveryEnabled ?? true,
				pickupEnabled: settings?.pickupEnabled ?? true,
				deliveryCost: settings?.deliveryCost ? toRubles(settings.deliveryCost) : 0,
				freeDeliveryFrom: settings?.freeDeliveryFrom ? toRubles(settings.freeDeliveryFrom) : null,
				minOrderAmount: settings?.minOrderAmount ? toRubles(settings.minOrderAmount) : 0,
				stores: activeStores
			}
		});
	} catch (error: any) {
		console.error('Error fetching shop settings:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

export default router;
