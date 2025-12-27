<script lang="ts">
	import type { Slide } from './types';
	import SetCard from './SetCard.svelte';

	let { slide }: { slide: Slide } = $props();
</script>

<div class="slide-sets">
	<div class="sets-grid">
		{#each slide.items as product (product.id)}
			<SetCard {product} />
		{/each}
	</div>
</div>

<style>
	.slide-sets {
		width: 100%;
		height: 100%;
		padding: 20px;
		display: flex;
		flex-direction: column;
	}

	.sets-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 24px;
		flex: 1;
	}

	/* Для 1-2 сета центрируем */
	.sets-grid:has(:nth-child(1):last-child) {
		grid-template-columns: 1fr;
		max-width: 500px;
		margin: 0 auto;
	}

	.sets-grid:has(:nth-child(2):last-child) {
		grid-template-columns: repeat(2, 1fr);
		max-width: 900px;
		margin: 0 auto;
	}
</style>
