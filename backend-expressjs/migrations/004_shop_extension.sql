-- Migration: Shop extension - categories, cart, orders, shop_settings
-- Date: 2025-12-06
-- Description: Расширение системы лояльности до интернет-магазина

-- =====================================================
-- 1. CATEGORIES - Категории товаров
-- =====================================================

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image TEXT,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    position INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для категорий
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_position ON categories(position);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- =====================================================
-- 2. PRODUCTS - добавляем новые поля
-- =====================================================

-- Добавляем category_id (FK на categories)
ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- Добавляем SKU (артикул)
ALTER TABLE products ADD COLUMN sku TEXT;

-- Добавляем position (позиция в категории)
ALTER TABLE products ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

-- Индексы для новых полей
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_position ON products(category_id, position);

-- =====================================================
-- 3. CART_ITEMS - Корзина
-- =====================================================

CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,                                        -- для гостей (cookie)
    user_id INTEGER REFERENCES loyalty_users(id) ON DELETE CASCADE,  -- для авторизованных
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для корзины
CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_product ON cart_items(product_id);

-- =====================================================
-- 4. ORDERS - Заказы
-- =====================================================

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES loyalty_users(id) ON DELETE SET NULL,

    -- Статус заказа
    status TEXT NOT NULL DEFAULT 'new',  -- new/confirmed/processing/shipped/delivered/cancelled

    -- Контакты клиента
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,

    -- Тип доставки
    delivery_type TEXT NOT NULL,  -- pickup/delivery

    -- Адрес доставки (для delivery)
    delivery_address TEXT,
    delivery_entrance TEXT,
    delivery_floor TEXT,
    delivery_apartment TEXT,
    delivery_intercom TEXT,

    -- Самовывоз (для pickup)
    store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,

    -- Суммы (в копейках для точности)
    subtotal INTEGER NOT NULL,
    delivery_cost INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,

    -- Дополнительно
    notes TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для заказов
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);

-- =====================================================
-- 5. ORDER_ITEMS - Позиции заказа
-- =====================================================

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,

    -- Снапшот на момент заказа (цены могут меняться)
    product_name TEXT NOT NULL,
    product_price INTEGER NOT NULL,  -- в копейках
    quantity INTEGER NOT NULL,
    total INTEGER NOT NULL,          -- в копейках

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для позиций заказа
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- =====================================================
-- 6. SHOP_SETTINGS - Настройки магазина
-- =====================================================

CREATE TABLE IF NOT EXISTS shop_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,

    -- Основные настройки
    shop_name TEXT NOT NULL DEFAULT 'Магазин',
    shop_type TEXT NOT NULL DEFAULT 'general',  -- restaurant/pet_shop/clothing/general
    currency TEXT NOT NULL DEFAULT 'RUB',

    -- Настройки доставки
    delivery_enabled INTEGER NOT NULL DEFAULT 1,
    pickup_enabled INTEGER NOT NULL DEFAULT 1,
    delivery_cost INTEGER NOT NULL DEFAULT 0,       -- в копейках
    free_delivery_from INTEGER,                     -- бесплатная доставка от суммы (в копейках)
    min_order_amount INTEGER NOT NULL DEFAULT 0,    -- минимальная сумма заказа (в копейках)

    -- Telegram бот
    telegram_bot_token TEXT,
    telegram_bot_username TEXT,

    -- Уведомления
    telegram_notifications_enabled INTEGER NOT NULL DEFAULT 0,
    telegram_group_id TEXT,
    email_notifications_enabled INTEGER NOT NULL DEFAULT 0,
    email_recipients TEXT,  -- JSON array
    customer_telegram_notifications INTEGER NOT NULL DEFAULT 0,  -- уведомлять клиента о статусе

    -- SMTP настройки
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_password TEXT,
    smtp_from TEXT,

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Инициализируем настройки магазина (singleton)
INSERT OR IGNORE INTO shop_settings (id) VALUES (1);

-- =====================================================
-- 7. ORDER_STATUS_HISTORY - История изменений статуса (опционально)
-- =====================================================

CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,  -- admin email или 'system'
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
