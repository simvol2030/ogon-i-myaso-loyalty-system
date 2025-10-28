<script lang="ts">
	import type { Customer } from '$lib/data/cashier-mocks';

	interface Props {
		customer: Customer;
	}

	let { customer }: Props = $props();
</script>

<div class="card compact">
	<div class="info-row compact">
		<span class="info-label compact">Клиент</span>
		<span class="info-value compact">{customer.name || 'Без имени'}</span>
	</div>
	<div class="info-row compact">
		<span class="info-label compact">Номер карты</span>
		<span class="info-value compact" style="font-family: monospace;">{customer.cardNumber}</span>
	</div>
	<div class="info-row compact">
		<span class="info-label compact">Баланс баллов</span>
		<span class="info-value accent compact">{customer.balance.toFixed(0)} ₽</span>
	</div>
</div>

<style>
	:global(.card.compact) {
		padding: 16px;
		margin-bottom: 0;
	}

	:global(.info-row.compact) {
		padding: 8px 0;
	}

	:global(.info-label.compact) {
		font-size: 14px;
		color: var(--text-secondary);
		font-weight: 500;
	}

	:global(.info-value.compact) {
		font-size: 18px;
		color: #ffffff !important;
		font-weight: 600;
	}

	:global(.info-value.accent.compact) {
		color: var(--accent-light) !important;
	}
</style>
