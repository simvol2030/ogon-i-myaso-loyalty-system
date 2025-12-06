<script lang="ts">
	import { goto } from '$app/navigation';
	import { cart, cartItemCount, cartTotal } from '$lib/stores/cart';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	const formatPrice = (price: number) => {
		return price.toLocaleString('ru-RU') + ' ₽';
	};

	const handleQuantityChange = async (itemId: number, delta: number) => {
		const item = $cart.items.find(i => i.id === itemId);
		if (!item) return;

		const newQuantity = item.quantity + delta;
		if (newQuantity <= 0) {
			await cart.removeItem(itemId);
		} else {
			await cart.updateQuantity(itemId, newQuantity);
		}
	};

	const handleRemove = async (itemId: number) => {
		await cart.removeItem(itemId);
	};

	const handleCheckout = () => {
		onClose();
		goto('/checkout');
	};

	const handleOverlayClick = (e: MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};
</script>

{#if open}
	<div class="cart-overlay" onclick={handleOverlayClick} role="dialog" aria-modal="true">
		<div class="cart-drawer">
			<header class="drawer-header">
				<h2>Корзина</h2>
				<button class="close-btn" onclick={onClose} aria-label="Закрыть">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
			</header>

			{#if $cart.loading && !$cart.initialized}
				<div class="loading-state">
					<span class="spinner"></span>
					<p>Загрузка корзины...</p>
				</div>
			{:else if $cart.items.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🛒</span>
					<h3>Корзина пуста</h3>
					<p>Добавьте товары из каталога</p>
					<button class="browse-btn" onclick={() => { onClose(); goto('/products'); }}>
						Перейти в каталог
					</button>
				</div>
			{:else}
				<div class="cart-items">
					{#each $cart.items as item (item.id)}
						<div class="cart-item">
							<div class="item-image">
								{#if item.product.image}
									<img src={item.product.image} alt={item.product.name} />
								{:else}
									<div class="no-image">📦</div>
								{/if}
							</div>

							<div class="item-details">
								<h4 class="item-name">{item.product.name}</h4>
								{#if item.product.quantityInfo}
									<span class="item-info">{item.product.quantityInfo}</span>
								{/if}
								<div class="item-price">
									{#if item.product.oldPrice && item.product.oldPrice > item.product.price}
										<span class="old-price">{formatPrice(item.product.oldPrice)}</span>
									{/if}
									<span class="price">{formatPrice(item.product.price)}</span>
								</div>
							</div>

							<div class="item-actions">
								<div class="quantity-controls">
									<button
										class="qty-btn"
										onclick={() => handleQuantityChange(item.id, -1)}
										aria-label="Уменьшить количество"
									>
										−
									</button>
									<span class="quantity">{item.quantity}</span>
									<button
										class="qty-btn"
										onclick={() => handleQuantityChange(item.id, 1)}
										aria-label="Увеличить количество"
									>
										+
									</button>
								</div>
								<span class="item-total">{formatPrice(item.itemTotal)}</span>
								<button
									class="remove-btn"
									onclick={() => handleRemove(item.id)}
									aria-label="Удалить товар"
								>
									🗑️
								</button>
							</div>
						</div>
					{/each}
				</div>

				<footer class="drawer-footer">
					<div class="cart-summary">
						<div class="summary-row">
							<span>Товаров:</span>
							<span>{$cartItemCount} шт.</span>
						</div>
						{#if $cart.summary.deliveryCost > 0}
							<div class="summary-row">
								<span>Доставка:</span>
								<span>{formatPrice($cart.summary.deliveryCost)}</span>
							</div>
						{/if}
						<div class="summary-row total">
							<span>Итого:</span>
							<span>{formatPrice($cartTotal)}</span>
						</div>
					</div>

					<button class="checkout-btn" onclick={handleCheckout}>
						Оформить заказ
					</button>
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	.cart-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1000;
		display: flex;
		justify-content: flex-end;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.cart-drawer {
		width: 100%;
		max-width: 400px;
		height: 100%;
		background: var(--bg-white);
		display: flex;
		flex-direction: column;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	.drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		padding-top: calc(16px + env(safe-area-inset-top));
		border-bottom: 1px solid var(--border-color);
		background: var(--bg-white);
	}

	.drawer-header h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.close-btn {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--bg-light);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		background: var(--bg-tertiary);
	}

	.close-btn svg {
		width: 20px;
		height: 20px;
		color: var(--text-primary);
	}

	.loading-state,
	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px;
		text-align: center;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border-color);
		border-top-color: var(--primary-orange);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state h3 {
		margin: 0 0 8px;
		font-size: 18px;
		color: var(--text-primary);
	}

	.empty-state p {
		margin: 0 0 20px;
		color: var(--text-secondary);
		font-size: 14px;
	}

	.browse-btn {
		padding: 12px 24px;
		background: var(--primary-orange);
		color: white;
		border: none;
		border-radius: 10px;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.browse-btn:hover {
		background: var(--primary-orange-dark);
	}

	.cart-items {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
	}

	.cart-item {
		display: flex;
		gap: 12px;
		padding: 12px;
		background: var(--bg-light);
		border-radius: 12px;
		margin-bottom: 10px;
	}

	.item-image {
		width: 64px;
		height: 64px;
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg-tertiary);
		flex-shrink: 0;
	}

	.item-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.no-image {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 24px;
		opacity: 0.3;
	}

	.item-details {
		flex: 1;
		min-width: 0;
	}

	.item-name {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.item-info {
		font-size: 12px;
		color: var(--text-secondary);
		display: block;
		margin-bottom: 4px;
	}

	.item-price {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.old-price {
		font-size: 12px;
		color: var(--text-secondary);
		text-decoration: line-through;
	}

	.price {
		font-size: 14px;
		font-weight: 700;
		color: var(--primary-orange);
	}

	.item-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
	}

	.quantity-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-white);
		border-radius: 8px;
		padding: 4px;
	}

	.qty-btn {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		background: var(--bg-light);
		border: none;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.qty-btn:hover {
		background: var(--primary-orange);
		color: white;
	}

	.quantity {
		min-width: 24px;
		text-align: center;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.item-total {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.remove-btn {
		background: none;
		border: none;
		font-size: 16px;
		cursor: pointer;
		opacity: 0.5;
		transition: opacity 0.2s ease;
		padding: 4px;
	}

	.remove-btn:hover {
		opacity: 1;
	}

	.drawer-footer {
		padding: 16px;
		padding-bottom: calc(16px + env(safe-area-inset-bottom));
		background: var(--bg-white);
		border-top: 1px solid var(--border-color);
	}

	.cart-summary {
		margin-bottom: 16px;
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
		color: var(--text-secondary);
		margin-bottom: 8px;
	}

	.summary-row.total {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		padding-top: 8px;
		border-top: 1px solid var(--border-color);
		margin-top: 8px;
	}

	.checkout-btn {
		width: 100%;
		padding: 14px;
		background: var(--primary-orange);
		color: white;
		border: none;
		border-radius: 12px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.checkout-btn:hover {
		background: var(--primary-orange-dark);
		transform: scale(1.02);
	}

	.checkout-btn:active {
		transform: scale(0.98);
	}

	@media (max-width: 480px) {
		.cart-drawer {
			max-width: 100%;
		}
	}
</style>
