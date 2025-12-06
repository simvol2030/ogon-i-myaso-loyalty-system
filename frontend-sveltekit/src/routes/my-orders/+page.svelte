<script lang="ts">
	import { onMount } from 'svelte';
	import { ordersAPI, type UserOrderHistoryItem } from '$lib/api/orders';

	let orders = $state<UserOrderHistoryItem[]>([]);
	let isLoading = $state(true);
	let error = $state('');
	let notAuthenticated = $state(false);

	onMount(async () => {
		await loadOrders();
	});

	async function loadOrders() {
		isLoading = true;
		error = '';
		notAuthenticated = false;

		try {
			orders = await ordersAPI.getMyOrders();
		} catch (err: any) {
			if (err.message === 'NOT_AUTHENTICATED') {
				notAuthenticated = true;
			} else {
				error = err.message || 'Ошибка загрузки заказов';
			}
		} finally {
			isLoading = false;
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('ru-RU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatPrice(price: number): string {
		return price.toLocaleString('ru-RU') + ' р.';
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'new':
				return '#3b82f6';
			case 'confirmed':
				return '#8b5cf6';
			case 'processing':
				return '#f59e0b';
			case 'shipped':
				return '#06b6d4';
			case 'delivered':
				return '#22c55e';
			case 'cancelled':
				return '#ef4444';
			default:
				return '#6b7280';
		}
	}
</script>

<svelte:head>
	<title>Мои заказы</title>
</svelte:head>

<div class="orders-page">
	<h2 class="section-header">📦 Мои заказы</h2>

	{#if isLoading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Загрузка...</p>
		</div>
	{:else if notAuthenticated}
		<div class="empty-state">
			<span class="empty-icon">🔐</span>
			<p class="empty-title">Требуется авторизация</p>
			<p class="empty-text">
				Войдите через Telegram, чтобы увидеть историю ваших заказов
			</p>
		</div>
	{:else if error}
		<div class="error-state">
			<span class="error-icon">⚠️</span>
			<p>{error}</p>
			<button class="retry-btn" onclick={loadOrders}>Попробовать снова</button>
		</div>
	{:else if orders.length === 0}
		<div class="empty-state">
			<span class="empty-icon">📭</span>
			<p class="empty-title">Пока нет заказов</p>
			<p class="empty-text">
				Ваши заказы будут отображаться здесь
			</p>
			<a href="/products" class="shop-link">Перейти в каталог</a>
		</div>
	{:else}
		<div class="orders-list">
			{#each orders as order}
				<a href="/checkout/success?order={order.orderNumber}" class="order-card">
					<div class="order-header">
						<span class="order-number">#{order.orderNumber}</span>
						<span
							class="order-status"
							style="background: {getStatusColor(order.status)}20; color: {getStatusColor(order.status)};"
						>
							{order.statusLabel}
						</span>
					</div>

					<div class="order-date">
						{formatDate(order.createdAt)}
					</div>

					<div class="order-delivery">
						{#if order.deliveryType === 'pickup' && order.store}
							<span class="delivery-icon">🏪</span>
							<span>Самовывоз: {order.store.name}</span>
						{:else if order.deliveryAddress}
							<span class="delivery-icon">🚚</span>
							<span>Доставка: {order.deliveryAddress}</span>
						{/if}
					</div>

					<div class="order-footer">
						<span class="order-total">{formatPrice(order.totals.total)}</span>
						<span class="view-details">Подробнее →</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.orders-page {
		padding: 0 16px 24px;
		max-width: 600px;
		margin: 0 auto;
	}

	.section-header {
		font-size: 24px;
		font-weight: bold;
		color: var(--text-primary, #111);
		margin: 16px 0 20px 0;
		letter-spacing: -0.025em;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		color: #666;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #e5e7eb;
		border-top-color: var(--color-primary, #3b82f6);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.empty-state,
	.error-state {
		text-align: center;
		padding: 3rem 1rem;
	}

	.empty-icon,
	.error-icon {
		font-size: 3rem;
		display: block;
		margin-bottom: 1rem;
	}

	.empty-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: #333;
	}

	.empty-text {
		color: #666;
		margin: 0 0 1rem;
	}

	.shop-link {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: var(--color-primary, #3b82f6);
		color: white;
		border-radius: 8px;
		text-decoration: none;
		font-weight: 500;
	}

	.retry-btn {
		padding: 0.75rem 1.5rem;
		background: var(--color-primary, #3b82f6);
		color: white;
		border: none;
		border-radius: 8px;
		font-weight: 500;
		cursor: pointer;
	}

	.orders-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.order-card {
		display: block;
		background: white;
		border-radius: 12px;
		padding: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		text-decoration: none;
		color: inherit;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.order-card:active {
		transform: scale(0.98);
	}

	.order-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.order-number {
		font-weight: 600;
		font-size: 1rem;
	}

	.order-status {
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.order-date {
		font-size: 0.875rem;
		color: #666;
		margin-bottom: 0.75rem;
	}

	.order-delivery {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #444;
		margin-bottom: 0.75rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.delivery-icon {
		flex-shrink: 0;
	}

	.order-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.75rem;
		border-top: 1px solid #f0f0f0;
	}

	.order-total {
		font-weight: 600;
		font-size: 1.125rem;
		color: #111;
	}

	.view-details {
		font-size: 0.875rem;
		color: var(--color-primary, #3b82f6);
	}

	@media (max-width: 480px) {
		.orders-page {
			padding: 0 12px 20px;
		}

		.section-header {
			font-size: 22px;
			margin: 12px 0 16px 0;
		}

		.order-card {
			padding: 0.875rem;
		}
	}
</style>
