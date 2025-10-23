<script lang="ts">
	import { toastStore } from '$lib/stores/toast.svelte';
	import { getFromStorage, saveToStorage } from '$lib/utils/storage';

	interface PaymentCard {
		id: string;
		cardNumber: string;
		cardNumberLast4: string;
		expiry: string;
		cardName: string;
		cardType: 'visa' | 'mastercard' | 'mir' | 'unknown';
	}

	let cards = $state<PaymentCard[]>(getFromStorage('loyalty_cards', []));
	let showAddForm = $state(false);

	// Form fields
	let cardNumber = $state('');
	let cardExpiry = $state('');
	let cardCvv = $state('');
	let cardName = $state('');

	function getCardIcon(type: PaymentCard['cardType']): string {
		const icons: Record<PaymentCard['cardType'], string> = {
			visa: '💳',
			mastercard: '💳',
			mir: '💳',
			unknown: '💳'
		};
		return icons[type];
	}

	function showForm() {
		resetForm();
		showAddForm = true;
	}

	function hideForm() {
		showAddForm = false;
		resetForm();
	}

	function resetForm() {
		cardNumber = '';
		cardExpiry = '';
		cardCvv = '';
		cardName = '';
	}

	function formatCardNumber(e: Event) {
		const input = e.target as HTMLInputElement;
		let value = input.value.replace(/\s/g, '');
		value = value.replace(/\D/g, '');
		value = value.substring(0, 16);

		const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
		cardNumber = formatted;
	}

	function formatExpiry(e: Event) {
		const input = e.target as HTMLInputElement;
		let value = input.value.replace(/\D/g, '');
		value = value.substring(0, 4);

		if (value.length >= 2) {
			value = value.substring(0, 2) + '/' + value.substring(2);
		}
		cardExpiry = value;
	}

	function detectCardType(number: string): PaymentCard['cardType'] {
		const cleaned = number.replace(/\s/g, '');

		if (cleaned.startsWith('4')) return 'visa';
		if (cleaned.startsWith('5')) return 'mastercard';
		if (cleaned.startsWith('2')) return 'mir';
		return 'unknown';
	}

	function maskCardNumber(number: string): string {
		const cleaned = number.replace(/\s/g, '');
		const last4 = cleaned.slice(-4);
		return `**** **** **** ${last4}`;
	}

	function saveCard() {
		const cleanNumber = cardNumber.replace(/\s/g, '');

		if (cleanNumber.length !== 16) {
			toastStore.show('Введите корректный номер карты', 'error');
			return;
		}

		if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
			toastStore.show('Введите срок действия в формате MM/YY', 'error');
			return;
		}

		if (cardCvv.length !== 3) {
			toastStore.show('Введите корректный CVV', 'error');
			return;
		}

		if (!cardName.trim()) {
			toastStore.show('Введите имя на карте', 'error');
			return;
		}

		const newCard: PaymentCard = {
			id: `card-${Date.now()}`,
			cardNumber: maskCardNumber(cleanNumber),
			cardNumberLast4: cleanNumber.slice(-4),
			expiry: cardExpiry,
			cardName: cardName.trim(),
			cardType: detectCardType(cleanNumber)
		};

		cards = [...cards, newCard];
		saveToStorage('loyalty_cards', cards);
		toastStore.show('Карта добавлена!', 'success');
		hideForm();
	}

	function deleteCard(id: string) {
		cards = cards.filter((c) => c.id !== id);
		saveToStorage('loyalty_cards', cards);
		toastStore.show('Карта удалена', 'success');
	}
</script>

<div class="payment-modal">
	{#if cards.length > 0}
		<div class="payments-list">
			{#each cards as card (card.id)}
				<div class="payment-card">
					<div class="card-icon">{getCardIcon(card.cardType)}</div>
					<div class="card-info">
						<h4>{card.cardNumber}</h4>
						<p class="card-name">{card.cardName}</p>
						<p class="card-expiry">Срок: {card.expiry}</p>
					</div>
					<button class="icon-button" aria-label="Удалить карту" onclick={() => deleteCard(card.id)}>
						🗑️
					</button>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<p>Вы ещё не добавили платёжные карты</p>
		</div>
	{/if}

	{#if !showAddForm}
		<button class="button button-primary add-card-button" onclick={showForm}>
			💳 Добавить карту
		</button>
	{/if}

	{#if showAddForm}
		<div class="add-card-form">
			<h4>Добавить карту</h4>

			<label for="card-number">Номер карты *</label>
			<input
				id="card-number"
				type="text"
				bind:value={cardNumber}
				oninput={formatCardNumber}
				placeholder="0000 0000 0000 0000"
				maxlength="19"
				autocomplete="cc-number"
			/>

			<div class="form-row">
				<div class="form-group">
					<label for="card-expiry">Срок действия *</label>
					<input
						id="card-expiry"
						type="text"
						bind:value={cardExpiry}
						oninput={formatExpiry}
						placeholder="MM/YY"
						maxlength="5"
						autocomplete="cc-exp"
					/>
				</div>
				<div class="form-group">
					<label for="card-cvv">CVV *</label>
					<input
						id="card-cvv"
						type="text"
						bind:value={cardCvv}
						placeholder="123"
						maxlength="3"
						autocomplete="cc-csc"
					/>
				</div>
			</div>

			<label for="card-name">Имя на карте *</label>
			<input
				id="card-name"
				type="text"
				bind:value={cardName}
				placeholder="IVAN IVANOV"
				maxlength="50"
				autocomplete="cc-name"
			/>

			<div class="payment-security-note">
				<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
					<path
						d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
					/>
				</svg>
				<p>Данные карты защищены и не передаются третьим лицам</p>
			</div>

			<div class="form-actions">
				<button class="button button-primary" onclick={saveCard}>Добавить карту</button>
				<button class="button button-secondary" onclick={hideForm}>Отмена</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.payment-modal {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.payments-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		max-height: 400px;
		overflow-y: auto;
		padding: var(--spacing-xs);
	}

	.payment-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--card-bg) 100%);
		border-radius: 12px;
		transition: all 0.3s ease;
		border: 1px solid var(--border-color);
		position: relative;
		overflow: hidden;
	}

	.payment-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
		background: var(--primary-orange);
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.payment-card:hover {
		background: var(--card-hover);
		transform: translateY(-2px);
		box-shadow: var(--shadow);
		border-color: var(--primary-orange);
	}

	.payment-card:hover::before {
		opacity: 1;
	}

	.card-icon {
		font-size: 2rem;
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--primary-orange-light), var(--primary-orange));
		border-radius: 12px;
		transition: transform 0.3s ease;
	}

	.payment-card:hover .card-icon {
		transform: scale(1.1) rotate(5deg);
	}

	.card-info {
		flex: 1;
	}

	.card-info h4 {
		margin: 0 0 var(--spacing-xs) 0;
		font-size: var(--text-base);
		color: var(--text-primary);
		font-family: 'Courier New', monospace;
	}

	.card-info p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.card-name {
		margin-bottom: 4px;
		text-transform: uppercase;
	}

	.icon-button {
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: 1.25rem;
		padding: var(--spacing-xs);
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}

	.icon-button:hover {
		background: var(--bg-primary);
		transform: scale(1.1);
	}

	.empty-state {
		text-align: center;
		padding: var(--spacing-xl) var(--spacing-md);
		color: var(--text-secondary);
	}

	.add-card-button {
		width: 100%;
		margin-top: var(--spacing-sm);
	}

	.add-card-form {
		background: var(--bg-tertiary);
		padding: 20px;
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		animation: slideIn 0.3s ease-out;
		border: 1px solid var(--border-color);
		transition: background-color 0.05s ease, border-color 0.05s ease;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.add-card-form h4 {
		margin: 0;
		color: var(--text-primary);
	}

	.add-card-form label {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin-bottom: calc(var(--spacing-xs) * -1);
	}

	.add-card-form input {
		padding: 12px 16px;
		border: 1px solid var(--border-color);
		border-radius: 12px;
		font-size: 15px;
		background: var(--bg-light);
		color: var(--text-primary);
		transition: all 0.2s ease;
		font-family: 'Courier New', monospace;
	}

	.add-card-form input:focus {
		outline: none;
		border-color: var(--primary-orange);
		background: var(--bg-white);
		box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.1);
		transform: translateY(-1px);
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-sm);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.payment-security-note {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 16px;
		background: var(--bg-light);
		border-radius: 12px;
		border: 1px solid var(--border-color);
		transition: all 0.2s ease;
	}

	.payment-security-note:hover {
		border-color: var(--secondary-green);
		background: var(--bg-white);
	}

	.payment-security-note svg {
		color: var(--secondary-green);
		flex-shrink: 0;
		margin-top: 2px;
	}

	.payment-security-note p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.form-actions {
		display: flex;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-sm);
	}

	.form-actions .button {
		flex: 1;
	}

	.button {
		padding: 12px 24px;
		border: none;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.button-primary {
		background: var(--primary-orange);
		color: white;
	}

	.button-primary:hover {
		background: var(--primary-orange-dark);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3);
	}

	.button-primary:active {
		transform: scale(0.98);
	}

	.button-secondary {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.button-secondary:hover {
		background: var(--card-hover);
		border-color: var(--primary-orange);
	}

	@media (min-width: 768px) {
		.payments-list {
			max-height: 500px;
		}
	}
</style>
