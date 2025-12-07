/**
 * API layer для интерфейса кассира
 * Легко переключается с моков на реальный backend
 *
 * MEDIUM-1 FIX: Добавлена retry логика для надёжности
 */

import { MOCK_STORES, MOCK_CUSTOMERS, type Store, type Customer, type Transaction } from '$lib/data/cashier-mocks';
import { parseQRData } from '$lib/utils/qr-generator';
import { PUBLIC_BACKEND_URL } from '$env/static/public';
import { fetchWithRetry } from '$lib/utils/retry';

// ===== Режим работы (true = моки, false = реальный API) =====
const USE_MOCKS = false; // ✅ ВСЕГДА REAL API

// ===== Backend URL для server-side И client-side fetch =====
// Client-side: ALWAYS use relative URLs (empty string)
// Server-side: use PUBLIC_BACKEND_URL from env
const BACKEND_URL = typeof window === 'undefined'
	? (PUBLIC_BACKEND_URL || 'http://localhost:3007')
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
		// Реальный API - use absolute URL for server-side, relative for client-side
		const url = BACKEND_URL
			? new URL(`/api/stores/${storeId}/config`, BACKEND_URL).toString()
			: `/api/stores/${storeId}/config`;
		console.log('[getStoreConfig] Fetching:', url);
		const response = await fetch(url);
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
		// Реальный API - use absolute URL for server-side, relative for client-side
		const url = BACKEND_URL
			? new URL(`/api/customers/search?card=${cardNumberClean}&storeId=${storeId}`, BACKEND_URL).toString()
			: `/api/customers/search?card=${cardNumberClean}&storeId=${storeId}`;
		console.log('[findCustomer] Input:', input);
		console.log('[findCustomer] Parsed:', parsed);
		console.log('[findCustomer] Card clean:', cardNumberClean);
		console.log('[findCustomer] Fetching:', url);

		const response = await fetch(url);
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
		// Реальный API - use absolute URL for server-side, relative for client-side
		const url = BACKEND_URL
			? new URL('/api/transactions', BACKEND_URL).toString()
			: '/api/transactions';
		console.log('[createTransaction] Fetching:', url);

		try {
			// MEDIUM-1 FIX: Используем retry для надёжности при нестабильной сети
			const response = await fetchWithRetry(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			}, {
				maxRetries: 3,
				baseDelayMs: 1000
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('[createTransaction] Error:', response.status, errorData);
				return {
					success: false,
					error: errorData.message || errorData.error || 'Ошибка при создании транзакции'
				};
			}

			const result = await response.json();
			return { success: true, transaction: result.transaction };
		} catch (error) {
			console.error('[createTransaction] Network error after retries:', error);
			return {
				success: false,
				error: 'Ошибка сети. Проверьте подключение и попробуйте снова.'
			};
		}
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
		// Реальный API - use absolute URL for server-side, relative for client-side
		const url = BACKEND_URL
			? new URL(`/api/transactions/recent?storeId=${storeId}&limit=${limit}`, BACKEND_URL).toString()
			: `/api/transactions/recent?storeId=${storeId}&limit=${limit}`;
		console.log('[getRecentTransactions] Fetching:', url);
		const response = await fetch(url);
		if (!response.ok) {
			console.error('[getRecentTransactions] Error:', response.status);
			return [];
		}
		return response.json();
	}
}
