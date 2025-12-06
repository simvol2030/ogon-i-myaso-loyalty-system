import bcrypt from 'bcrypt';
import { db, nativeClient } from './client';
import { users, posts, admins } from './schema';
import { count } from 'drizzle-orm';

/**
 * Инициализация базы данных
 * Создаёт таблицы если их нет (выполняется автоматически Drizzle)
 */
export async function initializeDatabase() {
	// Create store_images table if it doesn't exist (for image gallery feature)
	if (nativeClient) {
		try {
			nativeClient.exec(`
				CREATE TABLE IF NOT EXISTS store_images (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
					filename TEXT NOT NULL,
					original_name TEXT NOT NULL,
					sort_order INTEGER NOT NULL DEFAULT 0,
					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				);
				CREATE INDEX IF NOT EXISTS idx_store_images_store_id ON store_images(store_id);
				CREATE INDEX IF NOT EXISTS idx_store_images_sort ON store_images(store_id, sort_order);
			`);
			console.log('✅ Store images table initialized');
		} catch (error) {
			console.log('ℹ️ Store images table already exists or error:', error);
		}

		// Create app_customization table if it doesn't exist (for white-label branding)
		try {
			nativeClient.exec(`
				CREATE TABLE IF NOT EXISTS app_customization (
					id INTEGER PRIMARY KEY DEFAULT 1,
					app_name TEXT NOT NULL DEFAULT 'Мурзико',
					app_slogan TEXT NOT NULL DEFAULT 'Лояльность',
					logo_url TEXT NOT NULL DEFAULT '/logo.png',
					favicon_url TEXT DEFAULT '/favicon.ico',
					primary_color TEXT NOT NULL DEFAULT '#ff6b00',
					primary_color_dark TEXT NOT NULL DEFAULT '#e55d00',
					primary_color_light TEXT NOT NULL DEFAULT '#ff8533',
					secondary_color TEXT NOT NULL DEFAULT '#10b981',
					secondary_color_dark TEXT NOT NULL DEFAULT '#059669',
					accent_color TEXT NOT NULL DEFAULT '#dc2626',
					dark_bg_primary TEXT NOT NULL DEFAULT '#17212b',
					dark_bg_secondary TEXT NOT NULL DEFAULT '#0e1621',
					dark_bg_tertiary TEXT NOT NULL DEFAULT '#1f2c38',
					dark_primary_color TEXT NOT NULL DEFAULT '#ff8533',
					dark_text_primary TEXT NOT NULL DEFAULT '#ffffff',
					dark_text_secondary TEXT NOT NULL DEFAULT '#aaaaaa',
					dark_border_color TEXT NOT NULL DEFAULT '#2b3943',
					bottom_nav_items TEXT NOT NULL DEFAULT '[{"id":"home","href":"/","label":"Главная","icon":"home","visible":true},{"id":"offers","href":"/offers","label":"Акции","icon":"tag","visible":true},{"id":"stores","href":"/stores","label":"Магазины","icon":"location","visible":true},{"id":"history","href":"/history","label":"Бонусы","icon":"coins","visible":true},{"id":"profile","href":"/profile","label":"Профиль","icon":"user","visible":true}]',
					sidebar_menu_items TEXT NOT NULL DEFAULT '[{"id":"home","href":"/","label":"Главная","icon":"📊","visible":true,"isExternal":false},{"id":"products","href":"/products","label":"Товары","icon":"🛍️","visible":true,"isExternal":false},{"id":"offers","href":"/offers","label":"Акции","icon":"🎁","visible":true,"isExternal":false},{"id":"stores","href":"/stores","label":"Магазины","icon":"🏪","visible":true,"isExternal":false},{"id":"history","href":"/history","label":"История","icon":"📜","visible":true,"isExternal":false},{"id":"profile","href":"/profile","label":"Профиль","icon":"👤","visible":true,"isExternal":false}]',
					loyalty_card_gradient_start TEXT NOT NULL DEFAULT '#ff6b00',
					loyalty_card_gradient_end TEXT NOT NULL DEFAULT '#dc2626',
					loyalty_card_text_color TEXT NOT NULL DEFAULT '#ffffff',
					loyalty_card_accent_color TEXT NOT NULL DEFAULT '#ffffff',
					loyalty_card_badge_bg TEXT NOT NULL DEFAULT 'rgba(255,255,255,0.95)',
					loyalty_card_badge_text TEXT NOT NULL DEFAULT '#e55d00',
					loyalty_card_border_radius INTEGER NOT NULL DEFAULT 24,
					loyalty_card_show_shimmer INTEGER NOT NULL DEFAULT 1,
					updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
					CHECK (id = 1)
				);
				INSERT OR IGNORE INTO app_customization (id) VALUES (1);
			`);
			console.log('✅ App customization table initialized');

			// Add loyalty card columns if they don't exist (migration for existing DBs)
			const columns = ['loyalty_card_gradient_start', 'loyalty_card_gradient_end', 'loyalty_card_text_color',
				'loyalty_card_accent_color', 'loyalty_card_badge_bg', 'loyalty_card_badge_text',
				'loyalty_card_border_radius', 'loyalty_card_show_shimmer'];
			const defaults: Record<string, string> = {
				loyalty_card_gradient_start: "'#ff6b00'",
				loyalty_card_gradient_end: "'#dc2626'",
				loyalty_card_text_color: "'#ffffff'",
				loyalty_card_accent_color: "'#ffffff'",
				loyalty_card_badge_bg: "'rgba(255,255,255,0.95)'",
				loyalty_card_badge_text: "'#e55d00'",
				loyalty_card_border_radius: '24',
				loyalty_card_show_shimmer: '1'
			};
			for (const col of columns) {
				try {
					const isInt = col.includes('radius') || col.includes('shimmer');
					nativeClient.exec(`ALTER TABLE app_customization ADD COLUMN ${col} ${isInt ? 'INTEGER' : 'TEXT'} NOT NULL DEFAULT ${defaults[col]}`);
					console.log(`✅ Added column ${col} to app_customization`);
				} catch (e) {
					// Column already exists - ignore
				}
			}
		} catch (error) {
			console.log('ℹ️ App customization table already exists or error:', error);
		}

		// Create sellers table if it doesn't exist (for PWA seller app)
		try {
			nativeClient.exec(`
				CREATE TABLE IF NOT EXISTS sellers (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL,
					pin TEXT NOT NULL,
					is_active INTEGER NOT NULL DEFAULT 1,
					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				);
			`);
			console.log('✅ Sellers table initialized');
		} catch (error) {
			console.log('ℹ️ Sellers table already exists or error:', error);
		}

		// Add seller_id and seller_name columns to transactions if they don't exist
		try {
			const tableInfo = nativeClient.prepare("PRAGMA table_info('transactions')").all() as Array<{name: string}>;
			const columnNames = tableInfo.map(col => col.name);

			if (!columnNames.includes('seller_id')) {
				nativeClient.exec('ALTER TABLE transactions ADD COLUMN seller_id INTEGER');
				console.log('✅ Added seller_id column to transactions');
			}
			if (!columnNames.includes('seller_name')) {
				nativeClient.exec('ALTER TABLE transactions ADD COLUMN seller_name TEXT');
				console.log('✅ Added seller_name column to transactions');
			}
		} catch (error) {
			console.log('ℹ️ Transaction seller columns already exist or error:', error);
		}
	}
	console.log('✅ Database tables initialized (managed by Drizzle ORM)');
}

/**
 * Seed данных - заполнение БД тестовыми данными
 */
export async function seedDatabase() {
	try {
		// Проверяем количество пользователей
		const [userCountResult] = await db.select({ count: count() }).from(users);
		const userCount = userCountResult?.count || 0;

		if (userCount === 0) {
			// Создаём пользователей
			await db.insert(users).values([
				{ name: 'Alice Johnson', email: 'alice@example.com' },
				{ name: 'Bob Smith', email: 'bob@example.com' },
				{ name: 'Charlie Brown', email: 'charlie@example.com' }
			]);

			// Создаём посты
			await db.insert(posts).values([
				{
					user_id: 1,
					title: 'Getting Started with SvelteKit',
					content: 'SvelteKit is an amazing framework for building web applications.',
					published: true
				},
				{
					user_id: 1,
					title: 'SQLite with WAL Mode',
					content: 'Write-Ahead Logging provides better concurrency and performance.',
					published: true
				},
				{
					user_id: 2,
					title: 'Building Modern Web Apps',
					content: 'Modern web development is exciting with tools like Svelte.',
					published: true
				},
				{
					user_id: 3,
					title: 'Draft Post',
					content: 'This is a draft post, not yet published.',
					published: false
				}
			]);

			console.log('✅ Database seeded with sample data');
		}

		// Проверяем количество админов
		const [adminCountResult] = await db.select({ count: count() }).from(admins);
		const adminCount = adminCountResult?.count || 0;

		if (adminCount === 0) {
			// Создаём дефолтного супер-админа с хешированным паролем
			const hashedPassword = await bcrypt.hash('Admin123!@#$', 10);

			await db.insert(admins).values({
				email: 'admin@example.com',
				password: hashedPassword,
				role: 'super-admin',
				name: 'Super Admin'
			});

			console.log(
				'✅ Default super-admin created (email: admin@example.com, password: Admin123!@#$)'
			);
			console.log('✅ Password is securely hashed with bcrypt');
		}
	} catch (error) {
		console.error('❌ Error seeding database:', error);
	}
}

// Инициализация при импорте модуля
initializeDatabase();
seedDatabase();
