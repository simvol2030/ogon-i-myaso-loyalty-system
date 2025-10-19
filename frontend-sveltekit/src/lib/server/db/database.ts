import Database from 'better-sqlite3';
import { join } from 'path';
import bcrypt from 'bcrypt';

// Путь к общей базе данных
const DB_PATH = join(process.cwd(), '..', 'data', 'db', 'sqlite', 'app.db');

// Создаём подключение к SQLite с WAL режимом
// Only enable verbose logging in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';
export const db = new Database(DB_PATH, {
	verbose: isDevelopment ? console.log : undefined
});

// Включаем WAL режим для лучшей производительности
db.pragma('journal_mode = WAL');

// Типы для TypeScript
export interface User {
	id: number;
	name: string;
	email: string;
	created_at: string;
}

export interface Post {
	id: number;
	user_id: number;
	title: string;
	content: string | null;
	published: number;
	created_at: string;
	author_name?: string;
	author_email?: string;
}

export interface Admin {
	id: number;
	email: string;
	password: string;
	role: 'super-admin' | 'editor' | 'viewer';
	name: string;
	created_at: string;
}

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
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

	console.log('✅ Database tables initialized');
}

// Seed данных
export function seedDatabase() {
	const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

	if (userCount.count === 0) {
		// Создаём пользователей
		const insertUser = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
		const insertMany = db.transaction((users: Array<{ name: string; email: string }>) => {
			for (const user of users) insertUser.run(user.name, user.email);
		});

		insertMany([
			{ name: 'Alice Johnson', email: 'alice@example.com' },
			{ name: 'Bob Smith', email: 'bob@example.com' },
			{ name: 'Charlie Brown', email: 'charlie@example.com' }
		]);

		// Создаём посты
		const insertPost = db.prepare('INSERT INTO posts (user_id, title, content, published) VALUES (?, ?, ?, ?)');
		const insertManyPosts = db.transaction(
			(posts: Array<{ user_id: number; title: string; content: string; published: number }>) => {
				for (const post of posts) insertPost.run(post.user_id, post.title, post.content, post.published);
			}
		);

		insertManyPosts([
			{
				user_id: 1,
				title: 'Getting Started with SvelteKit',
				content: 'SvelteKit is an amazing framework for building web applications.',
				published: 1
			},
			{
				user_id: 1,
				title: 'SQLite with WAL Mode',
				content: 'Write-Ahead Logging provides better concurrency and performance.',
				published: 1
			},
			{
				user_id: 2,
				title: 'Building Modern Web Apps',
				content: 'Modern web development is exciting with tools like Svelte.',
				published: 1
			},
			{
				user_id: 3,
				title: 'Draft Post',
				content: 'This is a draft post, not yet published.',
				published: 0
			}
		]);

		console.log('✅ Database seeded with sample data');
	}

	// Проверяем, есть ли админы
	const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number };

	if (adminCount.count === 0) {
		// Создаём дефолтного супер-админа с хешированным паролем
		const hashedPassword = bcrypt.hashSync('admin123', 10);

		db.prepare(`
			INSERT INTO admins (email, password, role, name)
			VALUES (?, ?, ?, ?)
		`).run('admin@example.com', hashedPassword, 'super-admin', 'Super Admin');

		console.log('✅ Default super-admin created (email: admin@example.com, password: admin123)');
	}
}

// Подготовленные запросы для производительности
export const queries = {
	// Users
	getAllUsers: db.prepare('SELECT * FROM users ORDER BY created_at DESC'),
	getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
	getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
	createUser: db.prepare('INSERT INTO users (name, email) VALUES (?, ?)'),
	updateUser: db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?'),
	deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

	// Posts
	getAllPosts: db.prepare(`
		SELECT
			posts.*,
			users.name as author_name,
			users.email as author_email
		FROM posts
		LEFT JOIN users ON posts.user_id = users.id
		ORDER BY posts.created_at DESC
	`),
	getPostById: db.prepare(`
		SELECT
			posts.*,
			users.name as author_name,
			users.email as author_email
		FROM posts
		LEFT JOIN users ON posts.user_id = users.id
		WHERE posts.id = ?
	`),
	createPost: db.prepare('INSERT INTO posts (user_id, title, content, published) VALUES (?, ?, ?, ?)'),
	updatePost: db.prepare('UPDATE posts SET user_id = ?, title = ?, content = ?, published = ? WHERE id = ?'),
	deletePost: db.prepare('DELETE FROM posts WHERE id = ?'),

	// Admins
	getAdminByEmail: db.prepare('SELECT * FROM admins WHERE email = ?'),
	getAllAdmins: db.prepare('SELECT id, email, role, name, created_at FROM admins ORDER BY created_at DESC'),
	createAdmin: db.prepare('INSERT INTO admins (email, password, role, name) VALUES (?, ?, ?, ?)'),
	updateAdmin: db.prepare('UPDATE admins SET email = ?, role = ?, name = ? WHERE id = ?'),
	updateAdminPassword: db.prepare('UPDATE admins SET password = ? WHERE id = ?'),
	deleteAdmin: db.prepare('DELETE FROM admins WHERE id = ?')
};

// Инициализация при загрузке модуля
initializeDatabase();
seedDatabase();

export default db;
