-- Migration: Add free delivery threshold functionality
-- Date: 2025-01-09

-- 1. Add free_delivery_threshold column to delivery_locations
-- NULL = not participating in the promotion
-- Value in rubles (not kopeks) for convenience
ALTER TABLE delivery_locations ADD COLUMN free_delivery_threshold INTEGER DEFAULT NULL;

-- 2. Create free_delivery_settings table (singleton)
CREATE TABLE IF NOT EXISTS free_delivery_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,

    -- Global settings
    is_enabled INTEGER NOT NULL DEFAULT 1, -- boolean: 1 = enabled
    default_threshold INTEGER NOT NULL DEFAULT 3000, -- in rubles

    -- Widget on home page
    widget_enabled INTEGER NOT NULL DEFAULT 1, -- boolean
    widget_title TEXT NOT NULL DEFAULT 'Бесплатная доставка',
    widget_text TEXT NOT NULL DEFAULT 'При заказе от {threshold}₽ доставка бесплатная в выбранные населённые пункты',
    widget_icon TEXT NOT NULL DEFAULT '🚚',

    -- Toast on cart add
    toast_enabled INTEGER NOT NULL DEFAULT 1, -- boolean
    toast_text TEXT NOT NULL DEFAULT 'Добавьте ещё на {remaining}₽ — доставка может быть бесплатной!',
    toast_show_threshold INTEGER NOT NULL DEFAULT 500, -- show when remaining <= X rubles

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Insert default settings
INSERT OR IGNORE INTO free_delivery_settings (id) VALUES (1);

-- 4. Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_delivery_locations_threshold ON delivery_locations(free_delivery_threshold);
