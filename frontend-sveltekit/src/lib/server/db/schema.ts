import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ========================================
// ADMIN TABLES (existing)
// ========================================

/**
 * Users table - публичные пользователи системы (для админки)
 */
export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

// ========================================
// LOYALTY SYSTEM TABLES
// ========================================

/**
 * Loyalty Users - пользователи программы лояльности из Telegram
 */
export const loyaltyUsers = sqliteTable('loyalty_users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	telegram_user_id: integer('telegram_user_id').notNull().unique(),
	card_number: text('card_number').unique(), // 6-8 digit loyalty card number (e.g., "421856" or "99421856")
	first_name: text('first_name').notNull(),
	last_name: text('last_name'),
	username: text('username'),
	language_code: text('language_code'),
	current_balance: real('current_balance').notNull().default(500.0), // CHECK: balance >= 0 (enforced via migration 0002)
	total_purchases: integer('total_purchases').notNull().default(0),
	total_saved: real('total_saved').notNull().default(0),
	store_id: integer('store_id'),
	first_login_bonus_claimed: integer('first_login_bonus_claimed', { mode: 'boolean' }).notNull().default(true),
	registration_date: text('registration_date').notNull().default(sql`CURRENT_TIMESTAMP`),
	last_activity: text('last_activity').default(sql`CURRENT_TIMESTAMP`),
	chat_id: integer('chat_id').notNull(),
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true)
}, (table) => ({
	// Sprint 5 Audit Cycle 1 Fix: Индексы для dashboard queries
	registrationIdx: index('idx_loyalty_users_registration').on(table.registration_date),
	storeIdIdx: index('idx_loyalty_users_store_id').on(table.store_id)
}));

/**
 * Posts table - посты блога
 */
export const posts = sqliteTable('posts', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	content: text('content'),
	published: integer('published', { mode: 'boolean' }).default(false).notNull(),
	created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

/**
 * Admins table - административные пользователи с аутентификацией
 */
export const admins = sqliteTable('admins', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().unique(),
	password: text('password').notNull(),
	role: text('role', { enum: ['super-admin', 'editor', 'viewer'] })
		.notNull()
		.default('viewer'),
	name: text('name').notNull(),
	created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

/**
 * Categories - категории товаров
 */
export const categories = sqliteTable('categories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	description: text('description'),
	image: text('image'),
	parent_id: integer('parent_id').references((): ReturnType<typeof integer> => categories.id, { onDelete: 'set null' }),
	position: integer('position').notNull().default(0),
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	parentIdx: index('idx_categories_parent').on(table.parent_id),
	positionIdx: index('idx_categories_position').on(table.position),
	activeIdx: index('idx_categories_active').on(table.is_active),
	slugIdx: index('idx_categories_slug').on(table.slug)
}));

/**
 * Products - товары каталога
 */
export const products = sqliteTable('products', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	description: text('description'),
	price: real('price').notNull(),
	old_price: real('old_price'),
	quantity_info: text('quantity_info'),
	image: text('image').notNull(),
	category: text('category').notNull(), // Старое текстовое поле (для совместимости)
	category_id: integer('category_id').references(() => categories.id, { onDelete: 'set null' }), // Новое поле FK
	sku: text('sku'), // Артикул
	position: integer('position').notNull().default(0), // Позиция в категории
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	show_on_home: integer('show_on_home', { mode: 'boolean' }).notNull().default(false),
	is_recommendation: integer('is_recommendation', { mode: 'boolean' }).notNull().default(false)
}, (table) => ({
	homePageIdx: index('idx_products_home_page').on(table.is_active, table.show_on_home),
	recommendationsIdx: index('idx_products_recommendations').on(table.is_active, table.is_recommendation),
	categoryIdx: index('idx_products_category').on(table.category_id),
	skuIdx: index('idx_products_sku').on(table.sku),
	positionIdx: index('idx_products_position').on(table.category_id, table.position)
}));

/**
 * Offers - акции и специальные предложения
 */
export const offers = sqliteTable('offers', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	description: text('description').notNull(),
	image: text('image'), // URL изображения баннера (добавлено в миграции 0003)
	icon: text('icon').notNull(), // Старое поле (оставлено для совместимости)
	icon_color: text('icon_color').notNull(), // Старое поле (оставлено для совместимости)
	deadline: text('deadline').notNull(),
	deadline_class: text('deadline_class').notNull(), // Старое поле (оставлено для совместимости)
	details: text('details').notNull(), // Старое поле (оставлено для совместимости)
	conditions: text('conditions').notNull(), // JSON array as string (старое поле, оставлено для совместимости)
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	show_on_home: integer('show_on_home', { mode: 'boolean' }).notNull().default(false) // Показывать на главной TWA (добавлено в миграции 0003)
}, (table) => ({
	// HIGH FIX #11: Composite index for home page query performance
	homePageIdx: index('idx_offers_home_page').on(table.is_active, table.show_on_home)
}));

/**
 * Stores - магазины сети
 */
export const stores = sqliteTable('stores', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	city: text('city'), // Sprint 4 Task 1.4: City name (nullable)
	address: text('address').notNull(),
	phone: text('phone').notNull(),
	hours: text('hours').notNull(),
	features: text('features').notNull(), // JSON array as string
	icon_color: text('icon_color').notNull(),
	coords_lat: real('coords_lat').notNull(),
	coords_lng: real('coords_lng').notNull(),
	status: text('status').notNull(),
	closed: integer('closed', { mode: 'boolean' }).notNull().default(false),
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true)
});

/**
 * Store Images - изображения магазинов для слайдера в TWA
 */
export const storeImages = sqliteTable('store_images', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	store_id: integer('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	filename: text('filename').notNull(),
	original_name: text('original_name').notNull(),
	sort_order: integer('sort_order').notNull().default(0),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	storeIdIdx: index('idx_store_images_store_id').on(table.store_id),
	sortOrderIdx: index('idx_store_images_sort').on(table.store_id, table.sort_order)
}));

/**
 * Transactions - история операций (начисление/списание баллов)
 */
export const transactions = sqliteTable('transactions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	loyalty_user_id: integer('loyalty_user_id')
		.notNull()
		.references(() => loyaltyUsers.id, { onDelete: 'cascade' }),
	store_id: integer('store_id').references(() => stores.id, { onDelete: 'set null' }),
	title: text('title').notNull(),
	amount: real('amount').notNull(),
	type: text('type', { enum: ['earn', 'spend'] }).notNull(),
	check_amount: real('check_amount'), // Сумма чека (для статистики)
	points_redeemed: real('points_redeemed'), // Списано баллов
	cashback_earned: real('cashback_earned'), // Начислено баллов
	spent: text('spent'),
	store_name: text('store_name'),
	created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
}, (table) => ({
	// Sprint 5 Audit Cycle 1 Fix: Индексы для dashboard queries
	createdAtIdx: index('idx_transactions_created_at').on(table.created_at),
	typeCreatedIdx: index('idx_transactions_type_created').on(table.type, table.created_at),
	storeIdIdx: index('idx_transactions_store_id').on(table.store_id)
}));

/**
 * Cashier Transactions table - транзакции через кассу
 */
export const cashierTransactions = sqliteTable('cashier_transactions', {
	id: integer('id').primaryKey({ autoIncrement: true }),

	// Customer & Store
	customer_id: integer('customer_id')
		.notNull()
		.references(() => loyaltyUsers.id, { onDelete: 'cascade' }),
	store_id: integer('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),

	// Transaction details
	// 🔒 FIX: Standardized on 'spend' to match transactions table (was 'redeem')
	type: text('type', { enum: ['earn', 'spend'] }).notNull(),
	purchase_amount: real('purchase_amount').notNull(),
	points_amount: integer('points_amount').notNull(),
	discount_amount: real('discount_amount').notNull().default(0),

	// Metadata (stored as JSON text)
	metadata: text('metadata'), // { cashierName, terminalId, paymentMethod, receiptNumber }

	// 1C Sync
	synced_with_1c: integer('synced_with_1c', { mode: 'boolean' }).notNull().default(false),
	synced_at: text('synced_at'),
	onec_transaction_id: text('onec_transaction_id'),

	// Timestamps
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	// 🔴 FIX: Индексы для производительности
	storeIdx: index('idx_cashier_tx_store').on(table.store_id),
	customerIdx: index('idx_cashier_tx_customer').on(table.customer_id),
	createdIdx: index('idx_cashier_tx_created').on(table.created_at),
	storeCreatedIdx: index('idx_cashier_tx_store_created').on(table.store_id, table.created_at)
}));

/**
 * Recommendations - персональные рекомендации товаров
 */
export const recommendations = sqliteTable('recommendations', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	loyalty_user_id: integer('loyalty_user_id').references(() => loyaltyUsers.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description').notNull(),
	price: real('price').notNull(),
	image: text('image').notNull(),
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true)
});

/**
 * Loyalty Settings - настройки программы лояльности
 * Singleton таблица (всегда 1 запись с id=1)
 */
export const loyaltySettings = sqliteTable('loyalty_settings', {
	id: integer('id').primaryKey().$default(() => 1),
	earning_percent: real('earning_percent').notNull().default(4.0),
	max_discount_percent: real('max_discount_percent').notNull().default(20.0),
	expiry_days: integer('expiry_days').notNull().default(45),
	welcome_bonus: real('welcome_bonus').notNull().default(500.0),
	birthday_bonus: real('birthday_bonus').notNull().default(0.0),
	min_redemption_amount: real('min_redemption_amount').notNull().default(1.0),
	points_name: text('points_name').notNull().default('Мурзи-коины'),
	support_email: text('support_email'),
	support_phone: text('support_phone'),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

/**
 * Pending Discounts table - очередь скидок для агентов
 * Polling-based архитектура: агент сам забирает pending скидки
 */
export const pendingDiscounts = sqliteTable('pending_discounts', {
	id: integer('id').primaryKey({ autoIncrement: true }),

	// Store identification
	store_id: integer('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),

	// Transaction link
	transaction_id: integer('transaction_id')
		.notNull()
		.references(() => transactions.id, { onDelete: 'cascade' }),

	// Discount data
	discount_amount: real('discount_amount').notNull(),

	// Status tracking
	status: text('status', { enum: ['pending', 'processing', 'applied', 'failed', 'expired'] })
		.notNull()
		.default('pending'),

	// Processing timestamps
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	applied_at: text('applied_at'),
	expires_at: text('expires_at').notNull(), // 30 секунд после создания

	// Error handling
	error_message: text('error_message')
}, (table) => ({
	// 🔴 FIX: Индексы для быстрого polling
	storeStatusIdx: index('idx_pending_store_status').on(table.store_id, table.status),
	expiresIdx: index('idx_pending_expires').on(table.expires_at)
}));

// =====================================================
// SHOP / E-COMMERCE TABLES
// =====================================================

/**
 * Cart Items table - корзина покупателя
 */
export const cartItems = sqliteTable('cart_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	session_id: text('session_id'), // для гостей (cookie)
	user_id: integer('user_id').references(() => loyaltyUsers.id, { onDelete: 'cascade' }), // для авторизованных
	product_id: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
	quantity: integer('quantity').notNull().default(1),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	sessionIdx: index('idx_cart_session').on(table.session_id),
	userIdx: index('idx_cart_user').on(table.user_id),
	productIdx: index('idx_cart_product').on(table.product_id)
}));

/**
 * Orders table - заказы
 */
export const orders = sqliteTable('orders', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	order_number: text('order_number').notNull().unique(),
	user_id: integer('user_id').references(() => loyaltyUsers.id, { onDelete: 'set null' }),

	// Статус
	status: text('status', {
		enum: ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
	}).notNull().default('new'),

	// Контакты клиента
	customer_name: text('customer_name').notNull(),
	customer_phone: text('customer_phone').notNull(),
	customer_email: text('customer_email'),

	// Доставка
	delivery_type: text('delivery_type', { enum: ['pickup', 'delivery'] }).notNull(),
	delivery_address: text('delivery_address'),
	delivery_entrance: text('delivery_entrance'),
	delivery_floor: text('delivery_floor'),
	delivery_apartment: text('delivery_apartment'),
	delivery_intercom: text('delivery_intercom'),
	store_id: integer('store_id').references(() => stores.id, { onDelete: 'set null' }),

	// Суммы (в копейках)
	subtotal: integer('subtotal').notNull(),
	delivery_cost: integer('delivery_cost').notNull().default(0),
	discount_amount: integer('discount_amount').notNull().default(0),
	total: integer('total').notNull(),

	// Дополнительно
	notes: text('notes'),

	// Timestamps
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	numberIdx: index('idx_orders_number').on(table.order_number),
	userIdx: index('idx_orders_user').on(table.user_id),
	statusIdx: index('idx_orders_status').on(table.status),
	createdIdx: index('idx_orders_created').on(table.created_at),
	storeIdx: index('idx_orders_store').on(table.store_id)
}));

/**
 * Order Items table - позиции заказа
 */
export const orderItems = sqliteTable('order_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	order_id: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
	product_id: integer('product_id').references(() => products.id, { onDelete: 'set null' }),

	// Снапшот на момент заказа
	product_name: text('product_name').notNull(),
	product_price: integer('product_price').notNull(), // в копейках
	quantity: integer('quantity').notNull(),
	total: integer('total').notNull(), // в копейках

	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	orderIdx: index('idx_order_items_order').on(table.order_id),
	productIdx: index('idx_order_items_product').on(table.product_id)
}));

/**
 * Shop Settings table - настройки магазина (singleton)
 */
export const shopSettings = sqliteTable('shop_settings', {
	id: integer('id').primaryKey().$default(() => 1),

	// Основные
	shop_name: text('shop_name').notNull().default('Магазин'),
	shop_type: text('shop_type', { enum: ['restaurant', 'pet_shop', 'clothing', 'general'] }).notNull().default('general'),
	currency: text('currency').notNull().default('RUB'),

	// Доставка
	delivery_enabled: integer('delivery_enabled', { mode: 'boolean' }).notNull().default(true),
	pickup_enabled: integer('pickup_enabled', { mode: 'boolean' }).notNull().default(true),
	delivery_cost: integer('delivery_cost').notNull().default(0), // в копейках
	free_delivery_from: integer('free_delivery_from'), // в копейках
	min_order_amount: integer('min_order_amount').notNull().default(0), // в копейках

	// Telegram бот
	telegram_bot_token: text('telegram_bot_token'),
	telegram_bot_username: text('telegram_bot_username'),

	// Уведомления
	telegram_notifications_enabled: integer('telegram_notifications_enabled', { mode: 'boolean' }).notNull().default(false),
	telegram_group_id: text('telegram_group_id'),
	email_notifications_enabled: integer('email_notifications_enabled', { mode: 'boolean' }).notNull().default(false),
	email_recipients: text('email_recipients'), // JSON array
	customer_telegram_notifications: integer('customer_telegram_notifications', { mode: 'boolean' }).notNull().default(false),

	// SMTP
	smtp_host: text('smtp_host'),
	smtp_port: integer('smtp_port'),
	smtp_user: text('smtp_user'),
	smtp_password: text('smtp_password'),
	smtp_from: text('smtp_from'),

	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

/**
 * Order Status History table - история изменений статуса заказа
 */
export const orderStatusHistory = sqliteTable('order_status_history', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	order_id: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
	old_status: text('old_status'),
	new_status: text('new_status').notNull(),
	changed_by: text('changed_by'), // admin email или 'system'
	notes: text('notes'),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	orderIdx: index('idx_order_status_history_order').on(table.order_id)
}));

// TypeScript типы, выведенные из схемы
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type LoyaltyUser = typeof loyaltyUsers.$inferSelect;
export type NewLoyaltyUser = typeof loyaltyUsers.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Offer = typeof offers.$inferSelect;
export type NewOffer = typeof offers.$inferInsert;

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Recommendation = typeof recommendations.$inferSelect;
export type NewRecommendation = typeof recommendations.$inferInsert;

export type LoyaltySettings = typeof loyaltySettings.$inferSelect;
export type NewLoyaltySettings = typeof loyaltySettings.$inferInsert;

export type CashierTransaction = typeof cashierTransactions.$inferSelect;
export type NewCashierTransaction = typeof cashierTransactions.$inferInsert;

export type PendingDiscount = typeof pendingDiscounts.$inferSelect;
export type NewPendingDiscount = typeof pendingDiscounts.$inferInsert;

export type StoreImage = typeof storeImages.$inferSelect;
export type NewStoreImage = typeof storeImages.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type ShopSettings = typeof shopSettings.$inferSelect;
export type NewShopSettings = typeof shopSettings.$inferInsert;

export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type NewOrderStatusHistory = typeof orderStatusHistory.$inferInsert;
