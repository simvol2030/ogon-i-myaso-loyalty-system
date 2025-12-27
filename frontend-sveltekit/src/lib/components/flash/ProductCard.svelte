<script lang="ts">
	import type { ProductItem } from './types';

	let { product, size = 'normal' }: { product: ProductItem; size?: 'normal' | 'small' } = $props();

	// Формат цены
	const formatPrice = (price: number) => price.toLocaleString('ru-RU');

	// Placeholder для отсутствующих изображений
	const placeholderImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%232A2A2A" width="200" height="200"/%3E%3Ctext fill="%23666" font-family="Arial" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EНет фото%3C/text%3E%3C/svg%3E';

	// Обработка ошибки загрузки изображения
	function handleImageError(e: Event) {
		const img = e.target as HTMLImageElement;
		img.src = placeholderImage;
	}
</script>

<div class="product-card" class:small={size === 'small'}>
	<div class="product-image-wrapper">
		<img
			src={product.image || placeholderImage}
			alt={product.name}
			class="product-image"
			onerror={handleImageError}
		/>
	</div>

	<div class="product-info">
		<h3 class="product-name">{product.name}</h3>
		{#if product.quantityInfo}
			<span class="quantity-info">{product.quantityInfo}</span>
		{/if}
		<div class="price-row">
			{#if product.oldPrice && product.oldPrice > product.price}
				<span class="old-price">{formatPrice(product.oldPrice)}</span>
			{/if}
			<span class="price">{formatPrice(product.price)} ₽</span>
		</div>
	</div>
</div>

<style>
	.product-card {
		background: var(--bg-card, #2A2A2A);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.product-card.small {
		border-radius: 8px;
	}

	.product-image-wrapper {
		position: relative;
		width: 100%;
		padding-top: 100%; /* 1:1 aspect ratio */
		background: var(--bg-primary, #1E1E1E);
		overflow: hidden;
	}

	.product-image {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.product-info {
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
	}

	.small .product-info {
		padding: 8px;
	}

	.product-name {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #FFFFFF);
		margin: 0;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.small .product-name {
		font-size: 14px;
	}

	.quantity-info {
		font-size: 12px;
		color: var(--text-secondary, #8E8E93);
	}

	.small .quantity-info {
		font-size: 10px;
	}

	.price-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-top: auto;
	}

	.old-price {
		font-size: 14px;
		color: var(--text-secondary, #8E8E93);
		text-decoration: line-through;
	}

	.small .old-price {
		font-size: 12px;
	}

	.price {
		font-size: 20px;
		font-weight: 700;
		color: var(--price, #4CAF50);
	}

	.small .price {
		font-size: 16px;
	}
</style>
