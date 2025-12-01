import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Users table - публичные пользователи системы
 */
export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

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
 * ВАЖНО: Backend использует plain text пароли (не безопасно!)
 * Frontend использует bcrypt (безопасно)
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
 * Loyalty Users table - пользователи программы лояльности
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
 * Stores table - магазины/точки продаж
 */
export const stores = sqliteTable('stores', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	city: text('city'), // Населенный пункт (добавлено в миграции 0003)
	address: text('address').notNull(),
	phone: text('phone').notNull(),
	hours: text('hours').notNull(),
	features: text('features').notNull(), // JSON array stored as text
	icon_color: text('icon_color').notNull(),
	coords_lat: real('coords_lat').notNull(),
	coords_lng: real('coords_lng').notNull(),
	status: text('status').notNull(),
	closed: integer('closed', { mode: 'boolean' }).notNull().default(false),
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true)
});

/**
 * Transactions table - история транзакций лояльности
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
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
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
 * Products table - товары каталога
 */
export const products = sqliteTable('products', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	description: text('description'), // Описание товара (добавлено в миграции 0003)
	price: real('price').notNull(),
	old_price: real('old_price'),
	quantity_info: text('quantity_info'), // Информация о количестве/упаковке (добавлено в миграции 0003)
	image: text('image').notNull(),
	category: text('category').notNull(),
	is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	show_on_home: integer('show_on_home', { mode: 'boolean' }).notNull().default(false), // Показывать в блоке "Топовые товары" (добавлено в миграции 0003)
	is_recommendation: integer('is_recommendation', { mode: 'boolean' }).notNull().default(false) // Показывать в блоке "Рекомендации" без цены (добавлено в миграции 0003)
}, (table) => ({
	// HIGH FIX #5: Индексы для производительности запросов топовых товаров и рекомендаций
	homePageIdx: index('idx_products_home_page').on(table.is_active, table.show_on_home),
	recommendationsIdx: index('idx_products_recommendations').on(table.is_active, table.is_recommendation)
}));

/**
 * Offers table - акции и специальные предложения
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
 * Recommendations table - персональные рекомендации товаров
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
 * Loyalty Settings table - настройки программы лояльности
 * Singleton таблица (всегда 1 запись с id=1)
 */
export const loyaltySettings = sqliteTable('loyalty_settings', {
	id: integer('id').primaryKey().$default(() => 1),
	earning_percent: real('earning_percent').notNull().default(4.0), // Процент начисления (4%)
	max_discount_percent: real('max_discount_percent').notNull().default(20.0), // Максимальная скидка баллами (20%)
	expiry_days: integer('expiry_days').notNull().default(45), // Срок действия баллов (45 дней)
	welcome_bonus: real('welcome_bonus').notNull().default(500.0), // Приветственный бонус
	birthday_bonus: real('birthday_bonus').notNull().default(0.0), // Бонус на день рождения
	min_redemption_amount: real('min_redemption_amount').notNull().default(1.0), // Минимальная сумма для списания
	points_name: text('points_name').notNull().default('Мурзи-коины'), // Название баллов
	support_email: text('support_email'), // Email поддержки
	support_phone: text('support_phone'), // Телефон поддержки
	updated_at: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

/**
 * Store Images table - изображения магазинов для слайдера в TWA
 */
export const storeImages = sqliteTable('store_images', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	store_id: integer('store_id')
		.notNull()
		.references(() => stores.id, { onDelete: 'cascade' }),
	filename: text('filename').notNull(), // Имя файла в storage (WebP)
	original_name: text('original_name').notNull(), // Оригинальное имя файла
	sort_order: integer('sort_order').notNull().default(0), // Порядок сортировки для drag-and-drop
	created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	storeIdIdx: index('idx_store_images_store_id').on(table.store_id),
	sortOrderIdx: index('idx_store_images_sort').on(table.store_id, table.sort_order)
}));

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

// TypeScript типы, выведенные из схемы
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type LoyaltyUser = typeof loyaltyUsers.$inferSelect;
export type NewLoyaltyUser = typeof loyaltyUsers.$inferInsert;

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

export type PendingDiscount = typeof pendingDiscounts.$inferSelect;
export type NewPendingDiscount = typeof pendingDiscounts.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type CashierTransaction = typeof cashierTransactions.$inferSelect;
export type NewCashierTransaction = typeof cashierTransactions.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Offer = typeof offers.$inferSelect;
export type NewOffer = typeof offers.$inferInsert;

export type Recommendation = typeof recommendations.$inferSelect;
export type NewRecommendation = typeof recommendations.$inferInsert;

export type LoyaltySettings = typeof loyaltySettings.$inferSelect;
export type NewLoyaltySettings = typeof loyaltySettings.$inferInsert;

export type StoreImage = typeof storeImages.$inferSelect;
export type NewStoreImage = typeof storeImages.$inferInsert;
