/**
 * Cart Store
 * Manages cart state across the application
 * Based on SHOP_EXTENSION_PLAN.md
 */

import { writable, derived } from 'svelte/store';
import { cartAPI, type CartItem, type CartSummary } from '$lib/api/cart';

// Cart state
interface CartState {
	items: CartItem[];
	summary: CartSummary;
	loading: boolean;
	error: string | null;
	initialized: boolean;
}

const initialState: CartState = {
	items: [],
	summary: {
		itemCount: 0,
		subtotal: 0,
		deliveryCost: 0,
		total: 0
	},
	loading: false,
	error: null,
	initialized: false
};

function createCartStore() {
	const { subscribe, set, update } = writable<CartState>(initialState);

	return {
		subscribe,

		/**
		 * Initialize cart by loading from API
		 */
		async init() {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				const data = await cartAPI.get();
				update(state => ({
					...state,
					items: data.items,
					summary: data.summary,
					loading: false,
					initialized: true
				}));
			} catch (error: any) {
				update(state => ({
					...state,
					loading: false,
					error: error.message,
					initialized: true
				}));
			}
		},

		/**
		 * Add item to cart
		 */
		async addItem(productId: number, quantity: number = 1) {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				const result = await cartAPI.add(productId, quantity);
				// Refresh cart to get updated items and summary
				const data = await cartAPI.get();
				update(state => ({
					...state,
					items: data.items,
					summary: data.summary,
					loading: false
				}));
				return result;
			} catch (error: any) {
				update(state => ({
					...state,
					loading: false,
					error: error.message
				}));
				throw error;
			}
		},

		/**
		 * Update item quantity
		 */
		async updateQuantity(itemId: number, quantity: number) {
			// Optimistic update
			update(state => ({
				...state,
				items: state.items.map(item =>
					item.id === itemId
						? { ...item, quantity, itemTotal: item.product.price * quantity }
						: item
				)
			}));

			try {
				await cartAPI.updateQuantity(itemId, quantity);
				// Refresh to get accurate totals
				const data = await cartAPI.get();
				update(state => ({
					...state,
					items: data.items,
					summary: data.summary
				}));
			} catch (error: any) {
				// Revert optimistic update by refreshing
				const data = await cartAPI.get();
				update(state => ({
					...state,
					items: data.items,
					summary: data.summary,
					error: error.message
				}));
			}
		},

		/**
		 * Remove item from cart
		 */
		async removeItem(itemId: number) {
			// Optimistic update
			update(state => ({
				...state,
				items: state.items.filter(item => item.id !== itemId)
			}));

			try {
				await cartAPI.remove(itemId);
				// Refresh to get accurate totals
				const data = await cartAPI.get();
				update(state => ({
					...state,
					items: data.items,
					summary: data.summary
				}));
			} catch (error: any) {
				// Revert optimistic update by refreshing
				const data = await cartAPI.get();
				update(state => ({
					...state,
					items: data.items,
					summary: data.summary,
					error: error.message
				}));
			}
		},

		/**
		 * Clear entire cart
		 */
		async clear() {
			update(state => ({ ...state, loading: true }));

			try {
				await cartAPI.clear();
				update(state => ({
					...state,
					items: [],
					summary: {
						itemCount: 0,
						subtotal: 0,
						deliveryCost: 0,
						total: 0
					},
					loading: false
				}));
			} catch (error: any) {
				update(state => ({
					...state,
					loading: false,
					error: error.message
				}));
			}
		},

		/**
		 * Reset store to initial state
		 */
		reset() {
			set(initialState);
		}
	};
}

export const cart = createCartStore();

// Derived store for item count (for header badge)
export const cartItemCount = derived(cart, $cart => $cart.summary.itemCount);

// Derived store for cart total
export const cartTotal = derived(cart, $cart => $cart.summary.total);
