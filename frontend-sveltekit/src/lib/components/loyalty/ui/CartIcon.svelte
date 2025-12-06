<script lang="ts">
	import { cart, cartItemCount } from '$lib/stores/cart';
	import { onMount } from 'svelte';

	interface Props {
		onClick?: () => void;
	}

	let { onClick }: Props = $props();

	onMount(() => {
		// Initialize cart on mount
		cart.init();
	});
</script>

<button class="cart-button" onclick={onClick} aria-label="Открыть корзину">
	<svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>
	{#if $cartItemCount > 0}
		<span class="cart-badge">{$cartItemCount > 99 ? '99+' : $cartItemCount}</span>
	{/if}
</button>

<style>
	.cart-button {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--bg-light);
		border: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s ease;
		flex-shrink: 0;
	}

	.cart-button:hover {
		background: var(--bg-tertiary);
		transform: scale(1.05);
	}

	.cart-button:active {
		transform: scale(0.95);
	}

	.cart-icon {
		width: 22px;
		height: 22px;
		color: var(--text-primary);
	}

	.cart-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		background: var(--primary-orange);
		color: white;
		font-size: 11px;
		font-weight: 700;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 4px rgba(255, 107, 0, 0.3);
		animation: badgePop 0.3s ease-out;
	}

	@keyframes badgePop {
		0% {
			transform: scale(0);
		}
		50% {
			transform: scale(1.2);
		}
		100% {
			transform: scale(1);
		}
	}
</style>
