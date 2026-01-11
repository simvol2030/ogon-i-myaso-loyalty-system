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
	parent_id: integer('parent_id'), // Self-reference без .references() для избежания circular dependency
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
	variation_attribute: text('variation_attribute'), // Название атрибута вариации (Размер, Объём, Цвет)
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
 * Product Variations - вариации товаров (размеры, объёмы, цвета)
 */
export const productVariations = sqliteTable('product_variations', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	product_id: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
	name: text('name').notNull(), // Название вариации (25см, 30см, 500мл, Красный)
	price: real('price').notNull(),
	old_price: real('old_price'),
	sku: text('sku'),
	position: integer('position').notNull().default(0),
	is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	productIdx: index('idx_variations_product').on(table.product_id),
	productActiveIdx: index('idx_variations_product_active').on(table.product_id, table.is_active),
	positionIdx: index('idx_variations_position').on(table.product_id, table.position)
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
	variation_id: integer('variation_id').references(() => productVariations.id, { onDelete: 'cascade' }), // вариация товара
	quantity: integer('quantity').notNull().default(1),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	sessionIdx: index('idx_cart_session').on(table.session_id),
	userIdx: index('idx_cart_user').on(table.user_id),
	productIdx: index('idx_cart_product').on(table.product_id),
	variationIdx: index('idx_cart_variation').on(table.variation_id)
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

export type ProductVariation = typeof productVariations.$inferSelect;
export type NewProductVariation = typeof productVariations.$inferInsert;

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

// ============================================
// FEED TABLES - News/Promo feed
// ============================================

/**
 * Feed Tags table - теги для постов и статей
 */
export const feedTags = sqliteTable('feed_tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(), // URL-friendly версия
	color: text('color').notNull().default('#ff6b00'), // Цвет бейджа тега
	sort_order: integer('sort_order').notNull().default(0),
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	slugIdx: index('idx_feed_tags_slug').on(table.slug),
	activeOrderIdx: index('idx_feed_tags_active_order').on(table.is_active, table.sort_order)
}));

/**
 * Feed Posts table - посты и статьи ленты
 * type: 'post' - короткий пост с фото
 * type: 'article' - длинная статья с markdown
 */
export const feedPosts = sqliteTable('feed_posts', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	type: text('type', { enum: ['post', 'article'] }).notNull().default('post'),
	title: text('title'), // Для статей обязателен, для постов опционален
	content: text('content').notNull(), // Markdown контент
	excerpt: text('excerpt'), // Сниппет для статей в ленте (150-200 символов)
	author_name: text('author_name'), // Имя автора (опционально)
	is_published: integer('is_published', { mode: 'boolean' }).notNull().default(false),
	published_at: text('published_at'), // Дата публикации для хронологии
	views_count: integer('views_count').notNull().default(0),
	likes_count: integer('likes_count').notNull().default(0), // Агрегированный счётчик
	dislikes_count: integer('dislikes_count').notNull().default(0), // Агрегированный счётчик
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	publishedAtIdx: index('idx_feed_posts_published').on(table.is_published, table.published_at),
	typePublishedIdx: index('idx_feed_posts_type_published').on(table.type, table.is_published, table.published_at)
}));

/**
 * Feed Post Images table - изображения для постов/статей
 * Для постов: используется как слайдер (sort_order)
 * Для статей: position_in_content указывает место в тексте
 */
export const feedPostImages = sqliteTable('feed_post_images', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	post_id: integer('post_id')
		.notNull()
		.references(() => feedPosts.id, { onDelete: 'cascade' }),
	filename: text('filename').notNull(), // WebP файл
	original_name: text('original_name').notNull(),
	alt_text: text('alt_text'), // Описание для accessibility
	position_in_content: integer('position_in_content'), // Позиция маркера в статье (null = слайдер поста)
	sort_order: integer('sort_order').notNull().default(0),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	postIdIdx: index('idx_feed_post_images_post').on(table.post_id),
	postSortIdx: index('idx_feed_post_images_sort').on(table.post_id, table.sort_order)
}));

/**
 * Feed Post Tags table - связь постов и тегов (многие-ко-многим)
 */
export const feedPostTags = sqliteTable('feed_post_tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	post_id: integer('post_id')
		.notNull()
		.references(() => feedPosts.id, { onDelete: 'cascade' }),
	tag_id: integer('tag_id')
		.notNull()
		.references(() => feedTags.id, { onDelete: 'cascade' })
}, (table) => ({
	postIdIdx: index('idx_feed_post_tags_post').on(table.post_id),
	tagIdIdx: index('idx_feed_post_tags_tag').on(table.tag_id),
	uniqueIdx: index('idx_feed_post_tags_unique').on(table.post_id, table.tag_id)
}));

/**
 * Feed Post Reactions table - лайки/дизлайки от пользователей Telegram
 */
export const feedPostReactions = sqliteTable('feed_post_reactions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	post_id: integer('post_id')
		.notNull()
		.references(() => feedPosts.id, { onDelete: 'cascade' }),
	telegram_user_id: text('telegram_user_id').notNull(), // ID пользователя из Telegram WebApp
	reaction_type: text('reaction_type', { enum: ['like', 'dislike'] }).notNull(),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	postUserIdx: index('idx_feed_reactions_post_user').on(table.post_id, table.telegram_user_id),
	postIdx: index('idx_feed_reactions_post').on(table.post_id)
}));

// Feed TypeScript типы
export type FeedTag = typeof feedTags.$inferSelect;
export type NewFeedTag = typeof feedTags.$inferInsert;

export type FeedPost = typeof feedPosts.$inferSelect;
export type NewFeedPost = typeof feedPosts.$inferInsert;

export type FeedPostImage = typeof feedPostImages.$inferSelect;
export type NewFeedPostImage = typeof feedPostImages.$inferInsert;

export type FeedPostTag = typeof feedPostTags.$inferSelect;
export type NewFeedPostTag = typeof feedPostTags.$inferInsert;

export type FeedPostReaction = typeof feedPostReactions.$inferSelect;
export type NewFeedPostReaction = typeof feedPostReactions.$inferInsert;

// =====================================================
// WEB STORIES TABLES
// =====================================================

/**
 * Stories Highlights table - группы/кружки историй
 * Каждый хайлайт содержит несколько story items
 */
export const storiesHighlights = sqliteTable('stories_highlights', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	cover_image: text('cover_image'),
	position: integer('position').notNull().default(0),
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	positionIdx: index('idx_highlights_position').on(table.position),
	activeIdx: index('idx_highlights_active').on(table.is_active),
	activePositionIdx: index('idx_highlights_active_position').on(table.is_active, table.position)
}));

/**
 * Stories Items table - контент внутри хайлайтов
 * Поддерживает фото и видео с кнопками-редиректами
 */
export const storiesItems = sqliteTable('stories_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	highlight_id: integer('highlight_id')
		.notNull()
		.references(() => storiesHighlights.id, { onDelete: 'cascade' }),
	type: text('type', { enum: ['photo', 'video'] }).notNull(),
	media_url: text('media_url').notNull(),
	thumbnail_url: text('thumbnail_url'),
	duration: integer('duration').notNull().default(5), // секунды
	link_url: text('link_url'),
	link_text: text('link_text'),
	position: integer('position').notNull().default(0),
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	highlightIdx: index('idx_items_highlight').on(table.highlight_id),
	positionIdx: index('idx_items_position').on(table.highlight_id, table.position),
	activeIdx: index('idx_items_active').on(table.is_active)
}));

/**
 * Stories Settings table - настройки отображения Stories
 * Singleton таблица (всегда 1 запись с id=1)
 */
export const storiesSettings = sqliteTable('stories_settings', {
	id: integer('id').primaryKey().$default(() => 1),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	shape: text('shape', { enum: ['circle', 'square'] }).notNull().default('circle'),
	border_width: integer('border_width').notNull().default(3),
	border_color: text('border_color').notNull().default('#ff6b00'),
	border_gradient: text('border_gradient'), // JSON: {start: '#ff6b00', end: '#dc2626'}
	show_title: integer('show_title', { mode: 'boolean' }).notNull().default(true),
	title_position: text('title_position', { enum: ['bottom', 'inside'] }).notNull().default('bottom'),
	highlight_size: integer('highlight_size').notNull().default(70), // px
	max_video_duration: integer('max_video_duration').notNull().default(45), // секунды
	max_video_size_mb: integer('max_video_size_mb').notNull().default(50),
	auto_convert_webp: integer('auto_convert_webp', { mode: 'boolean' }).notNull().default(true),
	webp_quality: integer('webp_quality').notNull().default(85),
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

/**
 * Stories Views table - аналитика просмотров
 * Записывает каждый просмотр story item
 */
export const storiesViews = sqliteTable('stories_views', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	story_item_id: integer('story_item_id')
		.notNull()
		.references(() => storiesItems.id, { onDelete: 'cascade' }),
	user_id: integer('user_id').references(() => loyaltyUsers.id, { onDelete: 'set null' }),
	session_id: text('session_id'),
	view_duration: real('view_duration').notNull().default(0), // секунды
	completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
	link_clicked: integer('link_clicked', { mode: 'boolean' }).notNull().default(false),
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	itemIdx: index('idx_views_item').on(table.story_item_id),
	userIdx: index('idx_views_user').on(table.user_id),
	dateIdx: index('idx_views_date').on(table.created_at),
	itemDateIdx: index('idx_views_item_date').on(table.story_item_id, table.created_at)
}));

// TypeScript типы для Web Stories
export type StoriesHighlight = typeof storiesHighlights.$inferSelect;
export type NewStoriesHighlight = typeof storiesHighlights.$inferInsert;

export type StoriesItem = typeof storiesItems.$inferSelect;
export type NewStoriesItem = typeof storiesItems.$inferInsert;

export type StoriesSettings = typeof storiesSettings.$inferSelect;
export type NewStoriesSettings = typeof storiesSettings.$inferInsert;

export type StoriesView = typeof storiesViews.$inferSelect;
export type NewStoriesView = typeof storiesViews.$inferInsert;

// =====================================================
// APP CUSTOMIZATION
// =====================================================

/**
 * App Customization table - настройки внешнего вида приложения
 * Singleton таблица (всегда 1 запись с id=1)
 */
export const appCustomization = sqliteTable('app_customization', {
	id: integer('id').primaryKey().$default(() => 1),

	// === БРЕНДИНГ ===
	app_name: text('app_name').notNull().default('Мурзико'),
	app_slogan: text('app_slogan').notNull().default('Лояльность'),
	logo_url: text('logo_url').notNull().default('/logo.png'),
	favicon_url: text('favicon_url').default('/favicon.ico'),

	// === ЦВЕТОВАЯ СХЕМА (LIGHT THEME) ===
	primary_color: text('primary_color').notNull().default('#ff6b00'),
	primary_color_dark: text('primary_color_dark').notNull().default('#e55d00'),
	primary_color_light: text('primary_color_light').notNull().default('#ff8533'),
	secondary_color: text('secondary_color').notNull().default('#10b981'),
	secondary_color_dark: text('secondary_color_dark').notNull().default('#059669'),
	accent_color: text('accent_color').notNull().default('#dc2626'),

	// === ЦВЕТОВАЯ СХЕМА (DARK THEME) ===
	dark_bg_primary: text('dark_bg_primary').notNull().default('#17212b'),
	dark_bg_secondary: text('dark_bg_secondary').notNull().default('#0e1621'),
	dark_bg_tertiary: text('dark_bg_tertiary').notNull().default('#1f2c38'),
	dark_primary_color: text('dark_primary_color').notNull().default('#ff8533'),
	dark_text_primary: text('dark_text_primary').notNull().default('#ffffff'),
	dark_text_secondary: text('dark_text_secondary').notNull().default('#aaaaaa'),
	dark_border_color: text('dark_border_color').notNull().default('#2b3943'),

	// === НАВИГАЦИЯ ===
	bottom_nav_items: text('bottom_nav_items').notNull().default('[]'),
	sidebar_menu_items: text('sidebar_menu_items').notNull().default('[]'),

	// === КАСТОМИЗАЦИЯ ЛЕЙБЛОВ ===
	products_label: text('products_label').notNull().default('Товары'),
	products_icon: text('products_icon').notNull().default('cart'),

	// === КОНТАКТЫ ===
	header_phone: text('header_phone').notNull().default('+7 (800) 000-00-00'),

	// === ВИДЖЕТ ЛОЯЛЬНОСТИ ===
	loyalty_card_gradient_start: text('loyalty_card_gradient_start').notNull().default('#ff6b00'),
	loyalty_card_gradient_end: text('loyalty_card_gradient_end').notNull().default('#dc2626'),
	loyalty_card_text_color: text('loyalty_card_text_color').notNull().default('#ffffff'),
	loyalty_card_accent_color: text('loyalty_card_accent_color').notNull().default('#ffffff'),
	loyalty_card_badge_bg: text('loyalty_card_badge_bg').notNull().default('rgba(255,255,255,0.95)'),
	loyalty_card_badge_text: text('loyalty_card_badge_text').notNull().default('#e55d00'),
	loyalty_card_border_radius: integer('loyalty_card_border_radius').notNull().default(24),
	loyalty_card_show_shimmer: integer('loyalty_card_show_shimmer').notNull().default(1),

	// === STORIES (HIGHLIGHTS) CUSTOMIZATION ===
	stories_border_color: text('stories_border_color').notNull().default('#ff6b00'),
	stories_title_color_light: text('stories_title_color_light').notNull().default('#374151'),
	stories_title_color_dark: text('stories_title_color_dark').notNull().default('#ffffff'),

	// === МЕТА ===
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export type AppCustomization = typeof appCustomization.$inferSelect;
export type NewAppCustomization = typeof appCustomization.$inferInsert;
