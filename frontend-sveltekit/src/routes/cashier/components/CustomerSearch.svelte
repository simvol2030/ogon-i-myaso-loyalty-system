<script lang="ts">
	import { QUICK_TESTS } from '$lib/data/cashier-mocks';
	import VirtualKeyboard from './VirtualKeyboard.svelte';

	interface Props {
		value: string;
		isSearching: boolean;
		errorMessage: string;
		onSearch: () => void;
		onInput: (value: string) => void;
	}

	let { value = $bindable(''), isSearching, errorMessage, onSearch, onInput }: Props = $props();

	let inputRef: HTMLInputElement;
	let autoSearchTimer: number | null = null;
	let isKeyboardOpen = $state(false);

	export function focus() {
		inputRef?.focus();
	}

	function handleInput(e: Event) {
		const newValue = (e.currentTarget as HTMLInputElement).value;
		onInput(newValue);

		// Сбросить предыдущий таймер
		if (autoSearchTimer) {
			clearTimeout(autoSearchTimer);
			autoSearchTimer = null;
		}

		// Если введено ровно 6 цифр → автопоиск через 1 сек
		if (newValue.length === 6 && /^\d{6}$/.test(newValue)) {
			autoSearchTimer = setTimeout(() => {
				onSearch();
			}, 1000) as unknown as number;
		}
	}

	function openVirtualKeyboard() {
		isKeyboardOpen = true;
	}

	function closeVirtualKeyboard() {
		isKeyboardOpen = false;
	}

	function handleKeyboardInput(newValue: string) {
		onInput(newValue);

		// Сбросить предыдущий таймер
		if (autoSearchTimer) {
			clearTimeout(autoSearchTimer);
			autoSearchTimer = null;
		}

		// Если введено ровно 6 цифр → автопоиск через 1 сек
		if (newValue.length === 6 && /^\d{6}$/.test(newValue)) {
			autoSearchTimer = setTimeout(() => {
				onSearch();
				closeVirtualKeyboard();
			}, 1000) as unknown as number;
		}
	}
</script>

<div class="card">
	<h2 class="mb-3 text-center">Сканируйте карту или введите номер</h2>
	<input
		bind:this={inputRef}
		bind:value
		class="input mb-2"
		type="text"
		inputmode="numeric"
		pattern="[0-9]*"
		placeholder="6-значный номер карты (например: 421856)"
		onkeydown={(e) => e.key === 'Enter' && onSearch()}
		oninput={handleInput}
		disabled={isSearching}
	/>

	<div class="button-group">
		<button
			class="btn btn-primary"
			onclick={onSearch}
			disabled={!value || isSearching}
		>
			{isSearching ? 'Поиск...' : 'Найти клиента'}
		</button>

		<button
			class="btn btn-secondary"
			onclick={openVirtualKeyboard}
			disabled={isSearching}
		>
			🔢 Клавиатура
		</button>
	</div>
	{#if errorMessage}
		<p class="text-center mt-2" style="color: var(--danger);">{errorMessage}</p>
	{/if}
</div>

<div class="card">
	<p class="text-center" style="color: var(--text-secondary); font-size: 14px;">
		Для теста используйте:
	</p>
	<div class="test-buttons">
		<button class="test-btn" onclick={() => { value = QUICK_TESTS.high; onSearch(); }}>
			{QUICK_TESTS.high}
		</button>
		<button class="test-btn" onclick={() => { value = QUICK_TESTS.medium; onSearch(); }}>
			{QUICK_TESTS.medium}
		</button>
		<button class="test-btn" onclick={() => { value = QUICK_TESTS.low; onSearch(); }}>
			{QUICK_TESTS.low}
		</button>
	</div>
</div>

<VirtualKeyboard
	{value}
	onInput={handleKeyboardInput}
	isOpen={isKeyboardOpen}
	onClose={closeVirtualKeyboard}
/>

<style>
	/* Переопределяем цвет текста input для видимости */
	:global(.input) {
		color: #ffffff !important;
	}

	:global(.input::placeholder) {
		color: var(--text-secondary) !important;
		opacity: 0.6;
	}

	.button-group {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 8px;
	}

	.test-buttons {
		display: flex;
		gap: 8px;
		margin-top: 12px;
		justify-content: center;
	}

	.test-btn {
		padding: 8px 16px;
		background: var(--bg-primary);
		color: var(--accent-light);
		border: 1px solid var(--border);
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		font-family: monospace;
		transition: all 0.2s;
	}

	.test-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--accent);
		transform: translateY(-2px);
	}
</style>
