<script lang="ts">
	let { total, current }: { total: number; current: number } = $props();
</script>

<div class="slide-indicator">
	{#each Array(total) as _, i}
		<div class="dot" class:active={i === current}></div>
	{/each}
</div>

<style>
	.slide-indicator {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.3);
		transition: all 0.3s ease;
	}

	.dot.active {
		background: var(--accent, #64B5F6);
		transform: scale(1.2);
	}
</style>
