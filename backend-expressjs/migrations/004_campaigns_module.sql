-- Migration: Add campaigns module (рассылки и триггеры)
-- Date: 2025-12-06

-- 1. Add birthday field to loyalty_users
ALTER TABLE loyalty_users ADD COLUMN birthday TEXT;

-- Index for birthday queries (month-based for birthday triggers)
CREATE INDEX IF NOT EXISTS idx_loyalty_users_birthday ON loyalty_users(birthday);

-- 2. Campaigns table - рассылки/кампании
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Basic info
    title TEXT NOT NULL,
    message_text TEXT NOT NULL,
    message_image TEXT,
    button_text TEXT,
    button_url TEXT,

    -- Link to offer (optional)
    offer_id INTEGER REFERENCES offers(id) ON DELETE SET NULL,

    -- Targeting
    target_type TEXT NOT NULL DEFAULT 'all' CHECK(target_type IN ('all', 'segment')),
    target_filters TEXT, -- JSON

    -- Trigger
    trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK(trigger_type IN ('manual', 'scheduled', 'event')),
    trigger_config TEXT, -- JSON

    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,

    -- Statistics
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,

    -- Audit
    created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns(created_at);

-- 3. Campaign Recipients table - получатели рассылки
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    loyalty_user_id INTEGER NOT NULL REFERENCES loyalty_users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed')),
    sent_at TEXT,
    error_message TEXT
);

-- Indexes for campaign_recipients
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_user ON campaign_recipients(loyalty_user_id);

-- 4. Trigger Templates table - шаблоны триггеров (кастомные)
CREATE TABLE IF NOT EXISTS trigger_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Basic info
    name TEXT NOT NULL,
    description TEXT,

    -- Event configuration
    event_type TEXT NOT NULL CHECK(event_type IN (
        'manual', 'scheduled', 'recurring',
        'offer_created', 'inactive_days', 'balance_reached', 'balance_low',
        'birthday', 'registration_anniversary', 'first_purchase', 'purchase_milestone'
    )),
    event_config TEXT, -- JSON: { days: 30 } or { min_balance: 1000 } etc.

    -- Message template
    message_template TEXT NOT NULL,
    image_url TEXT,
    button_text TEXT,
    button_url TEXT,

    -- State
    is_active INTEGER NOT NULL DEFAULT 1,
    auto_send INTEGER NOT NULL DEFAULT 0, -- Auto-create campaign when triggered

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for trigger_templates
CREATE INDEX IF NOT EXISTS idx_triggers_active ON trigger_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_triggers_event ON trigger_templates(event_type, is_active);

-- 5. Campaign Images table - загруженные изображения
CREATE TABLE IF NOT EXISTS campaign_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for campaign_images
CREATE INDEX IF NOT EXISTS idx_campaign_images_created ON campaign_images(created_at);

-- 6. Trigger Logs table - логи срабатывания триггеров
CREATE TABLE IF NOT EXISTS trigger_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trigger_id INTEGER NOT NULL REFERENCES trigger_templates(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    loyalty_user_id INTEGER REFERENCES loyalty_users(id) ON DELETE SET NULL,
    event_data TEXT, -- JSON with trigger context
    status TEXT NOT NULL DEFAULT 'triggered' CHECK(status IN ('triggered', 'campaign_created', 'skipped', 'error')),
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for trigger_logs
CREATE INDEX IF NOT EXISTS idx_trigger_logs_trigger ON trigger_logs(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_created ON trigger_logs(created_at);
