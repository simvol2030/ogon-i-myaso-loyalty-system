import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Security middleware (applied first)
app.use(securityHeaders);

// Middleware
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
	? ['https://murzicoin.murzico.ru']
	: ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
	origin: ALLOWED_ORIGINS,
	credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
