<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ordersAPI, type OrderDetails } from '$lib/api/orders';
	import { onMount } from 'svelte';

	let loading = $state(true);
	let order = $state<OrderDetails | null>(null);
	let error = $state('');

	// Get order number from URL
	const orderNumber = $derived($page.url.searchParams.get('order'));

	// Status labels
	const statusLabels: Record<string, { label: string; color: string }> = {
		new: { label: 'Новый', color: '#3b82f6' },
		confirmed: { label: 'Подтверждён', color: '#10b981' },
		processing: { label: 'В обработке', color: '#f59e0b' },
		shipped: { label: 'Отправлен', color: '#8b5cf6' },
		delivered: { label: 'Доставлен', color: '#22c55e' },
		cancelled: { label: 'Отменён', color: '#ef4444' }
	};

	onMount(async () => {
		if (!orderNumber) {
			goto('/products');
			return;
		}

		try {
			order = await ordersAPI.getByNumber(orderNumber);
		} catch (e: any) {
			error = e.message || 'Failed to load order';
			console.error(e);
		} finally {
			loading = false;
		}
	});

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleString('ru-RU', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Order {orderNumber || ''}</title>
</svelte:head>

<div class="success-page">
	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Загрузка заказа...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<span class="error-icon">!</span>
			<h2>Ошибка</h2>
			<p>{error}</p>
			<button onclick={() => goto('/products')}>Продолжить покупки</button>
		</div>
	{:else if order}
		<div class="success-content">
			<!-- Success Header -->
			<div class="success-header">
				<div class="success-icon">&#10003;</div>
				<h1>Заказ оформлен!</h1>
				<p class="order-number">Заказ #{order.orderNumber}</p>
				<p class="order-date">{formatDate(order.createdAt)}</p>
			</div>

			<!-- Status -->
			<div class="status-badge" style="background-color: {statusLabels[order.status]?.color || '#666'}">
				{statusLabels[order.status]?.label || order.status}
			</div>

			<!-- Order Details Card -->
			<div class="details-card">
				<h2>Детали заказа</h2>

				<!-- Items -->
				<div class="items-list">
					{#each order.items as item}
						<div class="order-item">
							<div class="item-info">
								<span class="item-name">{item.productName}</span>
								<span class="item-qty">x{item.quantity}</span>
							</div>
							<span class="item-price">{item.total.toLocaleString('ru-RU')} ₽</span>
						</div>
					{/each}
				</div>

				<!-- Totals -->
				<div class="totals">
					<div class="total-row">
						<span>Сумма</span>
						<span>{order.totals.subtotal.toLocaleString('ru-RU')} ₽</span>
					</div>

					{#if order.totals.deliveryCost > 0}
						<div class="total-row">
							<span>Доставка</span>
							<span>{order.totals.deliveryCost.toLocaleString('ru-RU')} ₽</span>
						</div>
					{/if}

					{#if order.totals.discount > 0}
						<div class="total-row discount">
							<span>Скидка</span>
							<span>-{order.totals.discount.toLocaleString('ru-RU')} ₽</span>
						</div>
					{/if}

					<div class="total-row grand-total">
						<span>Итого</span>
						<span>{order.totals.total.toLocaleString('ru-RU')} ₽</span>
					</div>
				</div>
			</div>

			<!-- Delivery/Pickup Info -->
			<div class="details-card">
				<h2>{order.delivery.type === 'delivery' ? 'Адрес доставки' : 'Точка самовывоза'}</h2>

				{#if order.delivery.type === 'delivery'}
					<div class="address-info">
						<p class="main-address">{order.delivery.address}</p>
						{#if order.delivery.entrance || order.delivery.floor || order.delivery.apartment}
							<p class="address-details">
								{#if order.delivery.entrance}Подъезд {order.delivery.entrance}{/if}
								{#if order.delivery.floor}, Этаж {order.delivery.floor}{/if}
								{#if order.delivery.apartment}, Кв. {order.delivery.apartment}{/if}
							</p>
						{/if}
						{#if order.delivery.intercom}
							<p class="address-details">Домофон: {order.delivery.intercom}</p>
						{/if}
					</div>
				{:else if order.delivery.store}
					<div class="store-info">
						<p class="store-name">{order.delivery.store.name}</p>
						<p class="store-address">{order.delivery.store.address}</p>
					</div>
				{/if}
			</div>

			<!-- Contact Info -->
			<div class="details-card">
				<h2>Контакты</h2>
				<div class="contact-info">
					<p><strong>Имя:</strong> {order.customer.name}</p>
					<p><strong>Телефон:</strong> {order.customer.phone}</p>
					{#if order.customer.email}
						<p><strong>Email:</strong> {order.customer.email}</p>
					{/if}
				</div>
			</div>

			<!-- Notes -->
			{#if order.notes}
				<div class="details-card">
					<h2>Примечания</h2>
					<p class="notes">{order.notes}</p>
				</div>
			{/if}

			<!-- Actions -->
			<div class="actions">
				<button class="primary-btn" onclick={() => goto('/products')}>
					Продолжить покупки
				</button>
				<button class="secondary-btn" onclick={() => goto('/')}>
					На главную
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.success-page {
		padding: 0 16px 100px;
		max-width: 480px;
		margin: 0 auto;
	}

	.loading, .error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		gap: 16px;
		text-align: center;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--border-color);
		border-top-color: var(--primary-orange);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-icon {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: var(--accent-red);
		color: white;
		font-size: 32px;
		font-weight: bold;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.error-state h2 {
		font-size: 24px;
		color: var(--text-primary);
		margin: 0;
	}

	.error-state p {
		color: var(--text-secondary);
		margin: 0;
	}

	.error-state button {
		padding: 12px 24px;
		border-radius: 12px;
		border: none;
		background: var(--primary-orange);
		color: white;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
	}

	.success-content {
		padding-top: 24px;
	}

	.success-header {
		text-align: center;
		margin-bottom: 24px;
	}

	.success-icon {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: linear-gradient(135deg, #22c55e, #16a34a);
		color: white;
		font-size: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 16px;
		box-shadow: 0 4px 20px rgba(34, 197, 94, 0.3);
	}

	.success-header h1 {
		font-size: 28px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 8px 0;
	}

	.order-number {
		font-size: 16px;
		font-weight: 600;
		color: var(--primary-orange);
		margin: 0 0 4px 0;
	}

	.order-date {
		font-size: 14px;
		color: var(--text-secondary);
		margin: 0;
	}

	.status-badge {
		display: inline-block;
		padding: 6px 16px;
		border-radius: 20px;
		color: white;
		font-size: 14px;
		font-weight: 600;
		margin: 0 auto 24px;
		display: flex;
		justify-content: center;
		width: fit-content;
	}

	.details-card {
		background: var(--card-bg);
		border-radius: 16px;
		padding: 20px;
		margin-bottom: 16px;
		box-shadow: var(--shadow);
	}

	.details-card h2 {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 16px 0;
	}

	.items-list {
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 16px;
		margin-bottom: 16px;
	}

	.order-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
	}

	.item-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.item-name {
		font-size: 14px;
		color: var(--text-primary);
	}

	.item-qty {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.item-price {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.totals {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.total-row {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.total-row.discount {
		color: var(--accent-green, #22c55e);
	}

	.total-row.grand-total {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		padding-top: 8px;
		border-top: 1px solid var(--border-color);
	}

	.address-info, .store-info, .contact-info {
		font-size: 14px;
		color: var(--text-primary);
	}

	.main-address, .store-name {
		font-weight: 600;
		margin: 0 0 4px 0;
	}

	.address-details, .store-address {
		color: var(--text-secondary);
		margin: 0;
	}

	.contact-info p {
		margin: 0 0 8px 0;
	}

	.contact-info p:last-child {
		margin-bottom: 0;
	}

	.notes {
		font-size: 14px;
		color: var(--text-secondary);
		margin: 0;
		font-style: italic;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 24px;
	}

	.primary-btn, .secondary-btn {
		width: 100%;
		padding: 14px;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.primary-btn {
		background: var(--primary-orange);
		color: white;
		border: none;
	}

	.primary-btn:hover {
		background: var(--primary-orange-dark);
	}

	.secondary-btn {
		background: var(--bg-white);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.secondary-btn:hover {
		background: var(--bg-light);
	}
</style>
