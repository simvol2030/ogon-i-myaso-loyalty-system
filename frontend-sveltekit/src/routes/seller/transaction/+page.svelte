<!--
  Seller Transaction Page
  - Информация о клиенте
  - Ввод суммы чека
  - Выбор действия (списать/накопить)
  - Подтверждение операции
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	// Customer data
	let customer: any = $state(null);
	let isLoadingCustomer = $state(true);
	let customerError = $state('');

	// Transaction state
	let checkAmount = $state('');
	let isProcessing = $state(false);
	let transactionResult: 'success' | 'error' | null = $state(null);
	let resultMessage = $state('');

	// Loyalty settings
	let cashbackPercent = $state(4);
	let maxDiscountPercent = $state(20);

	// Computed values
	let checkAmountNum = $derived(parseFloat(checkAmount) || 0);
	let cashbackAmount = $derived(Math.floor(checkAmountNum * cashbackPercent / 100));
	let maxRedeemPoints = $derived(Math.min(
		Math.floor(checkAmountNum * maxDiscountPercent / 100),
		customer?.current_balance || 0
	));
	let finalAmountAfterRedeem = $derived(Math.max(0, checkAmountNum - maxRedeemPoints));
	let cashbackAfterRedeem = $derived(Math.floor(finalAmountAfterRedeem * cashbackPercent / 100));

	onMount(async () => {
		// Проверка авторизации
		const token = localStorage.getItem('seller_token');
		if (!token) {
			goto('/seller/login');
			return;
		}

		// Получаем ID клиента из URL
		const customerId = page.url.searchParams.get('customerId');
		if (!customerId) {
			goto('/seller');
			return;
		}

		// Загружаем настройки лояльности
		await loadLoyaltySettings();

		// Загружаем данные клиента
		await loadCustomer(customerId);
	});

	async function loadLoyaltySettings() {
		try {
			const response = await fetch('/api/loyalty/settings');
			if (response.ok) {
				const data = await response.json();
				cashbackPercent = data.earning_percent || 4;
				maxDiscountPercent = data.max_discount_percent || 20;
			}
		} catch (err) {
			console.error('Failed to load settings:', err);
		}
	}

	async function loadCustomer(customerId: string) {
		isLoadingCustomer = true;
		customerError = '';

		try {
			const token = localStorage.getItem('seller_token');
			const response = await fetch(`/api/customers/${customerId}`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				customer = data.customer;
			} else {
				customerError = 'Клиент не найден';
			}
		} catch (err) {
			console.error('Failed to load customer:', err);
			customerError = 'Ошибка загрузки';
		} finally {
			isLoadingCustomer = false;
		}
	}

	async function handleTransaction(type: 'earn' | 'spend') {
		if (checkAmountNum <= 0) {
			return;
		}

		isProcessing = true;
		transactionResult = null;

		try {
			const token = localStorage.getItem('seller_token');
			const sellerId = localStorage.getItem('seller_id');
			const sellerName = localStorage.getItem('seller_name');

			// Формат совместим с backend /api/transactions
			const pointsToRedeem = type === 'spend' ? maxRedeemPoints : 0;
			const calculatedCashback = type === 'spend' ? cashbackAfterRedeem : cashbackAmount;
			const calculatedFinalAmount = type === 'spend' ? finalAmountAfterRedeem : checkAmountNum;

			const response = await fetch('/api/transactions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					customer: {
						id: customer.id,
						cardNumber: customer.card_number,
						name: `${customer.first_name} ${customer.last_name || ''}`.trim()
					},
					storeId: 1, // Пока без привязки к магазину
					checkAmount: checkAmountNum,
					pointsToRedeem,
					cashbackAmount: calculatedCashback,
					finalAmount: calculatedFinalAmount,
					// Данные продавца
					sellerId: sellerId ? parseInt(sellerId) : null,
					sellerName: sellerName || null
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
				console.error('Transaction failed:', response.status, errorData);
				transactionResult = 'error';
				resultMessage = errorData.error || errorData.message || `Ошибка ${response.status}`;
				return;
			}

			const data = await response.json();
			console.log('Transaction success:', data);

			transactionResult = 'success';

			// Используем данные с сервера для отображения
			const serverCashback = data.transaction?.cashbackEarned || calculatedCashback;
			const serverFinal = data.transaction?.finalAmount || calculatedFinalAmount;

			if (type === 'spend') {
				resultMessage = `Списано ${pointsToRedeem} ₽\nК оплате: ${serverFinal} ₽\nНачислено: +${serverCashback} ₽`;
			} else {
				resultMessage = `Начислено ${serverCashback} ₽\nК оплате: ${checkAmountNum} ₽`;
			}

			// Обновляем баланс клиента
			if (data.transaction?.newBalance !== undefined) {
				customer.current_balance = data.transaction.newBalance;
			}
		} catch (err: any) {
			console.error('Transaction error:', err);
			console.error('Error stack:', err.stack);
			transactionResult = 'error';
			resultMessage = err.message || 'Ошибка соединения';
		} finally {
			isProcessing = false;
		}
	}

	function handleNewTransaction() {
		goto('/seller');
	}

	function goBack() {
		goto('/seller');
	}
</script>

<div class="transaction-page">
	<!-- Back Button -->
	<button class="back-btn" onclick={goBack}>
		← Назад
	</button>

	{#if isLoadingCustomer}
		<div class="loading-container">
			<div class="spinner"></div>
			<p>Загрузка...</p>
		</div>
	{:else if customerError}
		<div class="error-container">
			<p>{customerError}</p>
			<button onclick={goBack}>Вернуться</button>
		</div>
	{:else if transactionResult}
		<!-- Transaction Result -->
		<div class="result-container" class:success={transactionResult === 'success'} class:error={transactionResult === 'error'}>
			<div class="result-icon">
				{transactionResult === 'success' ? '✅' : '❌'}
			</div>
			<h2>{transactionResult === 'success' ? 'Операция успешна!' : 'Ошибка'}</h2>
			<p class="result-message">{resultMessage}</p>

			{#if transactionResult === 'success'}
				<div class="new-balance">
					Новый баланс: <strong>{customer.current_balance?.toFixed(0) || 0} ₽</strong>
				</div>
			{/if}

			<button class="new-transaction-btn" onclick={handleNewTransaction}>
				Новая операция
			</button>
		</div>
	{:else}
		<!-- Customer Info -->
		<section class="customer-section">
			<div class="customer-avatar">
				👤
			</div>
			<div class="customer-info">
				<h2>{customer.first_name} {customer.last_name || ''}</h2>
				<p class="customer-card">Карта: {customer.card_number}</p>
			</div>
			<div class="customer-balance">
				<span class="balance-label">Баланс</span>
				<span class="balance-value">{customer.current_balance?.toFixed(0) || 0} ₽</span>
			</div>
		</section>

		<!-- Amount Input -->
		<section class="amount-section">
			<label for="check-amount">Сумма чека</label>
			<div class="amount-input-wrapper">
				<input
					id="check-amount"
					type="number"
					inputmode="decimal"
					step="0.01"
					min="0"
					placeholder="0"
					bind:value={checkAmount}
					class="amount-input"
					disabled={isProcessing}
				/>
				<span class="currency">₽</span>
			</div>
		</section>

		{#if checkAmountNum > 0}
			<!-- Transaction Options -->
			<section class="options-section">
				<!-- Option: Spend Points -->
				{#if maxRedeemPoints > 0}
					<button
						class="option-btn spend"
						onclick={() => handleTransaction('spend')}
						disabled={isProcessing}
					>
						<div class="option-header">
							<span class="option-icon">💳</span>
							<span class="option-title">СПИСАТЬ</span>
						</div>
						<div class="option-details">
							<div class="detail-row">
								<span>Списать баллов:</span>
								<span class="highlight-orange">-{maxRedeemPoints} ₽</span>
							</div>
							<div class="detail-row">
								<span>К оплате:</span>
								<span class="highlight-white">{finalAmountAfterRedeem} ₽</span>
							</div>
							<div class="detail-row">
								<span>Кэшбэк:</span>
								<span class="highlight-green">+{cashbackAfterRedeem} ₽</span>
							</div>
						</div>
					</button>
				{/if}

				<!-- Option: Earn Only -->
				<button
					class="option-btn earn"
					onclick={() => handleTransaction('earn')}
					disabled={isProcessing}
				>
					<div class="option-header">
						<span class="option-icon">💰</span>
						<span class="option-title">КОПИТЬ</span>
					</div>
					<div class="option-details">
						<div class="detail-row">
							<span>К оплате:</span>
							<span class="highlight-white">{checkAmountNum} ₽</span>
						</div>
						<div class="detail-row">
							<span>Кэшбэк:</span>
							<span class="highlight-green">+{cashbackAmount} ₽</span>
						</div>
					</div>
				</button>
			</section>
		{/if}

		<!-- Processing Indicator -->
		{#if isProcessing}
			<div class="processing-overlay">
				<div class="spinner"></div>
				<p>Обработка...</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	.transaction-page {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 16px;
		gap: 20px;
		position: relative;
	}

	.back-btn {
		align-self: flex-start;
		padding: 8px 16px;
		background: transparent;
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 8px;
		color: #94a3b8;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.back-btn:hover {
		background: rgba(148, 163, 184, 0.1);
		color: #f8fafc;
	}

	.loading-container,
	.error-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		color: #94a3b8;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid rgba(16, 185, 129, 0.2);
		border-top-color: #10b981;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-container button {
		padding: 12px 24px;
		background: rgba(51, 65, 85, 0.6);
		border: none;
		border-radius: 12px;
		color: #f8fafc;
		cursor: pointer;
	}

	/* Customer Section */
	.customer-section {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px;
		background: rgba(30, 41, 59, 0.6);
		border-radius: 16px;
		border: 1px solid rgba(148, 163, 184, 0.1);
	}

	.customer-avatar {
		font-size: 48px;
		line-height: 1;
	}

	.customer-info {
		flex: 1;
	}

	.customer-info h2 {
		font-size: 18px;
		font-weight: 600;
		margin: 0 0 4px 0;
		color: #f8fafc;
	}

	.customer-card {
		font-size: 14px;
		color: #94a3b8;
		margin: 0;
	}

	.customer-balance {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	.balance-label {
		font-size: 12px;
		color: #64748b;
	}

	.balance-value {
		font-size: 24px;
		font-weight: 700;
		color: #10b981;
	}

	/* Amount Section */
	.amount-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.amount-section label {
		font-size: 14px;
		color: #94a3b8;
	}

	.amount-input-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px;
		background: rgba(30, 41, 59, 0.8);
		border: 2px solid rgba(148, 163, 184, 0.2);
		border-radius: 16px;
		transition: border-color 0.2s ease;
	}

	.amount-input-wrapper:focus-within {
		border-color: #10b981;
	}

	.amount-input {
		flex: 1;
		background: transparent;
		border: none;
		font-size: 32px;
		font-weight: 600;
		color: #f8fafc;
		outline: none;
		text-align: right;
	}

	.amount-input::placeholder {
		color: #475569;
	}

	.amount-input::-webkit-outer-spin-button,
	.amount-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.currency {
		font-size: 24px;
		color: #94a3b8;
	}

	/* Options Section */
	.options-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.option-btn {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 20px;
		background: rgba(30, 41, 59, 0.6);
		border: 2px solid rgba(148, 163, 184, 0.15);
		border-radius: 16px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
	}

	.option-btn:hover:not(:disabled) {
		border-color: rgba(16, 185, 129, 0.5);
		background: rgba(30, 41, 59, 0.8);
	}

	.option-btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.option-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.option-btn.spend {
		border-color: rgba(245, 158, 11, 0.3);
	}

	.option-btn.spend:hover:not(:disabled) {
		border-color: rgba(245, 158, 11, 0.6);
	}

	.option-btn.earn {
		border-color: rgba(16, 185, 129, 0.3);
	}

	.option-btn.earn:hover:not(:disabled) {
		border-color: rgba(16, 185, 129, 0.6);
	}

	.option-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.option-icon {
		font-size: 28px;
	}

	.option-title {
		font-size: 20px;
		font-weight: 700;
		color: #f8fafc;
	}

	.option-details {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		font-size: 15px;
		color: #94a3b8;
	}

	.highlight-green {
		color: #10b981;
		font-weight: 600;
	}

	.highlight-orange {
		color: #f59e0b;
		font-weight: 600;
	}

	.highlight-white {
		color: #f8fafc;
		font-weight: 600;
	}

	/* Processing Overlay */
	.processing-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background: rgba(15, 23, 42, 0.9);
		z-index: 100;
	}

	.processing-overlay p {
		color: #94a3b8;
		font-size: 16px;
	}

	/* Result Container */
	.result-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		text-align: center;
		padding: 32px;
	}

	.result-icon {
		font-size: 72px;
		animation: scaleIn 0.3s ease;
	}

	@keyframes scaleIn {
		from { transform: scale(0.5); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	}

	.result-container h2 {
		font-size: 24px;
		font-weight: 700;
		margin: 0;
		color: #f8fafc;
	}

	.result-message {
		font-size: 16px;
		color: #94a3b8;
		margin: 0;
		white-space: pre-line;
		line-height: 1.6;
	}

	.new-balance {
		padding: 16px 24px;
		background: rgba(16, 185, 129, 0.15);
		border-radius: 12px;
		color: #10b981;
		font-size: 16px;
	}

	.new-balance strong {
		font-size: 20px;
	}

	.new-transaction-btn {
		margin-top: 16px;
		padding: 16px 32px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		border: none;
		border-radius: 12px;
		color: white;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.new-transaction-btn:hover {
		transform: scale(1.02);
		box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
	}

	.new-transaction-btn:active {
		transform: scale(0.98);
	}

	/* Mobile Responsive */
	@media (max-width: 768px) {
		.amount-input {
			font-size: 24px;
			text-align: center;
		}

		.currency {
			font-size: 20px;
		}

		.option-btn {
			padding: 16px;
		}

		.option-detail {
			font-size: 13px;
		}

		.result-amount {
			font-size: 18px;
		}

		.customer-name {
			font-size: 20px;
		}

		.customer-balance .balance-value {
			font-size: 22px;
		}
	}
</style>
