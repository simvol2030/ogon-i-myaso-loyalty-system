import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { initializeDatabase } from './db/database';
import { securityHeaders } from './middleware/security';
import { initScheduledJobs } from './jobs';

// Импорт роутеров
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import postsRouter from './routes/posts';
import cashierRouter from './routes/cashier';
import onecRouter from './routes/1c';
import customersRouter from './routes/customers';
import migrateRouter from './routes/migrate';
import storesRouter from './routes/stores';
import transactionsRouter from './routes/transactions';
import contentRouter from './routes/content';

// Public API routes
import loyaltyRouter from './routes/api/loyalty';
import catalogRouter from './routes/api/catalog'; // Shop extension: Public catalog
import cartRouter from './routes/api/cart'; // Shop extension: Shopping cart

// Admin routes
import adminClientsRouter from './routes/admin/clients';
import adminPromotionsRouter from './routes/admin/promotions';
import adminProductsRouter from './routes/admin/products';
import adminStoresRouter from './routes/admin/stores';
import adminStatisticsRouter from './routes/admin/statistics';
import adminSettingsRouter from './routes/admin/settings';
import adminDashboardRouter from './routes/admin/dashboard'; // Sprint 5 Task 4.1
import adminStoreImagesRouter from './routes/admin/store-images';
import adminCategoriesRouter from './routes/admin/categories'; // Shop extension: Categories

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// 🔒 FIX: CORS must be BEFORE securityHeaders to work correctly
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
	? ['https://murzicoin.murzico.ru']
	: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:4173'];

app.use(cors({
	origin: ALLOWED_ORIGINS,
	credentials: true
}));

// Security middleware (applied after CORS)
app.use(securityHeaders);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parse cookies for session authentication

// Static files - serve uploaded images
// NOTE: Use /api/uploads path so nginx proxy correctly routes to Express in production
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));
// Also keep /uploads for local development without nginx
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
	const start = Date.now();
	res.on('finish', () => {
		const duration = Date.now() - start;
		console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
	});
	next();
});

// Инициализация базы данных
initializeDatabase();

// Базовый роут
app.get('/', (req, res) => {
	res.json({
		message: 'Project Box v3 - REST API (Loyalty System)',
		version: '3.0.0',
		endpoints: {
			auth: '/api/auth',
			users: '/api/users',
			posts: '/api/posts',
			cashier: '/api/cashier',
			customers: '/api/customers',
			stores: '/api/stores',
			transactions: '/api/transactions',
			'1c-integration': '/api/1c',
			content: '/api/content'
		}
	});
});

// API роуты
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);
app.use('/api/cashier', cashierRouter);
app.use('/api/1c', onecRouter);
app.use('/api/customers', customersRouter);
app.use('/api/migrate', migrateRouter);
app.use('/api/stores', storesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/content', contentRouter);
app.use('/api/loyalty', loyaltyRouter); // Public loyalty settings endpoint
app.use('/api/catalog', catalogRouter); // Public catalog (categories & products)
app.use('/api/cart', cartRouter); // Shopping cart

// Admin API routes
app.use('/api/admin/clients', adminClientsRouter);
app.use('/api/admin/promotions', adminPromotionsRouter);
app.use('/api/admin/products', adminProductsRouter);
app.use('/api/admin/stores', adminStoresRouter);
app.use('/api/admin/statistics', adminStatisticsRouter);
app.use('/api/admin/settings', adminSettingsRouter);
app.use('/api/admin/dashboard', adminDashboardRouter); // Sprint 5 Task 4.1
app.use('/api/admin/stores', adminStoreImagesRouter); // Store images (nested under stores)
app.use('/api/admin/categories', adminCategoriesRouter); // Shop extension: Categories

// Обработка 404
app.use((req, res) => {
	res.status(404).json({ error: 'Endpoint not found' });
});

// Запуск сервера
// FIX: Listen on 0.0.0.0 to accept connections from all interfaces (IPv4 and IPv6)
// This resolves ERR_CONNECTION_REFUSED when frontend tries to connect from 127.0.0.1
app.listen(PORT, '0.0.0.0', () => {
	console.log(`\n✅ Server running on http://0.0.0.0:${PORT}`);
	console.log(`✅ Accessible at http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
	console.log(`✅ API endpoints available at http://localhost:${PORT}/api\n`);

	// Start cron jobs for scheduled tasks
	initScheduledJobs();
});
