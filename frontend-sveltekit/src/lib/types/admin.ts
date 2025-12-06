/**
 * Admin Panel Types
 * Based on DATA-MODEL documents from admin-docs/wave-*
 * Version: 1.0
 * Date: 2025-01-19
 */

// ============================================
// CLIENTS (Wave 1)
// ============================================

/**
 * Client - базовый тип для списка клиентов
 */
export interface Client {
	id: number;
	telegramId: string;
	cardNumber: string | null;
	name: string;
	firstName: string;
	lastName: string | null;
	username: string | null;
	balance: number;
	totalPurchases: number;
	totalSaved: number;
	registeredStoreId: number | null;
	registeredStoreName?: string | null;
	registrationDate: string;
	lastActivity: string;
	isActive: boolean;
	chatId: number;
}

/**
 * ClientDetail - расширенный тип для детальной страницы
 */
export interface ClientDetail extends Client {
	email: string | null;
	phone: string | null;
	birthdate: string | null;
	languageCode: string | null;
}

/**
 * ClientTransaction - транзакция клиента
 */
export interface ClientTransaction {
	id: number;
	date: string;
	storeId: number | null;
	storeName: string | null;
	type: 'purchase' | 'earn' | 'redeem' | 'manual_add' | 'manual_subtract';
	purchaseAmount: number | null;
	pointsChange: number;
	balanceAfter: number;
	description: string | null;
}

/**
 * BalanceChangeHistory - история ручных изменений баланса
 */
export interface BalanceChangeHistory {
	id: number;
	date: string;
	adminId: number;
	adminName: string;
	operation: 'add' | 'subtract';
	amount: number;
	reason: string;
	balanceBefore: number;
	balanceAfter: number;
}

/**
 * ClientStats - статистика клиента (computed)
 */
export interface ClientStats {
	currentBalance: number;
	effectiveBalance: number;
	expiredPoints: number;
	totalPurchases: number;
	totalSpent: number;
	totalSaved: number;
	averageCheck: number;
	lastPurchaseDate: string | null;
	registrationDate: string;
	daysSinceRegistration: number;
}

/**
 * ClientsListParams - параметры для списка клиентов
 */
export interface ClientsListParams {
	search?: string;
	status?: 'all' | 'active' | 'inactive';
	storeId?: number | 'all';
	registrationDateFrom?: string;
	registrationDateTo?: string;
	sortBy?: 'name' | 'balance' | 'totalPurchases' | 'registrationDate' | 'lastActivity';
	sortOrder?: 'asc' | 'desc';
	page?: number;
	limit?: number;
}

/**
 * TransactionsListParams - параметры для истории транзакций
 */
export interface TransactionsListParams {
	type?: 'all' | 'earn' | 'spend';
	storeId?: number | 'all';
	dateFrom?: string;
	dateTo?: string;
	page?: number;
	limit?: number;
}

/**
 * BalanceAdjustmentData - данные для ручного изменения баланса
 */
export interface BalanceAdjustmentData {
	operation: 'add' | 'subtract';
	amount: number;
	reason: string;
}

/**
 * Pagination - общий тип для пагинации
 */
export interface Pagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

// ============================================
// PROMOTIONS (Wave 1)
// ============================================

/**
 * Promotion - акция/специальное предложение (Sprint 2 Refactored)
 * Simplified schema: title, description, image, deadline, isActive, showOnHome
 */
export interface Promotion {
	id: number;
	title: string;
	description: string;
	image: string | null; // HIGH FIX #9: Match DB schema (nullable)
	deadline: string;
	isActive: boolean;
	showOnHome: boolean;
	createdAt?: string;
	updatedAt?: string;
}

/**
 * PromotionFormData - форма создания/редактирования акции (Sprint 2 Refactored)
 */
export interface PromotionFormData {
	title: string;
	description: string;
	image: string | null; // HIGH FIX #2 (Cycle 2): Match Promotion interface (nullable)
	deadline: string;
	isActive: boolean;
	showOnHome: boolean;
}

/**
 * PromotionsListParams - параметры для списка акций (Sprint 2 Refactored)
 */
export interface PromotionsListParams {
	status?: 'all' | 'active' | 'inactive';
	search?: string;
	page?: number;
	limit?: number;
}

// ============================================
// CATEGORIES (Shop Extension)
// ============================================

/**
 * Category - категория товаров
 */
export interface Category {
	id: number;
	name: string;
	slug: string;
	description: string | null;
	image: string | null;
	parentId: number | null;
	position: number;
	isActive: boolean;
	productCount?: number;
	subcategories?: Category[];
	createdAt?: string;
	updatedAt?: string;
}

/**
 * CategoryFormData - форма создания/редактирования категории
 */
export interface CategoryFormData {
	name: string;
	description?: string;
	image?: string;
	parentId?: number | null;
	isActive: boolean;
}

/**
 * CategoriesListParams - параметры для списка категорий
 */
export interface CategoriesListParams {
	search?: string;
	status?: 'all' | 'active' | 'inactive';
	parent?: 'root' | 'all' | number;
}

// ============================================
// PRODUCTS (Wave 1)
// ============================================

/**
 * Product - товар каталога (Sprint 3 Extended + Shop Extension)
 */
export interface Product {
	id: number;
	name: string;
	description: string | null;
	price: number;
	oldPrice: number | null;
	quantityInfo: string | null; // количество/упаковка
	image: string;
	category: string; // Legacy text category
	categoryId: number | null; // Shop extension: FK to categories table
	sku: string | null; // Shop extension: артикул товара
	position: number; // Shop extension: позиция для сортировки
	isActive: boolean;
	showOnHome: boolean; // топовые товары
	isRecommendation: boolean; // рекомендации без цены
	createdAt?: string;
	updatedAt?: string;
}

/**
 * ProductFormData - форма создания/редактирования товара (Sprint 3 Extended + Shop Extension)
 */
export interface ProductFormData {
	name: string;
	description: string | undefined;
	price: number;
	oldPrice: number | undefined;
	quantityInfo: string | undefined; // количество/упаковка
	image: string;
	category: string; // Legacy text category
	categoryId: number | null; // Shop extension: FK to categories table
	sku: string | undefined; // Shop extension: артикул товара
	isActive: boolean;
	showOnHome: boolean;
	isRecommendation: boolean;
}

/**
 * ProductCategory - категория товаров
 */
export interface ProductCategory {
	name: string;
	count: number;
}

/**
 * ProductsListParams - параметры для списка товаров
 */
export interface ProductsListParams {
	status?: 'all' | 'active' | 'inactive';
	category?: string | 'all';
	onSale?: 'all' | 'yes' | 'no';
	priceMin?: number;
	priceMax?: number;
	search?: string;
	sortBy?: 'name' | 'price' | 'category';
	sortOrder?: 'asc' | 'desc';
	page?: number;
	limit?: number;
}

// ============================================
// STORES (Wave 2)
// ============================================

/**
 * Store - магазин/точка продаж (Sprint 4 Task 1.4)
 */
export interface Store {
	id: number;
	name: string;
	city: string | null; // Sprint 4 Task 1.4: City name
	address: string;
	phone: string;
	hours: string;
	features: string[];
	iconColor: string;
	coordinates: {
		lat: number;
		lng: number;
	};
	status: 'open' | 'closed';
	isActive: boolean;
}

/**
 * StoreFormData - форма создания/редактирования магазина (Sprint 4 Task 1.4)
 */
export interface StoreFormData {
	name: string;
	city: string | undefined; // Sprint 4 Task 1.4: City name
	address: string;
	phone: string;
	hours: string;
	features: string[];
	iconColor: string;
	coordinates: {
		lat: number;
		lng: number;
	};
	isActive: boolean;
}

/**
 * StoreStats - статистика магазина
 */
export interface StoreStats {
	totalTransactions: number;
	totalRevenue: number;
	totalClients: number;
	averageCheck: number;
}

/**
 * StoreImage - изображение магазина для галереи
 */
export interface StoreImage {
	id: number;
	filename: string;
	originalName: string;
	sortOrder: number;
	url: string;
}

// ============================================
// STATISTICS (Wave 2)
// ============================================

/**
 * DashboardStats - статистика для дашборда
 */
export interface DashboardStats {
	clients: {
		total: number;
		active: number;
		newThisMonth: number;
		averageBalance: number;
	};
	transactions: {
		totalToday: number;
		totalThisWeek: number;
		totalThisMonth: number;
		revenueToday: number;
		revenueThisWeek: number;
		revenueThisMonth: number;
	};
	stores: {
		total: number;
		active: number;
		topByRevenue: StoreRevenue[];
	};
	promotions: {
		total: number;
		active: number;
		urgent: number;
	};
}

/**
 * StoreRevenue - выручка по магазину
 */
export interface StoreRevenue {
	storeId: number;
	storeName: string;
	transactionCount: number;
	revenue: number;
	topProduct?: string;
}

/**
 * TimeSeriesData - данные для графиков
 */
export interface TimeSeriesData {
	labels: string[];
	datasets: {
		label: string;
		data: number[];
		color: string;
	}[];
}

export interface ClientGrowth extends TimeSeriesData {}
export interface RevenueGrowth extends TimeSeriesData {}
export interface TransactionVolume extends TimeSeriesData {}

// ============================================
// SETTINGS (Wave 3)
// ============================================

/**
 * Admin - администратор системы
 */
export interface Admin {
	id: number;
	email: string;
	role: 'super-admin' | 'editor' | 'viewer';
	name: string;
	createdAt: string;
}

/**
 * AdminFormData - форма создания/редактирования админа
 */
export interface AdminFormData {
	email: string;
	password: string;
	role: 'super-admin' | 'editor' | 'viewer';
	name: string;
}

/**
 * SystemSettings - системные настройки
 */
export interface SystemSettings {
	cashbackPercent: number;
	maxDiscountPercent: number;
	pointsExpiryDays: number;
	requireCardNumber: boolean;
}

// ============================================
// COMMON
// ============================================

/**
 * APIResponse - стандартный ответ API
 */
export interface APIResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	code?: string;
	details?: any;
}

/**
 * APIListResponse - ответ для списков с пагинацией
 */
export interface APIListResponse<T> {
	success: boolean;
	data: {
		items: T[];
		pagination: Pagination;
	};
}
