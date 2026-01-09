<script lang="ts">
	import { goto } from '$app/navigation';
	import { cart, cartTotal } from '$lib/stores/cart';
	import { ordersAPI, type ShopSettings, type OrderData } from '$lib/api/orders';
	import { onMount } from 'svelte';
	import CityAutocomplete from '$lib/components/shop/CityAutocomplete.svelte';

	// State
	let loading = $state(true);
	let submitting = $state(false);
	let error = $state('');
	let settings = $state<ShopSettings | null>(null);

	// Form data
	let customerName = $state('');
	let customerPhone = $state('+7 (9');
	let customerEmail = $state('');
	let deliveryType = $state<'pickup' | 'delivery'>('delivery');
	let deliveryCity = $state('');
	let deliveryLocationId = $state<number | null>(null);
	let deliveryLocationPrice = $state(0);
	let deliveryLocationThreshold = $state<number | null>(null);
	let deliveryAddress = $state('');
	let deliveryEntrance = $state('');
	let deliveryFloor = $state('');
	let deliveryApartment = $state('');
	let deliveryIntercom = $state('');
	let selectedStoreId = $state<number | null>(null);
	let notes = $state('');

	// Derived
	const cartItems = $derived($cart.items);
	const subtotal = $derived($cart.summary.subtotal);
	const itemCount = $derived($cart.summary.itemCount);

	// Calculate delivery cost
	const deliveryCost = $derived(() => {
		if (!settings) return 0;
		if (deliveryType === 'pickup') return 0;

		// Check global free delivery threshold first
		if (settings.freeDeliveryFrom && subtotal >= settings.freeDeliveryFrom) return 0;

		// Check location-specific free delivery threshold
		if (deliveryLocationThreshold !== null && subtotal >= deliveryLocationThreshold) return 0;

		// Use location-specific price if available, otherwise use global delivery cost
		if (deliveryLocationId !== null && deliveryLocationPrice > 0) {
			return deliveryLocationPrice / 100; // Convert kopeks to rubles
		}

		return settings.deliveryCost;
	});

	// Check if location has free delivery available
	const locationHasFreeDelivery = $derived(() => {
		return deliveryLocationThreshold !== null;
	});

	// Calculate remaining for free delivery
	const remainingForFreeDelivery = $derived(() => {
		if (deliveryLocationThreshold === null) return null;
		const remaining = deliveryLocationThreshold - subtotal;
		return remaining > 0 ? remaining : 0;
	});

	const total = $derived(subtotal + deliveryCost());

	// Validation
	const isFormValid = $derived(() => {
		if (!customerName.trim() || !customerPhone.trim()) return false;
		if (deliveryType === 'delivery' && !deliveryAddress.trim()) return false;
		if (deliveryType === 'pickup' && !selectedStoreId) return false;
		return true;
	});

	const minOrderMet = $derived(() => {
		if (!settings || !settings.minOrderAmount) return true;
		return subtotal >= settings.minOrderAmount;
	});

	// Load settings and cart on mount
	onMount(async () => {
		try {
			await cart.init();
			settings = await ordersAPI.getShopSettings();

			// Check cart is not empty
			if ($cart.items.length === 0) {
				goto('/products');
				return;
			}

			// Set default delivery type based on settings
			if (settings.deliveryEnabled && !settings.pickupEnabled) {
				deliveryType = 'delivery';
			} else if (!settings.deliveryEnabled && settings.pickupEnabled) {
				deliveryType = 'pickup';
			}

			// Auto-select first store if pickup only option
			if (settings.stores.length === 1) {
				selectedStoreId = settings.stores[0].id;
			}
		} catch (e) {
			error = 'Failed to load checkout';
			console.error(e);
		} finally {
			loading = false;
		}
	});

	// Phone input formatting
	function formatPhone(e: Event) {
		const input = e.target as HTMLInputElement;
		let value = input.value.replace(/\D/g, '');

		// Format as +7 (XXX) XXX-XX-XX
		if (value.length > 0) {
			if (value[0] === '8') value = '7' + value.slice(1);
			if (value[0] !== '7') value = '7' + value;

			let formatted = '+7';
			if (value.length > 1) formatted += ' (' + value.slice(1, 4);
			if (value.length > 4) formatted += ') ' + value.slice(4, 7);
			if (value.length > 7) formatted += '-' + value.slice(7, 9);
			if (value.length > 9) formatted += '-' + value.slice(9, 11);

			customerPhone = formatted;
		}
	}

	// City autocomplete handler
	function handleCitySelection(cityName: string, locationId: number | null, price: number, freeThreshold: number | null) {
		deliveryCity = cityName;
		deliveryLocationId = locationId;
		deliveryLocationPrice = price;
		deliveryLocationThreshold = freeThreshold;
	}

	// Submit order
	async function handleSubmit() {
		if (!isFormValid() || !minOrderMet() || submitting) return;

		error = '';
		submitting = true;

		try {
			const orderData: OrderData = {
				customerName: customerName.trim(),
				customerPhone: customerPhone.trim(),
				customerEmail: customerEmail.trim() || undefined,
				deliveryType,
				notes: notes.trim() || undefined
			};

			if (deliveryType === 'delivery') {
				orderData.deliveryCity = deliveryCity.trim() || undefined;
				orderData.deliveryAddress = deliveryAddress.trim();
				orderData.deliveryEntrance = deliveryEntrance.trim() || undefined;
				orderData.deliveryFloor = deliveryFloor.trim() || undefined;
				orderData.deliveryApartment = deliveryApartment.trim() || undefined;
				orderData.deliveryIntercom = deliveryIntercom.trim() || undefined;
				if (deliveryLocationId !== null) {
					orderData.deliveryLocationId = deliveryLocationId;
				}
			} else {
				orderData.storeId = selectedStoreId!;
			}

			const result = await ordersAPI.create(orderData);

			// Navigate to success page
			goto(`/checkout/success?order=${result.orderNumber}`);
		} catch (e: any) {
			error = e.message || 'Failed to create order';
			console.error(e);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Оформление заказа</title>
</svelte:head>

<div class="checkout-page">
	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Загрузка...</p>
		</div>
	{:else if !settings}
		<div class="error-state">
			<p>Не удалось загрузить оформление</p>
			<button onclick={() => goto('/products')}>Вернуться к товарам</button>
		</div>
	{:else}
		<header class="page-header">
			<button class="back-btn" onclick={() => history.back()}>
				<span class="back-icon">&larr;</span>
			</button>
			<h1>Оформление заказа</h1>
		</header>

		{#if error}
			<div class="error-banner">{error}</div>
		{/if}

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<!-- Contact Info -->
			<section class="form-section">
				<h2>Контактная информация</h2>

				<div class="form-group">
					<label for="name">Имя *</label>
					<input
						type="text"
						id="name"
						bind:value={customerName}
						placeholder="Иван Иванов"
						required
					/>
				</div>

				<div class="form-group">
					<label for="phone">Телефон *</label>
					<input
						type="tel"
						id="phone"
						bind:value={customerPhone}
						oninput={formatPhone}
						placeholder="+7 (999) 123-45-67"
						required
					/>
				</div>

				<div class="form-group">
					<label for="email">Email (не обязательно)</label>
					<input
						type="email"
						id="email"
						bind:value={customerEmail}
						placeholder="email@example.com"
					/>
				</div>
			</section>

			<!-- Delivery Type -->
			<section class="form-section">
				<h2>Способ получения</h2>

				<div class="delivery-options">
					{#if settings.deliveryEnabled}
						<button
							type="button"
							class="delivery-option"
							class:active={deliveryType === 'delivery'}
							onclick={() => deliveryType = 'delivery'}
						>
							<span class="option-icon">🚚</span>
							<span class="option-label">Доставка</span>
							{#if settings.deliveryCost > 0}
								<span class="option-price">
									{#if settings.freeDeliveryFrom}
										Бесплатно от {settings.freeDeliveryFrom.toLocaleString('ru-RU')} ₽
									{:else}
										{settings.deliveryCost.toLocaleString('ru-RU')} ₽
									{/if}
								</span>
							{:else}
								<span class="option-price free">Бесплатно</span>
							{/if}
						</button>
					{/if}

					{#if settings.pickupEnabled}
						<button
							type="button"
							class="delivery-option"
							class:active={deliveryType === 'pickup'}
							onclick={() => deliveryType = 'pickup'}
						>
							<span class="option-icon">🏪</span>
							<span class="option-label">Самовывоз</span>
							<span class="option-price free">Бесплатно</span>
						</button>
					{/if}
				</div>

				<!-- Delivery Address -->
				{#if deliveryType === 'delivery'}
					<div class="address-fields">
						<div class="form-group">
							<label for="city">Город / населенный пункт</label>
							<CityAutocomplete
								bind:value={deliveryCity}
								bind:selectedLocationId={deliveryLocationId}
								bind:deliveryPrice={deliveryLocationPrice}
								bind:freeDeliveryThreshold={deliveryLocationThreshold}
								oninput={handleCitySelection}
								placeholder="Начните вводить название..."
							/>
							{#if deliveryLocationId !== null}
								{#if locationHasFreeDelivery()}
									{#if remainingForFreeDelivery() === 0}
										<span class="free-delivery-active">
											✅ Бесплатная доставка в {deliveryCity}!
										</span>
									{:else if remainingForFreeDelivery() !== null}
										<span class="free-delivery-hint">
											🚚 Добавьте ещё на {remainingForFreeDelivery()!.toLocaleString('ru-RU')} ₽ для бесплатной доставки в {deliveryCity}
										</span>
									{/if}
								{:else if deliveryLocationPrice > 0}
									<span class="delivery-price-hint">
										Доставка: {(deliveryLocationPrice / 100).toLocaleString('ru-RU')} ₽
									</span>
								{/if}
							{/if}
						</div>

						<div class="form-group">
							<label for="address">Адрес *</label>
							<input
								type="text"
								id="address"
								bind:value={deliveryAddress}
								placeholder="Улица, дом"
								required
							/>
						</div>

						<div class="form-row">
							<div class="form-group small">
								<label for="entrance">Подъезд</label>
								<input
									type="text"
									id="entrance"
									bind:value={deliveryEntrance}
									placeholder="1"
								/>
							</div>

							<div class="form-group small">
								<label for="floor">Этаж</label>
								<input
									type="text"
									id="floor"
									bind:value={deliveryFloor}
									placeholder="3"
								/>
							</div>

							<div class="form-group small">
								<label for="apartment">Кв.</label>
								<input
									type="text"
									id="apartment"
									bind:value={deliveryApartment}
									placeholder="42"
								/>
							</div>
						</div>

						<div class="form-group">
							<label for="intercom">Домофон</label>
							<input
								type="text"
								id="intercom"
								bind:value={deliveryIntercom}
								placeholder="42#"
							/>
						</div>
					</div>
				{/if}

				<!-- Store Selection for Pickup -->
				{#if deliveryType === 'pickup'}
					<div class="store-selection">
						<p class="selection-label">Выберите точку самовывоза *</p>
						<div class="stores-list">
							{#each settings.stores as store (store.id)}
								<button
									type="button"
									class="store-card"
									class:selected={selectedStoreId === store.id}
									onclick={() => selectedStoreId = store.id}
								>
									<div class="store-name">{store.name}</div>
									<div class="store-address">{store.address}</div>
									<div class="store-hours">{store.hours}</div>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</section>

			<!-- Notes -->
			<section class="form-section">
				<h2>Примечания (не обязательно)</h2>
				<div class="form-group">
					<textarea
						bind:value={notes}
						placeholder="Особые пожелания или инструкции..."
						rows="3"
					></textarea>
				</div>
			</section>

			<!-- Order Summary -->
			<section class="form-section summary-section">
				<h2>Итого по заказу</h2>

				<div class="summary-items">
					{#each cartItems as item (item.id)}
						<div class="summary-item">
							<span class="item-name">{item.product.name}</span>
							<span class="item-qty">x{item.quantity}</span>
							<span class="item-price">{item.itemTotal.toLocaleString('ru-RU')} ₽</span>
						</div>
					{/each}
				</div>

				<div class="summary-totals">
					<div class="summary-row">
						<span>Сумма ({itemCount} товаров)</span>
						<span>{subtotal.toLocaleString('ru-RU')} ₽</span>
					</div>

					{#if deliveryType === 'delivery'}
						<div class="summary-row">
							<span>Доставка</span>
							<span class:free={deliveryCost() === 0}>
								{deliveryCost() === 0 ? 'Бесплатно' : deliveryCost().toLocaleString('ru-RU') + ' ₽'}
							</span>
						</div>
					{/if}

					<div class="summary-row total">
						<span>Итого</span>
						<span>{total.toLocaleString('ru-RU')} ₽</span>
					</div>
				</div>
			</section>

			<!-- Min Order Warning -->
			{#if !minOrderMet()}
				<div class="min-order-warning">
					Минимальный заказ: {settings.minOrderAmount.toLocaleString('ru-RU')} ₽
				</div>
			{/if}

			<!-- Submit Button -->
			<button
				type="submit"
				class="submit-btn"
				disabled={!isFormValid() || !minOrderMet() || submitting}
			>
				{#if submitting}
					<span class="btn-spinner"></span>
					Обработка...
				{:else}
					Оформить заказ ({total.toLocaleString('ru-RU')} ₽)
				{/if}
			</button>
		</form>
	{/if}
</div>

<style>
	.checkout-page {
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
	}

	.spinner, .btn-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border-color);
		border-top-color: var(--primary-orange);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.btn-spinner {
		width: 18px;
		height: 18px;
		border-width: 2px;
		display: inline-block;
		margin-right: 8px;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.page-header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px 0;
	}

	.back-btn {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		border: 1px solid var(--border-color);
		background: var(--bg-white);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 18px;
		color: var(--text-primary);
		transition: all 0.2s ease;
	}

	.back-btn:hover {
		background: var(--bg-light);
	}

	.page-header h1 {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.error-banner {
		background: var(--accent-red);
		color: white;
		padding: 12px 16px;
		border-radius: 12px;
		margin-bottom: 16px;
		font-size: 14px;
	}

	.form-section {
		background: var(--card-bg);
		border-radius: 16px;
		padding: 20px;
		margin-bottom: 16px;
		box-shadow: var(--shadow);
	}

	.form-section h2 {
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 16px 0;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-group label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 8px;
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 12px 16px;
		border-radius: 12px;
		border: 1px solid var(--border-color);
		background: var(--bg-white);
		font-size: 15px;
		color: var(--text-primary);
		transition: all 0.2s ease;
		box-sizing: border-box;
	}

	.form-group input:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: var(--primary-orange);
		box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.1);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 80px;
	}

	.form-row {
		display: flex;
		gap: 12px;
	}

	.form-group.small {
		flex: 1;
	}

	.delivery-options {
		display: flex;
		gap: 12px;
		margin-bottom: 16px;
	}

	.delivery-option {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 16px;
		border-radius: 12px;
		border: 2px solid var(--border-color);
		background: var(--bg-white);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.delivery-option:hover {
		border-color: var(--primary-orange);
	}

	.delivery-option.active {
		border-color: var(--primary-orange);
		background: rgba(255, 107, 0, 0.05);
	}

	.option-icon {
		font-size: 24px;
	}

	.option-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.option-price {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.option-price.free {
		color: var(--accent-green, #22c55e);
	}

	.address-fields {
		animation: slideDown 0.2s ease;
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.selection-label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}

	.stores-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.store-card {
		width: 100%;
		padding: 16px;
		border-radius: 12px;
		border: 2px solid var(--border-color);
		background: var(--bg-white);
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.store-card:hover {
		border-color: var(--primary-orange);
	}

	.store-card.selected {
		border-color: var(--primary-orange);
		background: rgba(255, 107, 0, 0.05);
	}

	.store-name {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 4px;
	}

	.store-address {
		font-size: 13px;
		color: var(--text-secondary);
		margin-bottom: 4px;
	}

	.store-hours {
		font-size: 12px;
		color: var(--text-tertiary);
	}

	.summary-items {
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 16px;
		margin-bottom: 16px;
	}

	.summary-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 0;
	}

	.item-name {
		flex: 1;
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

	.summary-totals {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.summary-row.total {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
	}

	.summary-row .free {
		color: var(--accent-green, #22c55e);
	}

	.min-order-warning {
		background: var(--warning-bg, #fff3cd);
		color: var(--warning-text, #856404);
		padding: 12px 16px;
		border-radius: 12px;
		margin-bottom: 16px;
		font-size: 14px;
		text-align: center;
	}

	:global(.dark) .min-order-warning {
		background: #78350f;
		color: #fef3c7;
	}

	.submit-btn {
		width: 100%;
		padding: 16px;
		border-radius: 14px;
		border: none;
		background: var(--primary-orange);
		color: white;
		font-size: 16px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.submit-btn:hover:not(:disabled) {
		background: var(--primary-orange-dark);
		transform: scale(1.02);
	}

	.submit-btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.submit-btn:disabled {
		background: var(--text-tertiary);
		cursor: not-allowed;
	}

	.delivery-price-hint {
		display: block;
		margin-top: 8px;
		font-size: 13px;
		color: var(--primary-orange);
		font-weight: 600;
	}

	.free-delivery-hint {
		display: block;
		margin-top: 8px;
		padding: 10px 12px;
		background: linear-gradient(135deg, #fef3c7, #fde68a);
		border-radius: 8px;
		font-size: 13px;
		color: #92400e;
		font-weight: 500;
	}

	:global(.dark) .free-delivery-hint {
		background: linear-gradient(135deg, #78350f, #92400e);
		color: #fef3c7;
	}

	.free-delivery-active {
		display: block;
		margin-top: 8px;
		padding: 10px 12px;
		background: linear-gradient(135deg, #d1fae5, #a7f3d0);
		border-radius: 8px;
		font-size: 13px;
		color: #065f46;
		font-weight: 600;
	}

	:global(.dark) .free-delivery-active {
		background: linear-gradient(135deg, #064e3b, #065f46);
		color: #d1fae5;
	}
</style>
