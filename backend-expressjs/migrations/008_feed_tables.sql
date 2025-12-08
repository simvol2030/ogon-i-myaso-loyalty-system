-- Migration: Add feed tables for Telegram-style news feed
-- Date: 2025-12-07

-- Feed Tags table - теги для постов и статей
CREATE TABLE IF NOT EXISTS feed_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#ff6b00',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feed_tags_slug ON feed_tags(slug);
CREATE INDEX IF NOT EXISTS idx_feed_tags_active_order ON feed_tags(is_active, sort_order);

-- Feed Posts table - посты и статьи ленты
CREATE TABLE IF NOT EXISTS feed_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'post' CHECK(type IN ('post', 'article')),
    title TEXT,
    content TEXT NOT NULL,
    excerpt TEXT,
    author_name TEXT,
    is_published INTEGER NOT NULL DEFAULT 0,
    published_at TEXT,
    views_count INTEGER NOT NULL DEFAULT 0,
    likes_count INTEGER NOT NULL DEFAULT 0,
    dislikes_count INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_published ON feed_posts(is_published, published_at);
CREATE INDEX IF NOT EXISTS idx_feed_posts_type_published ON feed_posts(type, is_published, published_at);

-- Feed Post Images table - изображения для постов/статей
CREATE TABLE IF NOT EXISTS feed_post_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    alt_text TEXT,
    position_in_content INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feed_post_images_post ON feed_post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_post_images_sort ON feed_post_images(post_id, sort_order);

-- Feed Post Tags table - связь постов и тегов (многие-ко-многим)
CREATE TABLE IF NOT EXISTS feed_post_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES feed_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feed_post_tags_post ON feed_post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_post_tags_tag ON feed_post_tags(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_post_tags_unique ON feed_post_tags(post_id, tag_id);

-- Feed Post Reactions table - лайки/дизлайки от пользователей Telegram
CREATE TABLE IF NOT EXISTS feed_post_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    telegram_user_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK(reaction_type IN ('like', 'dislike')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FIX B3: UNIQUE index to prevent duplicate reactions from same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_reactions_post_user ON feed_post_reactions(post_id, telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_post ON feed_post_reactions(post_id);

-- Insert default tags
INSERT OR IGNORE INTO feed_tags (name, slug, color, sort_order) VALUES
    ('Новости', 'news', '#3b82f6', 1),
    ('Акции', 'promo', '#ef4444', 2),
    ('Советы', 'tips', '#10b981', 3),
    ('Обновления', 'updates', '#8b5cf6', 4);
