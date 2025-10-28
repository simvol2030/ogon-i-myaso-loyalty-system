<script lang="ts">
	interface Props {
		value: string;
		onInput: (newValue: string) => void;
		isOpen: boolean;
		onClose: () => void;
		type?: 'numbers' | 'decimal'; // numbers = 6 цифр, decimal = сумма с точкой
		onEnter?: () => void; // Callback для кнопки Enter
	}

	let { value, onInput, isOpen, onClose, type = 'numbers', onEnter }: Props = $props();

	// Максимальная длина зависит от типа
	const maxLength = type === 'numbers' ? 6 : 10;

	function handleDigit(digit: string) {
		// Ограничиваем длину
		if (value.length < maxLength) {
			const newValue = value + digit;
			onInput(newValue);
		}
	}

	function handleDecimalPoint() {
		// Добавить точку только если её ещё нет
		if (!value.includes('.') && value.length > 0) {
			const newValue = value + '.';
			onInput(newValue);
		}
	}

	function handleEnter() {
		if (onEnter && value.length > 0) {
			onEnter();
		}
	}

	function handleBackspace() {
		if (value.length > 0) {
			const newValue = value.slice(0, -1);
			onInput(newValue);
		}
	}

	function handleClear() {
		onInput('');
	}

	const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
</script>

{#if isOpen}
	<div class="keyboard-overlay">
		<div class="keyboard-container">
			<div class="keyboard-header">
				<h4>
					{#if type === 'numbers'}
						Введите номер карты (6 цифр)
					{:else}
						Введите сумму чека
					{/if}
				</h4>
				<button class="close-btn" onclick={onClose} aria-label="Закрыть клавиатуру">
					✕
				</button>
			</div>

			<div class="keyboard-display">
				<span class="display-value">
					{#if type === 'numbers'}
						{value || '------'}
					{:else}
						{value || '0.00'} ₽
					{/if}
				</span>
			</div>

			<div class="keyboard-grid" class:decimal-grid={type === 'decimal'}>
				{#each digits as digit}
					<button class="key-btn key-digit" onclick={() => handleDigit(digit)}>
						{digit}
					</button>
				{/each}

				{#if type === 'decimal'}
					<!-- Для decimal: . 0 ⌫ -->
					<button class="key-btn key-decimal" onclick={handleDecimalPoint}>
						.
					</button>
				{/if}

				<button class="key-btn key-backspace" onclick={handleBackspace}>
					⌫
				</button>

				<button class="key-btn key-clear" onclick={handleClear}>
					C
				</button>

				{#if type === 'decimal' && onEnter}
					<!-- Кнопка Enter на 3 колонки -->
					<button class="key-btn key-enter" onclick={handleEnter}>
						✓ Готово
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.keyboard-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.keyboard-container {
		background: linear-gradient(135deg, var(--bg-secondary) 0%, #1a2332 100%);
		border-radius: 20px;
		padding: 24px;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
		border: 2px solid var(--border);
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from {
			transform: translateY(50px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.keyboard-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.keyboard-header h4 {
		margin: 0;
		font-size: 16px;
		color: var(--text-primary);
		font-weight: 600;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		font-size: 24px;
		cursor: pointer;
		padding: 4px 8px;
		line-height: 1;
		transition: all 0.2s;
		border-radius: 4px;
	}

	.close-btn:hover {
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.keyboard-display {
		background: var(--bg-primary);
		border: 2px solid var(--border);
		border-radius: 12px;
		padding: 16px;
		margin-bottom: 20px;
		text-align: center;
	}

	.display-value {
		font-size: 32px;
		font-weight: 700;
		font-family: monospace;
		color: var(--accent-light);
		letter-spacing: 8px;
		text-shadow: 0 0 10px var(--glow-accent);
	}

	.keyboard-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	.key-btn {
		height: 64px;
		border: 2px solid var(--border);
		border-radius: 12px;
		background: linear-gradient(135deg, var(--bg-secondary) 0%, #1a2332 100%);
		color: var(--text-primary);
		font-size: 24px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.key-btn:hover {
		background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
		border-color: var(--primary);
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
	}

	.key-btn:active {
		transform: translateY(0);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	.key-digit:hover {
		background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
		border-color: var(--accent);
		box-shadow: 0 6px 20px var(--glow-accent);
	}

	.key-backspace {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		border-color: #ef4444;
	}

	.key-backspace:hover {
		background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
		box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
	}

	.key-clear {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		border-color: #f59e0b;
	}

	.key-clear:hover {
		background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
		box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
	}

	.key-decimal {
		background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
		border-color: var(--primary);
	}

	.key-decimal:hover {
		background: linear-gradient(135deg, var(--primary-hover) 0%, #1d4ed8 100%);
		box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
	}

	.key-enter {
		grid-column: span 2;
		background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
		border-color: var(--accent);
		font-size: 20px;
		font-weight: 700;
		box-shadow: 0 4px 16px var(--glow-accent);
	}

	.key-enter:hover {
		background: linear-gradient(135deg, var(--accent-hover) 0%, var(--accent) 100%);
		box-shadow: 0 6px 24px var(--glow-accent), 0 0 32px var(--glow-accent);
		transform: translateY(-2px);
	}
</style>
