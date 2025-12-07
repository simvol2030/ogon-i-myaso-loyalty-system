<!--
  Seller Main Page
  - QR-сканер для поиска клиента
  - Ручной ввод номера карты
  - Последние транзакции
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import PWAInstallButton from '$lib/components/seller/PWAInstallButton.svelte';

	// QR Scanner
	let Html5Qrcode: any = $state(null);
	let scanner: any = $state(null);
	let scannerContainer: HTMLElement;
	let isScannerActive = $state(false);
	let scannerError = $state('');

	// Manual input
	let cardNumber = $state('');
	let showManualInput = $state(false);

	// Customer search
	let isSearching = $state(false);
	let searchError = $state('');

	// Recent transactions
	let recentTransactions: any[] = $state([]);
	let isLoadingRecent = $state(true);

	onMount(async () => {
		// Проверка авторизации
		const token = localStorage.getItem('seller_token');
		if (!token) {
			goto('/seller/login');
			return;
		}

		// Загружаем html5-qrcode динамически (только на клиенте)
		if (browser) {
			try {
				const module = await import('html5-qrcode');
				Html5Qrcode = module.Html5Qrcode;
			} catch (err) {
				console.error('Failed to load QR scanner:', err);
				scannerError = 'Не удалось загрузить сканер';
			}
		}

		// Загружаем последние транзакции
		await loadRecentTransactions();
	});

	onDestroy(() => {
		stopScanner();
	});

	async function loadRecentTransactions() {
		isLoadingRecent = true;
		try {
			const token = localStorage.getItem('seller_token');
			// Используем seller-specific endpoint вместо store-based
			const response = await fetch('/api/seller/transactions?limit=5', {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				recentTransactions = data.transactions || [];
			}
		} catch (err) {
			console.error('Failed to load recent transactions:', err);
		} finally {
			isLoadingRecent = false;
		}
	}

	async function startScanner() {
		if (!Html5Qrcode) {
			scannerError = 'Сканер не загружен';
			return;
		}

		scannerError = '';

		try {
			scanner = new Html5Qrcode('qr-reader');

			await scanner.start(
				{ facingMode: 'environment' },
				{
					fps: 10,
					qrbox: { width: 250, height: 250 },
					aspectRatio: 1.0
				},
				onScanSuccess,
				onScanFailure
			);

			isScannerActive = true;
		} catch (err: any) {
			console.error('Scanner start error:', err);
			if (err.message?.includes('Permission')) {
				scannerError = 'camera_permission';
			} else {
				scannerError = 'camera_failed';
			}
		}
	}

	async function stopScanner() {
		if (scanner && isScannerActive) {
			try {
				await scanner.stop();
			} catch (err) {
				console.error('Scanner stop error:', err);
			}
			isScannerActive = false;
		}
	}

	function onScanSuccess(decodedText: string) {
		// Вибрация при успешном сканировании
		if (navigator.vibrate) {
			navigator.vibrate(100);
		}

		// Парсим QR-код (формат: 99XXXXXX или просто 6 цифр)
		let cardNum = decodedText.trim();

		// Если формат 99XXXXXX - убираем префикс
		if (cardNum.length === 8 && cardNum.startsWith('99')) {
			cardNum = cardNum.substring(2);
		}

		// Проверяем что это 6-значный номер карты
		if (/^\d{6}$/.test(cardNum)) {
			stopScanner();
			searchCustomer(cardNum);
		}
	}

	function onScanFailure(error: string) {
		// Игнорируем ошибки сканирования (нормально при отсутствии QR)
	}

	async function searchCustomer(card: string) {
		isSearching = true;
		searchError = '';

		try {
			const token = localStorage.getItem('seller_token');
			const response = await fetch(`/api/customers/search?card=${card}`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				if (data && data.id) {
					// Переходим на страницу транзакции с данными клиента
					goto(`/seller/transaction?customerId=${data.id}&card=${card}`);
				} else {
					searchError = 'Клиент не найден';
				}
			} else if (response.status === 404) {
				searchError = 'Клиент не найден';
			} else {
				searchError = 'Ошибка поиска';
			}
		} catch (err) {
			console.error('Search error:', err);
			searchError = 'Ошибка соединения';
		} finally {
			isSearching = false;
		}
	}

	function handleManualSearch() {
		const card = cardNumber.trim();
		if (card.length === 6 && /^\d{6}$/.test(card)) {
			searchCustomer(card);
		} else {
			searchError = 'Введите 6 цифр номера карты';
		}
	}

	function toggleManualInput() {
		showManualInput = !showManualInput;
		if (showManualInput) {
			stopScanner();
		}
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
	}

	function formatAmount(amount: number, type: string): string {
		const sign = type === 'earn' ? '+' : '-';
		return `${sign}${Math.abs(amount).toFixed(0)}`;
	}
</script>

<div class="seller-main">
	<!-- Scanner Section -->
	<section class="scanner-section">
		{#if !showManualInput}
			<div class="scanner-wrapper">
				<div id="qr-reader" class="qr-reader"></div>

				{#if !isScannerActive}
					<div class="scanner-overlay">
						{#if scannerError}
							<div class="scanner-error">
								{#if scannerError === 'camera_permission'}
									<p class="error-title">❌ Нет доступа к камере</p>
									<p class="error-hint">💡 Установите приложение для работы камеры</p>
								{:else if scannerError === 'camera_failed'}
									<p class="error-title">❌ Не удалось запустить камеру</p>
									<p class="error-hint">💡 Установите приложение или используйте ввод вручную</p>
								{:else}
									<p class="error-title">{scannerError}</p>
								{/if}
							</div>
						{/if}
						<button class="start-scanner-btn" onclick={startScanner} disabled={isSearching}>
							<span class="camera-icon">📷</span>
							<span>Сканировать QR</span>
						</button>
					</div>
				{:else}
					<div class="scanner-hint">
						Наведите камеру на QR-код клиента
					</div>
				{/if}
			</div>

			{#if isScannerActive}
				<button class="stop-scanner-btn" onclick={stopScanner}>
					Остановить камеру
				</button>
			{/if}
		{:else}
			<!-- Manual Input -->
			<div class="manual-input-section">
				<h3>Введите номер карты</h3>
				<div class="input-group">
					<input
						type="text"
						inputmode="numeric"
						pattern="[0-9]*"
						maxlength="6"
						placeholder="000000"
						bind:value={cardNumber}
						class="card-input"
						onkeydown={(e) => e.key === 'Enter' && handleManualSearch()}
					/>
					<button
						class="search-btn"
						onclick={handleManualSearch}
						disabled={isSearching || cardNumber.length !== 6}
					>
						{isSearching ? '...' : '→'}
					</button>
				</div>
			</div>
		{/if}

		<!-- Toggle Button -->
		<button class="toggle-input-btn" onclick={toggleManualInput}>
			{showManualInput ? '📷 Сканировать QR' : '🔢 Ввести вручную'}
		</button>

		<!-- Search Error -->
		{#if searchError}
			<div class="search-error">
				{searchError}
			</div>
		{/if}

		<!-- Loading -->
		{#if isSearching}
			<div class="searching-indicator">
				<div class="spinner-small"></div>
				<span>Поиск клиента...</span>
			</div>
		{/if}
	</section>

	<!-- Recent Transactions -->
	<section class="recent-section">
		<h3>Последние операции</h3>

		{#if isLoadingRecent}
			<div class="loading-recent">
				<div class="spinner-small"></div>
			</div>
		{:else if recentTransactions.length === 0}
			<p class="no-transactions">Нет операций</p>
		{:else}
			<div class="transactions-list">
				{#each recentTransactions as tx}
					<div class="transaction-item">
						<div class="tx-time">{formatTime(tx.created_at)}</div>
						<div class="tx-customer">{tx.customer_name || 'Клиент'}</div>
						<div class="tx-amount" class:earn={tx.type === 'earn'} class:spend={tx.type === 'spend'}>
							{formatAmount(tx.amount, tx.type)} ₽
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<!-- PWA Install Button (floating) -->
<PWAInstallButton variant="floating" />

<style>
	.seller-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 16px;
		gap: 24px;
	}

	.scanner-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.scanner-wrapper {
		position: relative;
		width: 100%;
		max-width: 300px;
		aspect-ratio: 1;
		background: rgba(30, 41, 59, 0.6);
		border-radius: 20px;
		overflow: hidden;
		border: 2px solid rgba(16, 185, 129, 0.3);
	}

	.qr-reader {
		width: 100%;
		height: 100%;
	}

	:global(#qr-reader video) {
		object-fit: cover;
		border-radius: 18px;
	}

	:global(#qr-reader__scan_region) {
		border-radius: 16px !important;
	}

	.scanner-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background: rgba(15, 23, 42, 0.9);
	}

	.scanner-error {
		text-align: center;
		padding: 12px 16px;
		background: rgba(239, 68, 68, 0.1);
		border-radius: 12px;
		margin-bottom: 16px;
	}

	.error-title {
		color: #ef4444;
		font-size: 15px;
		font-weight: 600;
		margin: 0 0 8px 0;
	}

	.error-hint {
		color: #f59e0b;
		font-size: 13px;
		margin: 0;
		line-height: 1.4;
	}

	.start-scanner-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 24px 32px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		border: none;
		border-radius: 16px;
		color: white;
		font-size: 18px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.start-scanner-btn:hover:not(:disabled) {
		transform: scale(1.02);
		box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
	}

	.start-scanner-btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.start-scanner-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.camera-icon {
		font-size: 48px;
	}

	.scanner-hint {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 12px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		text-align: center;
		font-size: 14px;
	}

	.stop-scanner-btn {
		padding: 12px 24px;
		background: rgba(239, 68, 68, 0.2);
		border: 1px solid rgba(239, 68, 68, 0.5);
		border-radius: 12px;
		color: #ef4444;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.stop-scanner-btn:hover {
		background: rgba(239, 68, 68, 0.3);
	}

	.manual-input-section {
		width: 100%;
		max-width: 300px;
		text-align: center;
	}

	.manual-input-section h3 {
		font-size: 18px;
		font-weight: 600;
		margin: 0 0 16px 0;
		color: #f8fafc;
	}

	.input-group {
		display: flex;
		gap: 12px;
	}

	.card-input {
		flex: 1;
		padding: 16px;
		font-size: 24px;
		text-align: center;
		letter-spacing: 8px;
		background: rgba(30, 41, 59, 0.8);
		border: 2px solid rgba(148, 163, 184, 0.2);
		border-radius: 12px;
		color: #f8fafc;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.card-input:focus {
		border-color: #10b981;
	}

	.card-input::placeholder {
		color: #64748b;
		letter-spacing: 8px;
	}

	.search-btn {
		width: 56px;
		height: 56px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		border: none;
		border-radius: 12px;
		color: white;
		font-size: 24px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.search-btn:hover:not(:disabled) {
		transform: scale(1.05);
	}

	.search-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-input-btn {
		padding: 12px 24px;
		background: rgba(51, 65, 85, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 12px;
		color: #94a3b8;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.toggle-input-btn:hover {
		background: rgba(71, 85, 105, 0.6);
		color: #f8fafc;
	}

	.search-error {
		padding: 12px 20px;
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 12px;
		color: #ef4444;
		font-size: 14px;
		text-align: center;
		animation: fadeIn 0.2s ease;
	}

	.searching-indicator {
		display: flex;
		align-items: center;
		gap: 12px;
		color: #94a3b8;
		font-size: 14px;
	}

	.spinner-small {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(16, 185, 129, 0.2);
		border-top-color: #10b981;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Recent Transactions */
	.recent-section {
		background: rgba(30, 41, 59, 0.4);
		border-radius: 16px;
		padding: 16px;
		border: 1px solid rgba(148, 163, 184, 0.1);
	}

	.recent-section h3 {
		font-size: 16px;
		font-weight: 600;
		margin: 0 0 12px 0;
		color: #94a3b8;
	}

	.loading-recent {
		display: flex;
		justify-content: center;
		padding: 20px;
	}

	.no-transactions {
		color: #64748b;
		font-size: 14px;
		text-align: center;
		margin: 0;
		padding: 20px;
	}

	.transactions-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.transaction-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: rgba(51, 65, 85, 0.4);
		border-radius: 10px;
	}

	.tx-time {
		font-size: 13px;
		color: #64748b;
		min-width: 48px;
	}

	.tx-customer {
		flex: 1;
		font-size: 14px;
		color: #f8fafc;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tx-amount {
		font-size: 14px;
		font-weight: 600;
	}

	.tx-amount.earn {
		color: #10b981;
	}

	.tx-amount.spend {
		color: #f59e0b;
	}
</style>
