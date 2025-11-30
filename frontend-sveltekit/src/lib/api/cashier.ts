/**
 * API layer для интерфейса кассира
 * Легко переключается с моков на реальный backend
 */

import { MOCK_STORES, MOCK_CUSTOMERS, type Store, type Customer, type Transaction } from '$lib/data/cashier-mocks';
import { parseQRData } from '$lib/utils/qr-generator';

// ===== Режим работы (true = моки, false = реальный API) =====
const USE_MOCKS = false; // ✅ ВСЕГДА REAL API

// ===== Backend URL для server-side И client-side fetch =====
// Client-side: use relative URLs (proxied by SvelteKit server endpoints)
// Server-side: use environment variable
const BACKEND_URL = typeof window === 'undefined'
	? (import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3015')
	: ''; // Empty string means relative URLs for browser

// ===== Хранилище транзакций (для моков) =====
const mockTransactions: Transaction[] = [];

// ===== API функции =====

/**
 * Получить конфигурацию магазина
 */
export async function getStoreConfig(storeId: number): Promise<Store> {
	if (USE_MOCKS) {
		// Моки
		const store = MOCK_STORES[storeId];
		if (!store) {
			throw new Error(`Магазин с ID ${storeId} не найден`);
		}
		return store;
	} else {
		// Реальный API - ВАЖНО: абсолютный URL для server-side fetch
		const url = new URL(`/api/stores/${storeId}/config`, BACKEND_URL);
		console.log('[getStoreConfig] Fetching:', url.toString());
		const response = await fetch(url.toString());
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Store config fetch failed: ${response.status} ${errorText}`);
		}
		return response.json();
	}
}

/**
 * Найти клиента по номеру карты или QR-коду
 * Принимает: 6-значный номер "421856" или QR "99421856"
 */
export async function findCustomer(input: string, storeId: number): Promise<Customer | null> {
	// Парсим ввод (может быть QR с префиксом или прямой номер)
	const parsed = await parseQRData(input);

	if (!parsed.valid || !parsed.cardNumber) {
		return null;
	}

	// Убираем пробелы из номера для поиска
	const cardNumberClean = parsed.cardNumber.replace(/\s/g, '');

	if (USE_MOCKS) {
		// Моки - ищем в массиве
		const customer = MOCK_CUSTOMERS.find(c => c.cardNumber === cardNumberClean);
		return customer || null;
	} else {
		// Реальный API - абсолютный URL
		const url = new URL(`/api/customers/search?card=${cardNumberClean}&storeId=${storeId}`, BACKEND_URL);
		console.log('[findCustomer] Input:', input);
		console.log('[findCustomer] Parsed:', parsed);
		console.log('[findCustomer] Card clean:', cardNumberClean);
		console.log('[findCustomer] Fetching:', url.toString());

		const response = await fetch(url.toString());
		console.log('[findCustomer] Response:', response.status, response.statusText);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[findCustomer] Error response:', errorText);
			return null;
		}

		const customer = await response.json();
		console.log('[findCustomer] Customer found:', customer);
		return customer;
	}
}

/**
 * Создать транзакцию
 */
export async function createTransaction(data: {
	customer: Customer;
	storeId: number;
	checkAmount: number;
	pointsToRedeem: number;
	cashbackAmount: number;
	finalAmount: number;
}): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
	if (USE_MOCKS) {
		// Моки - симулируем задержку и обновляем баланс
		await new Promise(resolve => setTimeout(resolve, 1500));

		// Обновляем баланс клиента в массиве
		const customer = MOCK_CUSTOMERS.find(c => c.cardNumber === data.customer.cardNumber);
		if (customer) {
			customer.balance = customer.balance - data.pointsToRedeem + data.cashbackAmount;
		}

		// Создаем транзакцию
		const transaction: Transaction = {
			id: `TXN-${Date.now()}`,
			customerId: data.customer.cardNumber,
			customerName: data.customer.name,
			checkAmount: data.checkAmount,
			pointsRedeemed: data.pointsToRedeem,
			cashbackEarned: data.cashbackAmount,
			finalAmount: data.finalAmount,
			timestamp: new Date().toISOString(),
			storeId: data.storeId
		};

		// Сохраняем в массив
		mockTransactions.unshift(transaction);

		// Ограничиваем историю до 50 транзакций
		if (mockTransactions.length > 50) {
			mockTransactions.pop();
		}

		return { success: true, transaction };
	} else {
		// Реальный API - абсолютный URL
		const url = new URL('/api/transactions', BACKEND_URL);
		console.log('[createTransaction] Fetching:', url.toString());
		const response = await fetch(url.toString(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[createTransaction] Error:', response.status, errorText);
			return { success: false, error: 'Ошибка при создании транзакции' };
		}

		const transaction = await response.json();
		return { success: true, transaction };
	}
}

/**
 * Получить последние транзакции (для отображения истории)
 */
export async function getRecentTransactions(storeId: number, limit: number = 10): Promise<Transaction[]> {
	if (USE_MOCKS) {
		// Моки - возвращаем из массива
		return mockTransactions
			.filter(t => t.storeId === storeId)
			.slice(0, limit);
	} else {
		// Реальный API - абсолютный URL
		const url = new URL(`/api/transactions/recent?storeId=${storeId}&limit=${limit}`, BACKEND_URL);
		console.log('[getRecentTransactions] Fetching:', url.toString());
		const response = await fetch(url.toString());
		if (!response.ok) {
			console.error('[getRecentTransactions] Error:', response.status);
			return [];
		}
		return response.json();
	}
}
