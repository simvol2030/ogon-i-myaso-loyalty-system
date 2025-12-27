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
		grid-template-rows: repeat(2, 1fr); /* 2 ряда вместо 3 */
		gap: 1rem;
		flex: 1;
		align-content: center;
	}

	/* Для больших экранов TV - ограничиваем ширину колонок */
	@media (min-width: 1400px) {
		.products-grid {
			grid-template-columns: repeat(6, 1fr);
		}
	}

	/* Для очень больших экранов - больше колонок */
	@media (min-width: 1920px) {
		.products-grid {
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 1.25rem;
		}
	}
</style>
