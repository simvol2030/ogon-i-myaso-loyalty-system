<script lang="ts">
	import VirtualKeyboard from './VirtualKeyboard.svelte';

	interface Props {
		value: string;
		onSubmit: () => void;
		onCancel: () => void;
	}

	let { value = $bindable(''), onSubmit, onCancel }: Props = $props();

	let isValid = $derived(value !== '' && parseFloat(value) > 0);
	let isKeyboardOpen = $state(false);

	function openVirtualKeyboard() {
		isKeyboardOpen = true;
	}

	function closeVirtualKeyboard() {
		isKeyboardOpen = false;
	}

	function handleKeyboardInput(newValue: string) {
		value = newValue;
	}

	function handleKeyboardEnter() {
		if (isValid) {
			closeVirtualKeyboard();
			onSubmit();
		}
	}
</script>

<div class="card">
	<h3 class="mb-2">Сумма чека</h3>
	<input
		bind:value
		class="input mb-2"
		type="number"
		placeholder="Введите сумму чека..."
		step="0.01"
		min="0"
		onkeydown={(e) => e.key === 'Enter' && isValid && onSubmit()}
	/>

	<div class="button-group">
		<button
			class="btn btn-primary"
			onclick={onSubmit}
			disabled={!isValid}
		>
			Продолжить
		</button>

		<button
			class="btn btn-secondary"
			onclick={openVirtualKeyboard}
		>
			🔢 Клавиатура
		</button>
	</div>
</div>

<button class="btn btn-secondary mt-2" onclick={onCancel}>
	Отмена
</button>

<VirtualKeyboard
	value={value}
	onInput={handleKeyboardInput}
	isOpen={isKeyboardOpen}
	onClose={closeVirtualKeyboard}
	type="decimal"
	onEnter={handleKeyboardEnter}
/>

<style>
	.button-group {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 8px;
	}

	/* Переопределяем цвет текста input для видимости */
	:global(.input) {
		color: #ffffff !important;
	}

	:global(.input::placeholder) {
		color: var(--text-secondary) !important;
		opacity: 0.6;
	}
</style>
