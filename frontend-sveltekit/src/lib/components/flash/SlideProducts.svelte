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
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		grid-template-rows: repeat(2, 1fr);
		grid-auto-rows: 0;
		gap: 1rem;
		flex: 1;
		overflow: hidden;
		align-content: start;
		align-items: start; /* Карточки не растягиваются по высоте */
	}

	/* Большие мониторы 1400px+: 8 колонок (синхронизировано с JS capacity=16) */
	@media (min-width: 1400px) {
		.products-grid {
			grid-template-columns: repeat(8, 1fr);
		}
	}

	/* TV 1920px+: 10 колонок (синхронизировано с JS capacity=20) */
	@media (min-width: 1920px) {
		.products-grid {
			grid-template-columns: repeat(10, 1fr);
			gap: 1.25rem;
		}
	}
</style>
