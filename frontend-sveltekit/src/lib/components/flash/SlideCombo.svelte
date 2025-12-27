<script lang="ts">
	import type { Slide } from './types';
	import SetCard from './SetCard.svelte';
	import ProductCard from './ProductCard.svelte';

	let { slide }: { slide: Slide } = $props();
</script>

<div class="slide-combo">
	<div class="combo-left">
		{#if slide.setItem}
			<SetCard product={slide.setItem} />
		{/if}
	</div>

	<div class="combo-right">
		<div class="products-grid">
			{#each slide.items as product (product.id)}
				<ProductCard {product} size="small" />
			{/each}
		</div>
	</div>
</div>

<style>
	.slide-combo {
		width: 100%;
		height: 100%;
		padding: 20px;
		display: grid;
		grid-template-columns: 1fr 1.5fr;
		gap: 24px;
	}

	.combo-left {
		display: flex;
		flex-direction: column;
	}

	.combo-right {
		display: flex;
		flex-direction: column;
	}

	.products-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		gap: 12px;
		flex: 1;
	}
</style>
