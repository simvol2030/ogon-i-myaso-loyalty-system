/**
 * Admin API: Orders Management
 * Provides full CRUD operations for orders in admin panel
 */

import { Router } from 'express';
import { db } from '../../db/client';
import {
	orders,
	orderItems,
	orderStatusHistory,
	stores,
	loyaltyUsers
} from '../../db/schema';
import { eq, desc, and, gte, lte, like, or, sql } from 'drizzle-orm';
import { notifyStatusChange } from '../../services/notifications';

const router = Router();

// Helper: Convert kopeks to rubles
function toRubles(copecks: number): number {
	return copecks / 100;
}

// Status labels for display
const statusLabels: Record<string, string> = {
	new: 'Новый',
	confirmed: 'Подтверждён',
	processing: 'В обработке',
	shipped: 'Отправлен',
	delivered: 'Доставлен',
	cancelled: 'Отменён'
};

/**
 * GET /api/admin/orders - Get all orders with filters
 */
router.get('/', async (req, res) => {
	try {
		const {
			status,
			search,
			dateFrom,
			dateTo,
			page = '1',
			limit = '20'
		} = req.query;

		const pageNum = parseInt(page as string);
		const limitNum = parseInt(limit as string);
		const offset = (pageNum - 1) * limitNum;

		// Build where conditions
		const conditions = [];

		if (status && status !== 'all') {
			conditions.push(eq(orders.status, status as string));
		}

		if (dateFrom) {
			conditions.push(gte(orders.created_at, dateFrom as string));
		}

		if (dateTo) {
			conditions.push(lte(orders.created_at, dateTo as string));
		}

		// Get orders with optional search
		let ordersList;
		if (search) {
			const searchPattern = `%${search}%`;
			// Search in order number, customer name, phone
			ordersList = await db
				.select({
					id: orders.id,
					orderNumber: orders.order_number,
					status: orders.status,
					customerName: orders.customer_name,
					customerPhone: orders.customer_phone,
					customerEmail: orders.customer_email,
					deliveryType: orders.delivery_type,
					deliveryAddress: orders.delivery_address,
					storeId: orders.store_id,
					subtotal: orders.subtotal,
					deliveryCost: orders.delivery_cost,
					discountAmount: orders.discount_amount,
					total: orders.total,
					notes: orders.notes,
					createdAt: orders.created_at,
					updatedAt: orders.updated_at
				})
				.from(orders)
				.where(
					and(
						...conditions,
						or(
							like(orders.order_number, searchPattern),
							like(orders.customer_name, searchPattern),
							like(orders.customer_phone, searchPattern)
						)
					)
				)
				.orderBy(desc(orders.created_at))
				.limit(limitNum)
				.offset(offset);
		} else {
			ordersList = await db
				.select({
					id: orders.id,
					orderNumber: orders.order_number,
					status: orders.status,
					customerName: orders.customer_name,
					customerPhone: orders.customer_phone,
					customerEmail: orders.customer_email,
					deliveryType: orders.delivery_type,
					deliveryAddress: orders.delivery_address,
					storeId: orders.store_id,
					subtotal: orders.subtotal,
					deliveryCost: orders.delivery_cost,
					discountAmount: orders.discount_amount,
					total: orders.total,
					notes: orders.notes,
					createdAt: orders.created_at,
					updatedAt: orders.updated_at
				})
				.from(orders)
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(orders.created_at))
				.limit(limitNum)
				.offset(offset);
		}

		// Get total count for pagination
		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(orders)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		const totalCount = countResult?.count || 0;

		// Get status counts for filters
		const statusCounts = await db
			.select({
				status: orders.status,
				count: sql<number>`count(*)`
			})
			.from(orders)
			.groupBy(orders.status);

		const statusCountMap: Record<string, number> = {};
		for (const s of statusCounts) {
			statusCountMap[s.status] = s.count;
		}

		res.json({
			success: true,
			data: {
				orders: ordersList.map(order => ({
					id: order.id,
					orderNumber: order.orderNumber,
					status: order.status,
					statusLabel: statusLabels[order.status] || order.status,
					customer: {
						name: order.customerName,
						phone: order.customerPhone,
						email: order.customerEmail
					},
					deliveryType: order.deliveryType,
					deliveryAddress: order.deliveryAddress,
					storeId: order.storeId,
					totals: {
						subtotal: toRubles(order.subtotal),
						deliveryCost: toRubles(order.deliveryCost),
						discount: toRubles(order.discountAmount),
						total: toRubles(order.total)
					},
					notes: order.notes,
					createdAt: order.createdAt,
					updatedAt: order.updatedAt
				})),
				pagination: {
					page: pageNum,
					limit: limitNum,
					total: totalCount,
					totalPages: Math.ceil(totalCount / limitNum)
				},
				statusCounts: statusCountMap
			}
		});
	} catch (error: any) {
		console.error('Error fetching orders:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/admin/orders/:id - Get order details
 */
router.get('/:id', async (req, res) => {
	try {
		const orderId = parseInt(req.params.id);

		// Get order
		const [order] = await db
			.select()
			.from(orders)
			.where(eq(orders.id, orderId))
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
			.where(eq(orderItems.order_id, orderId));

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

		// Get linked loyalty user if exists
		let loyaltyUser = null;
		if (order.user_id) {
			const [userData] = await db
				.select()
				.from(loyaltyUsers)
				.where(eq(loyaltyUsers.id, order.user_id))
				.limit(1);
			loyaltyUser = userData;
		}

		// Get status history
		const history = await db
			.select()
			.from(orderStatusHistory)
			.where(eq(orderStatusHistory.order_id, orderId))
			.orderBy(desc(orderStatusHistory.created_at));

		res.json({
			success: true,
			data: {
				id: order.id,
				orderNumber: order.order_number,
				status: order.status,
				statusLabel: statusLabels[order.status] || order.status,
				customer: {
					name: order.customer_name,
					phone: order.customer_phone,
					email: order.customer_email
				},
				loyaltyUser: loyaltyUser ? {
					id: loyaltyUser.id,
					telegramUserId: loyaltyUser.telegram_user_id,
					firstName: loyaltyUser.first_name,
					lastName: loyaltyUser.last_name,
					cardNumber: loyaltyUser.card_number,
					balance: loyaltyUser.current_balance
				} : null,
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
						address: store.address,
						phone: store.phone
					} : null
				},
				items: items.map(item => ({
					id: item.id,
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
					id: h.id,
					oldStatus: h.old_status,
					newStatus: h.new_status,
					newStatusLabel: statusLabels[h.new_status] || h.new_status,
					changedBy: h.changed_by,
					notes: h.notes,
					createdAt: h.created_at
				})),
				createdAt: order.created_at,
				updatedAt: order.updated_at
			}
		});
	} catch (error: any) {
		console.error('Error fetching order:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/orders/:id/status - Update order status
 */
router.put('/:id/status', async (req, res) => {
	try {
		const orderId = parseInt(req.params.id);
		const { status, notes, changedBy } = req.body;

		const validStatuses = ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
		if (!validStatuses.includes(status)) {
			return res.status(400).json({
				success: false,
				error: 'Invalid status'
			});
		}

		// Get current order
		const [order] = await db
			.select()
			.from(orders)
			.where(eq(orders.id, orderId))
			.limit(1);

		if (!order) {
			return res.status(404).json({
				success: false,
				error: 'Order not found'
			});
		}

		const oldStatus = order.status;

		// Update order status
		await db
			.update(orders)
			.set({
				status,
				updated_at: new Date().toISOString()
			})
			.where(eq(orders.id, orderId));

		// Create status history record
		await db.insert(orderStatusHistory).values({
			order_id: orderId,
			old_status: oldStatus,
			new_status: status,
			changed_by: changedBy || 'admin',
			notes: notes || null
		});

		// Get customer info for notification and linked user for customer notification
		let customerTelegramId: number | undefined;
		if (order.user_id) {
			const [user] = await db
				.select({ telegramUserId: loyaltyUsers.telegram_user_id })
				.from(loyaltyUsers)
				.where(eq(loyaltyUsers.id, order.user_id))
				.limit(1);
			customerTelegramId = user?.telegramUserId;
		}

		// Send notification (non-blocking)
		notifyStatusChange(
			{
				orderNumber: order.order_number,
				customerName: order.customer_name,
				customerPhone: order.customer_phone,
				oldStatus,
				newStatus: status,
				notes: notes || undefined
			},
			customerTelegramId
		).catch(err => console.error('Failed to send notification:', err));

		res.json({
			success: true,
			data: {
				id: orderId,
				oldStatus,
				newStatus: status,
				newStatusLabel: statusLabels[status] || status
			},
			message: 'Order status updated'
		});
	} catch (error: any) {
		console.error('Error updating order status:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/orders/:id - Update order details
 */
router.put('/:id', async (req, res) => {
	try {
		const orderId = parseInt(req.params.id);
		const {
			customerName,
			customerPhone,
			customerEmail,
			deliveryAddress,
			deliveryEntrance,
			deliveryFloor,
			deliveryApartment,
			deliveryIntercom,
			notes
		} = req.body;

		// Get current order
		const [order] = await db
			.select()
			.from(orders)
			.where(eq(orders.id, orderId))
			.limit(1);

		if (!order) {
			return res.status(404).json({
				success: false,
				error: 'Order not found'
			});
		}

		// Update order
		const updateData: any = {
			updated_at: new Date().toISOString()
		};

		if (customerName !== undefined) updateData.customer_name = customerName;
		if (customerPhone !== undefined) updateData.customer_phone = customerPhone;
		if (customerEmail !== undefined) updateData.customer_email = customerEmail;
		if (deliveryAddress !== undefined) updateData.delivery_address = deliveryAddress;
		if (deliveryEntrance !== undefined) updateData.delivery_entrance = deliveryEntrance;
		if (deliveryFloor !== undefined) updateData.delivery_floor = deliveryFloor;
		if (deliveryApartment !== undefined) updateData.delivery_apartment = deliveryApartment;
		if (deliveryIntercom !== undefined) updateData.delivery_intercom = deliveryIntercom;
		if (notes !== undefined) updateData.notes = notes;

		await db
			.update(orders)
			.set(updateData)
			.where(eq(orders.id, orderId));

		res.json({
			success: true,
			message: 'Order updated'
		});
	} catch (error: any) {
		console.error('Error updating order:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * DELETE /api/admin/orders/:id - Delete order (soft or hard)
 */
router.delete('/:id', async (req, res) => {
	try {
		const orderId = parseInt(req.params.id);

		// Get current order
		const [order] = await db
			.select()
			.from(orders)
			.where(eq(orders.id, orderId))
			.limit(1);

		if (!order) {
			return res.status(404).json({
				success: false,
				error: 'Order not found'
			});
		}

		// Hard delete (cascade will handle order_items and status_history)
		await db
			.delete(orders)
			.where(eq(orders.id, orderId));

		res.json({
			success: true,
			message: 'Order deleted'
		});
	} catch (error: any) {
		console.error('Error deleting order:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

export default router;
