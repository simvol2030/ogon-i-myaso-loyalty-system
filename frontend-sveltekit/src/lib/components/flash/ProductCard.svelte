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
		{#if product.categoryName}
			<span class="category-label">{product.categoryName}</span>
		{/if}
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
		max-width: 220px; /* Ограничиваем ширину чтобы не растягивалась */
		width: 100%;
	}

	.product-card.small {
		border-radius: 8px;
	}

	.product-image-wrapper {
		position: relative;
		width: 100%;
		padding-top: 65%;
		background: var(--bg-primary, #1E1E1E);
		overflow: hidden;
		flex-shrink: 0;
	}

	/* Лейбл категории поверх фото */
	.category-label {
		position: absolute;
		top: 6px;
		left: 6px;
		z-index: 2;
		background: rgba(0, 0, 0, 0.65);
		color: #fff;
		font-size: 10px;
		font-weight: 600;
		padding: 3px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
		max-width: calc(100% - 12px);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.small .category-label {
		font-size: 8px;
		padding: 2px 4px;
		top: 4px;
		left: 4px;
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
		padding: 6px 8px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.small .product-info {
		padding: 4px 6px;
	}

	.product-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary, #FFFFFF);
		margin: 0;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.small .product-name {
		font-size: 11px;
	}

	.quantity-info {
		font-size: 10px;
		color: var(--text-secondary, #8E8E93);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.small .quantity-info {
		font-size: 9px;
	}

	.price-row {
		display: flex;
		align-items: baseline;
		gap: 4px;
		margin-top: auto;
	}

	.old-price {
		font-size: 11px;
		color: var(--text-secondary, #8E8E93);
		text-decoration: line-through;
	}

	.small .old-price {
		font-size: 10px;
	}

	.price {
		font-size: 15px;
		font-weight: 700;
		color: var(--price, #4CAF50);
	}

	.small .price {
		font-size: 13px;
	}
</style>
