<script lang="ts">
	interface Props {
		checkAmount: number;
		cashbackPercent: number;
		cashbackAmount: number;
		finalAmount: number;
	}

	let { checkAmount, cashbackPercent, cashbackAmount, finalAmount }: Props = $props();
</script>

<div class="card">
	<div class="info-row">
		<span class="info-label">Сумма чека</span>
		<span class="info-value">{checkAmount.toFixed(2)} ₽</span>
	</div>
	<div class="info-row">
		<span class="info-label">Кэшбэк {cashbackPercent}%</span>
		<span class="info-value accent">+{cashbackAmount} ₽</span>
	</div>
	<div class="divider"></div>
	<div class="info-row">
		<span class="info-label">К оплате</span>
		<span class="info-value" style="font-size: 24px;">{finalAmount.toFixed(2)} ₽</span>
	</div>
</div>
