/**
 * Cart API Client
 * Based on SHOP_EXTENSION_PLAN.md
 */

import { API_BASE_URL } from '$lib/config';

export interface CartItem {
	id: number;
	productId: number;
	quantity: number;
	product: {
		name: string;
		price: number;
		oldPrice: number | null;
		image: string;
		category: string;
		quantityInfo: string | null;
	};
	itemTotal: number;
}

export interface CartSummary {
	itemCount: number;
	subtotal: number;
	deliveryCost: number;
	total: number;
}

export interface CartData {
	items: CartItem[];
	summary: CartSummary;
}

async function fetchWithCredentials(url: string, options: RequestInit = {}) {
	const response = await fetch(url, {
		...options,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...options.headers
		}
	});

	const data = await response.json();

	if (!response.ok || !data.success) {
		throw new Error(data.error || 'Request failed');
	}

	return data;
}

export const cartAPI = {
	/**
	 * Get cart contents
	 */
	async get(): Promise<CartData> {
		const response = await fetchWithCredentials(`${API_BASE_URL}/cart`);
		return response.data;
	},

	/**
	 * Add item to cart
	 */
	async add(productId: number, quantity: number = 1): Promise<{ id: number; quantity: number; cartItemCount: number }> {
		const response = await fetchWithCredentials(`${API_BASE_URL}/cart/add`, {
			method: 'POST',
			body: JSON.stringify({ productId, quantity })
		});
		return response.data;
	},

	/**
	 * Update item quantity
	 */
	async updateQuantity(itemId: number, quantity: number): Promise<{ id: number; quantity: number }> {
		const response = await fetchWithCredentials(`${API_BASE_URL}/cart/${itemId}`, {
			method: 'PUT',
			body: JSON.stringify({ quantity })
		});
		return response.data;
	},

	/**
	 * Remove item from cart
	 */
	async remove(itemId: number): Promise<void> {
		await fetchWithCredentials(`${API_BASE_URL}/cart/${itemId}`, {
			method: 'DELETE'
		});
	},

	/**
	 * Clear entire cart
	 */
	async clear(): Promise<void> {
		await fetchWithCredentials(`${API_BASE_URL}/cart/clear`, {
			method: 'POST'
		});
	},

	/**
	 * Get cart item count (for header badge)
	 */
	async getCount(): Promise<number> {
		const response = await fetchWithCredentials(`${API_BASE_URL}/cart/count`);
		return response.data.count;
	}
};
