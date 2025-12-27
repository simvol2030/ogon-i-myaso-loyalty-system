<script lang="ts">
	import type { Slide } from './types';
	import ProductCard from './ProductCard.svelte';

	let { slide }: { slide: Slide } = $props();
</script>

<div class="slide-products">
	<div class="products-grid">
		{#each slide.items as product (product.id)}
			<ProductCard {product} />
		{/each}
	</div>
</div>

<style>
	.slide-products {
		width: 100%;
		height: 100%;
		padding: 20px;
		display: flex;
		flex-direction: column;
	}

	.products-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		grid-template-rows: repeat(3, 1fr);
		gap: 16px;
		flex: 1;
	}

	/* Для неполных слайдов - центрирование */
	@media (max-width: 1600px) {
		.products-grid {
			gap: 12px;
		}
	}
</style>
