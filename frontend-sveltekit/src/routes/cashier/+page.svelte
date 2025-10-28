<script lang="ts">
	import { onMount } from 'svelte';
	import { findCustomer, createTransaction, getRecentTransactions } from '$lib/api/cashier';
	import type { Customer, Transaction } from '$lib/data/cashier-mocks';
	import type { PageData } from './$types';

	import CustomerSearch from './components/CustomerSearch.svelte';
	import CustomerInfo from './components/CustomerInfo.svelte';
	import CheckAmountInput from './components/CheckAmountInput.svelte';
	import CheckSummary from './components/CheckSummary.svelte';
	import RedeemChoice from './components/RedeemChoice.svelte';
	import TransactionButtons from './components/TransactionButtons.svelte';
	import TransactionStatus from './components/TransactionStatus.svelte';
	import RecentTransactions from './components/RecentTransactions.svelte';

	let { data }: { data: PageData } = $props();

	// ===== Состояние UI =====
	type UIState = 'idle' | 'customer_found' | 'ready' | 'processing' | 'success' | 'error';
	let uiState = $state<UIState>('idle');

	// ===== Поиск клиента =====
	let qrInput = $state('');
	let isSearching = $state(false);
	let searchError = $state('');

	// ===== Данные клиента =====
	let customer = $state<Customer | null>(null);

	// ===== Сумма чека =====
	let checkAmountInput = $state('');
	let checkAmount = $state(0);

	// ===== Выбор: списать или накапливать =====
	let isRedeemSelected = $state(true); // По умолчанию "Списать"

	// ===== История транзакций =====
	let recentTransactions = $state<Transaction[]>([]);

	// ===== Ссылка на компонент поиска =====
	let searchComponent: CustomerSearch;

	// ===== Расчетные значения =====
	let cashbackAmount = $derived(() => {
		if (checkAmount === 0) return 0;
		return Math.floor(checkAmount * data.storeConfig.cashbackPercent / 100);
	});

	let maxRedeemPoints = $derived(() => {
		if (!customer || checkAmount === 0) return 0;
		const maxByPercent = Math.floor(checkAmount * data.storeConfig.maxDiscountPercent / 100);
		const maxByBalance = customer.balance;
		return Math.min(maxByPercent, maxByBalance);
	});

	let canRedeem = $derived(() => {
		return customer !== null && customer.balance > 0 && maxRedeemPoints() > 0;
	});

	// Сумма списания зависит от выбора пользователя
	let pointsToRedeem = $derived(() => {
		return isRedeemSelected ? maxRedeemPoints() : 0;
	});

	let finalAmount = $derived(() => {
		return Math.max(0, checkAmount - pointsToRedeem());
	});

	// ===== Загрузка истории при монтировании =====
	onMount(async () => {
		recentTransactions = await getRecentTransactions(data.storeId);
		setTimeout(() => searchComponent?.focus(), 100);
	});

	// ===== Обработчики событий =====
	async function handleSearch() {
		if (!qrInput || isSearching) return;

		isSearching = true;
		searchError = '';

		try {
			const foundCustomer = await findCustomer(qrInput, data.storeId);

			if (foundCustomer) {
				customer = foundCustomer;
				uiState = 'customer_found';
			} else {
				searchError = 'Клиент не найден';
				setTimeout(() => {
					searchError = '';
					qrInput = '';
				}, 2000);
			}
		} catch (error) {
			searchError = 'Ошибка при поиске клиента';
		} finally {
			isSearching = false;
		}
	}

	function handleCheckAmountSubmit() {
		const amount = parseFloat(checkAmountInput);
		if (amount > 0) {
			checkAmount = amount;
			isRedeemSelected = true; // По умолчанию "Списать" при переходе на шаг 3
			uiState = 'ready';
		}
	}

	function handleRedeemSelect() {
		isRedeemSelected = true;
	}

	function handleAccumulateSelect() {
		isRedeemSelected = false;
	}

	async function handleCompleteTransaction() {
		if (!customer) return;

		uiState = 'processing';

		const result = await createTransaction({
			customer,
			storeId: data.storeId,
			checkAmount,
			pointsToRedeem: pointsToRedeem(),
			cashbackAmount: cashbackAmount(),
			finalAmount: finalAmount()
		});

		if (result.success) {
			// Обновляем баланс клиента в локальном состоянии
			customer.balance = customer.balance - pointsToRedeem() + cashbackAmount();

			uiState = 'success';

			// Обновляем историю
			recentTransactions = await getRecentTransactions(data.storeId);

			// Автосброс через 3 секунды
			setTimeout(() => {
				resetTransaction();
			}, 3000);
		} else {
			uiState = 'error';
		}
	}

	function resetTransaction() {
		customer = null;
		checkAmount = 0;
		isRedeemSelected = true; // Сброс на "Списать" по умолчанию
		qrInput = '';
		checkAmountInput = '';
		uiState = 'idle';
		searchError = '';

		setTimeout(() => searchComponent?.focus(), 100);
	}
</script>

<div class="app-container">
	<!-- Header -->
	<div class="header">
		<div class="header-title">
			💳 {data.storeConfig.storeName} • {data.storeConfig.location}
		</div>
	</div>

	<!-- Content -->
	<div class="content">
		<!-- Шаг 1: Поиск клиента -->
		{#if uiState === 'idle'}
			<CustomerSearch
				bind:this={searchComponent}
				bind:value={qrInput}
				{isSearching}
				errorMessage={searchError}
				onSearch={handleSearch}
				onInput={(v) => qrInput = v}
			/>

			<RecentTransactions transactions={recentTransactions} />
		{/if}

		<!-- Шаг 2: Клиент найден, ввод суммы чека -->
		{#if uiState === 'customer_found' && customer}
			<CustomerInfo {customer} />

			<CheckAmountInput
				bind:value={checkAmountInput}
				onSubmit={handleCheckAmountSubmit}
				onCancel={resetTransaction}
			/>
		{/if}

		<!-- Шаг 3: Чек готов, выбор списания баллов -->
		{#if uiState === 'ready' && customer}
			<!-- Две карточки рядом: CustomerInfo + CheckSummary -->
			<div class="grid-2 mb-2">
				<CustomerInfo {customer} />
				<CheckSummary
					{checkAmount}
					cashbackPercent={data.storeConfig.cashbackPercent}
					cashbackAmount={cashbackAmount()}
					finalAmount={finalAmount()}
				/>
			</div>

			<!-- Выбор: списать или накапливать -->
			<RedeemChoice
				maxRedeemPoints={maxRedeemPoints()}
				currentBalance={customer.balance}
				cashbackAmount={cashbackAmount()}
				isRedeemSelected={isRedeemSelected}
				onRedeemSelect={handleRedeemSelect}
				onAccumulateSelect={handleAccumulateSelect}
			/>

			<!-- Кнопки завершения/отмены -->
			<TransactionButtons
				onComplete={handleCompleteTransaction}
				onCancel={resetTransaction}
			/>
		{/if}

		<!-- Шаг 4: Обработка транзакции -->
		{#if uiState === 'processing' && customer}
			<TransactionStatus status="processing" />
		{/if}

		<!-- Шаг 5: Успех -->
		{#if uiState === 'success' && customer}
			<TransactionStatus
				status="success"
				finalAmount={finalAmount()}
				pointsRedeemed={pointsToRedeem()}
				cashbackEarned={cashbackAmount()}
				newBalance={customer.balance}
			/>
		{/if}

		<!-- Шаг 6: Ошибка -->
		{#if uiState === 'error'}
			<TransactionStatus
				status="error"
				errorMessage="Ошибка при создании транзакции"
			/>
			<button class="btn btn-secondary mt-2" onclick={resetTransaction}>
				Попробовать снова
			</button>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background-color: #0f172a;
		color: #f8fafc;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}

	:global(:root) {
		--bg-primary: #0f172a;
		--bg-secondary: #1e293b;
		--bg-header: #334155;
		--text-primary: #f8fafc;
		--text-secondary: #cbd5e1;
		--accent: #10b981;
		--accent-hover: #059669;
		--accent-light: #34d399;
		--primary: #3b82f6;
		--primary-hover: #2563eb;
		--danger: #ef4444;
		--danger-hover: #dc2626;
		--warning: #f59e0b;
		--success: #22c55e;
		--border: #475569;
		--glow-accent: rgba(16, 185, 129, 0.3);
		--glow-primary: rgba(59, 130, 246, 0.3);
	}

	.app-container {
		width: calc(100vw + 230px);
		min-width: 1030px;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.header {
		height: 44px;
		background: linear-gradient(135deg, var(--bg-header) 0%, var(--bg-secondary) 100%);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		border-bottom: 2px solid var(--primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		flex-shrink: 0;
	}

	.header-title {
		font-size: 14px;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--accent-light);
		text-shadow: 0 0 10px var(--glow-accent);
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
	}

	:global(.btn) {
		min-height: 60px;
		padding: 16px 24px;
		border: none;
		border-radius: 12px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		width: 100%;
		color: white;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		position: relative;
		overflow: hidden;
	}

	:global(.btn::before) {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		transform: translate(-50%, -50%);
		transition: width 0.6s, height 0.6s;
	}

	:global(.btn:hover::before) {
		width: 300px;
		height: 300px;
	}

	:global(.btn:active) {
		transform: scale(0.95);
	}

	:global(.btn:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(.btn-primary) {
		background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
		box-shadow: 0 4px 16px var(--glow-accent), 0 0 24px var(--glow-accent);
	}

	:global(.btn-primary:hover:not(:disabled)) {
		background: linear-gradient(135deg, var(--accent-hover) 0%, var(--accent) 100%);
		box-shadow: 0 6px 24px var(--glow-accent), 0 0 32px var(--glow-accent);
		transform: translateY(-2px);
	}

	:global(.btn-secondary) {
		background: linear-gradient(135deg, #64748b 0%, #475569 100%);
	}

	:global(.btn-secondary:hover:not(:disabled)) {
		background: linear-gradient(135deg, #475569 0%, #334155 100%);
	}

	:global(.input) {
		width: 100%;
		height: 60px;
		padding: 0 16px;
		font-size: 18px;
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		border-radius: 12px;
		color: var(--text-primary);
		transition: all 0.2s;
	}

	:global(.input:focus) {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--glow-accent);
	}

	:global(.input::placeholder) {
		color: var(--text-secondary);
	}

	:global(.card) {
		background: linear-gradient(135deg, var(--bg-secondary) 0%, #1a2332 100%);
		border-radius: 16px;
		padding: 20px;
		margin-bottom: 16px;
		border: 1px solid var(--border);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transition: all 0.3s ease;
	}

	:global(.card:hover) {
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
		transform: translateY(-2px);
	}

	:global(.info-row) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid var(--border);
	}

	:global(.info-row:last-child) {
		border-bottom: none;
	}

	:global(.info-label) {
		font-size: 16px;
		color: var(--text-secondary);
	}

	:global(.info-value) {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
	}

	:global(.info-value.accent) {
		color: var(--accent-light);
		text-shadow: 0 0 10px var(--glow-accent);
	}

	:global(.info-value.warning) {
		color: var(--warning);
	}

	:global(.status-badge) {
		display: inline-block;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 600;
		text-transform: uppercase;
	}

	:global(.status-processing) {
		background: rgba(245, 158, 11, 0.2);
		color: var(--warning);
		animation: processingBlink 1.5s ease-in-out infinite;
	}

	@keyframes processingBlink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	:global(.divider) {
		height: 2px;
		background: linear-gradient(90deg, transparent 0%, var(--border) 50%, transparent 100%);
		margin: 20px 0;
	}

	:global(.text-center) {
		text-align: center;
	}

	:global(.mt-2) { margin-top: 16px; }
	:global(.mt-3) { margin-top: 24px; }
	:global(.mb-2) { margin-bottom: 16px; }
	:global(.mb-3) { margin-bottom: 24px; }

	:global(.grid-2) {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	:global(.success-animation) {
		animation: successZoom 0.5s ease-out;
	}

	@keyframes successZoom {
		0% {
			transform: scale(0.8);
			opacity: 0;
		}
		50% {
			transform: scale(1.05);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
