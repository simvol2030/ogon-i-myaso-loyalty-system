<script lang="ts">
	import type { ProductItem } from './types';

	let { product }: { product: ProductItem } = $props();

	// Формат цены
	const formatPrice = (price: number) => price.toLocaleString('ru-RU');

	// Placeholder для отсутствующих изображений
	const placeholderImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"%3E%3Crect fill="%232A2A2A" width="400" height="225"/%3E%3Ctext fill="%23666" font-family="Arial" font-size="16" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EНет фото%3C/text%3E%3C/svg%3E';

	// Обработка ошибки загрузки изображения
	function handleImageError(e: Event) {
		const img = e.target as HTMLImageElement;
		img.src = placeholderImage;
	}
</script>

<div class="set-card">
	<div class="set-image-wrapper">
		<img
			src={product.image || placeholderImage}
			alt={product.name}
			class="set-image"
			onerror={handleImageError}
		/>
	</div>

	<div class="set-info">
		<h3 class="set-name">{product.name}</h3>

		{#if product.description}
			<div class="set-description">
				{product.description}
			</div>
		{/if}

		<div class="price-row">
			{#if product.oldPrice && product.oldPrice > product.price}
				<span class="old-price">{formatPrice(product.oldPrice)} ₽</span>
			{/if}
			<span class="price">{formatPrice(product.price)} ₽</span>
		</div>
	</div>
</div>

<style>
	.set-card {
		background: var(--bg-card, #2A2A2A);
		border-radius: 16px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.set-image-wrapper {
		position: relative;
		width: 100%;
		padding-top: 56.25%; /* 16:9 aspect ratio */
		background: var(--bg-primary, #1E1E1E);
		overflow: hidden;
	}

	.set-image {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.set-info {
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		flex: 1;
		text-align: center;
	}

	.set-name {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-primary, #FFFFFF);
		margin: 0;
		line-height: 1.2;
	}

	.set-description {
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-secondary, #8E8E93);
		flex: 1;
		display: -webkit-box;
		-webkit-line-clamp: 6;
		-webkit-box-orient: vertical;
		overflow: hidden;
		white-space: pre-line;
	}

	.price-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-top: auto;
		padding-top: 12px;
	}

	.old-price {
		font-size: 18px;
		color: var(--text-secondary, #8E8E93);
		text-decoration: line-through;
	}

	.price {
		font-size: 32px;
		font-weight: 700;
		color: var(--price, #4CAF50);
	}
</style>
