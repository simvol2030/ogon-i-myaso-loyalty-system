-- Migration: Update Stories Video Limits
-- Увеличить максимальную длительность видео до 90 секунд (1.5 минуты)

-- Update default value for max_video_duration
UPDATE stories_settings SET max_video_duration = 90 WHERE max_video_duration = 45;

-- Note: SQLite doesn't support ALTER COLUMN DEFAULT directly
-- The schema.ts default will be updated separately for new installations
