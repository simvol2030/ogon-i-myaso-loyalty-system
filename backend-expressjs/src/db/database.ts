import Database from 'better-sqlite3';
import { join } from 'path';

// Путь к общей базе данных
const DB_PATH = join(__dirname, '..', '..', '..', 'data', 'db', 'sqlite', 'app.db');

// Создаём подключение к SQLite с WAL режимом
export const db = new Database(DB_PATH, { verbose: console.log });

// Включаем WAL режим для лучшей производительности
db.pragma('journal_mode = WAL');

// Инициализация таблиц
export function initializeDatabase() {
	// Таблица users
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`);

	// Таблица posts
	db.exec(`
		CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			content TEXT,
			published INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id)
		)
	`);

	// Таблица admins для аутентификации
	db.exec(`
		CREATE TABLE IF NOT EXISTS admins (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			password TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'viewer',
			name TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`);

	// Проверяем, есть ли админы
	const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number };

	if (adminCount.count === 0) {
		// Создаём дефолтного супер-админа
		const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
		const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

		db.prepare(`
			INSERT INTO admins (email, password, role, name)
			VALUES (?, ?, ?, ?)
		`).run(adminEmail, adminPassword, 'super-admin', 'Super Admin');

		console.log('✅ Default super-admin created');
	}

	console.log('✅ Database initialized with WAL mode');
}

export default db;
