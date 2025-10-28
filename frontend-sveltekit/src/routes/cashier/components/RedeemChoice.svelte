<script lang="ts">
	interface Props {
		maxRedeemPoints: number;
		currentBalance: number;
		cashbackAmount: number;
		isRedeemSelected: boolean;
		onRedeemSelect: () => void;
		onAccumulateSelect: () => void;
	}

	let {
		maxRedeemPoints,
		currentBalance,
		cashbackAmount,
		isRedeemSelected,
		onRedeemSelect,
		onAccumulateSelect
	}: Props = $props();

	// Расчёт нового баланса для каждого варианта
	let newBalanceIfRedeem = $derived(currentBalance - maxRedeemPoints + cashbackAmount);
	let newBalanceIfAccumulate = $derived(currentBalance + cashbackAmount);
</script>

<div class="card">
	<p class="text-center mb-2" style="font-size: 16px; font-weight: 600; color: var(--text-primary);">
		Можно списать: {maxRedeemPoints} ₽
	</p>

	<div class="choice-buttons">
		<!-- Кнопка "Списать" -->
		<button
			class="choice-btn"
			class:selected={isRedeemSelected}
			onclick={onRedeemSelect}
		>
			<div class="choice-title">💳 СПИСАТЬ</div>
			<div class="choice-details">
				<div class="choice-detail">Списание: <strong>-{maxRedeemPoints} ₽</strong></div>
				<div class="choice-detail">Начисление: <strong class="accent">+{cashbackAmount} ₽</strong></div>
				<div class="choice-detail">Новый баланс: <strong>{newBalanceIfRedeem.toFixed(0)} ₽</strong></div>
			</div>
		</button>

		<!-- Кнопка "Накапливать" -->
		<button
			class="choice-btn"
			class:selected={!isRedeemSelected}
			onclick={onAccumulateSelect}
		>
			<div class="choice-title">💰 НАЧИСЛИТЬ</div>
			<div class="choice-details">
				<div class="choice-detail">Списание: <strong>0 ₽</strong></div>
				<div class="choice-detail">Начисление: <strong class="accent">+{cashbackAmount} ₽</strong></div>
				<div class="choice-detail">Новый баланс: <strong>{newBalanceIfAccumulate.toFixed(0)} ₽</strong></div>
			</div>
		</button>
	</div>
</div>

<style>
	.choice-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-top: 12px;
	}

	.choice-btn {
		background: linear-gradient(135deg, var(--bg-secondary) 0%, #1a2332 100%);
		border: 2px solid var(--border);
		border-radius: 12px;
		padding: 16px;
		cursor: pointer;
		transition: all 0.3s ease;
		text-align: left;
	}

	.choice-btn:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
	}

	.choice-btn.selected {
		border-color: var(--accent);
		background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
		color: white;
		box-shadow: 0 0 24px var(--glow-accent);
	}

	.choice-title {
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 12px;
		text-align: center;
	}

	.choice-details {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
	}

	.choice-detail {
		display: flex;
		justify-content: space-between;
		color: var(--text-secondary);
	}

	.choice-btn.selected .choice-detail {
		color: rgba(255, 255, 255, 0.9);
	}

	.choice-detail strong {
		color: var(--text-primary);
	}

	.choice-btn.selected .choice-detail strong {
		color: white;
	}

	.choice-detail strong.accent {
		color: var(--accent-light);
	}

	.choice-btn.selected .choice-detail strong.accent {
		color: #ffffff;
		text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
	}
</style>
