<script lang="ts">
	import { goto } from '$app/navigation';
	import { cart } from '$lib/stores/cart';
	import type { Product } from '$lib/types/loyalty';
	import ProductDetailSheet from '$lib/components/loyalty/ui/ProductDetailSheet.svelte';

	interface CategoryItem {
		id: number;
		name: string;
		slug: string;
		image: string | null;
	}

	interface ProductVariation {
		id: number;
		name: string;
		price: number;
		oldPrice: number | null;
		sku: string | null;
		isDefault: boolean;
	}

	let { data } = $props();

	let searchValue = $state(data.filters.search);
	let selectedCategory = $state(data.filters.category);
	let addingToCart = $state<number | null>(null); // Track which product is being added

	// Track selected variation per product
	let selectedVariations = $state<Record<number, number>>({});

	// Product detail sheet state
	let selectedProduct = $state<Product | null>(null);
	let productSheetOpen = $state(false);

	const openProductDetail = (product: typeof data.products[0]) => {
		// Convert to Product type for the detail sheet
		selectedProduct = {
			id: product.id,
			name: product.name,
			description: product.description || null,
			price: product.price,
			oldPrice: product.old_price || undefined,
			quantityInfo: product.quantity_info || null,
			image: product.image,
			category: product.category,
			variationAttribute: product.variation_attribute || null,
			variations: product.variations?.map(v => ({
				id: v.id,
				name: v.name,
				price: v.price,
				oldPrice: v.oldPrice || undefined,
				sku: v.sku || undefined,
				isDefault: v.isDefault,
				isActive: true
			}))
		};
		productSheetOpen = true;
	};

	const closeProductDetail = () => {
		productSheetOpen = false;
	};

	// Категории с новой структурой (slug/name/image)
	const categoriesNew = data.categories as CategoryItem[];

	function handleSearch() {
		const params = new URLSearchParams();
		if (searchValue) params.set('search', searchValue);
		if (selectedCategory !== 'all') params.set('category', selectedCategory);
		goto(`/products?${params.toString()}`);
	}

	function handleCategoryChange(categorySlug: string) {
		selectedCategory = categorySlug;
		handleSearch();
	}

	function clearFilters() {
		searchValue = '';
		selectedCategory = 'all';
		goto('/products');
	}

	// Получаем название категории по slug для отображения
	function getCategoryName(slug: string): string {
		if (slug === 'all') return 'Все';
		const category = categoriesNew.find(c => c.slug === slug);
		return category?.name || slug;
	}

	// Получить выбранную вариацию для продукта
	function getSelectedVariation(product: typeof data.products[0]): ProductVariation | null {
		if (!product.hasVariations || !product.variations.length) return null;

		const selectedId = selectedVariations[product.id];
		if (selectedId) {
			return product.variations.find(v => v.id === selectedId) || product.variations[0];
		}
		// По умолчанию - дефолтная или первая
		return product.variations.find(v => v.isDefault) || product.variations[0];
	}

	// Получить текущую цену для продукта (с учётом выбранной вариации)
	function getCurrentPrice(product: typeof data.products[0]): number {
		const variation = getSelectedVariation(product);
		return variation ? variation.price : product.price;
	}

	// Получить старую цену для продукта (с учётом выбранной вариации)
	function getCurrentOldPrice(product: typeof data.products[0]): number | null {
		const variation = getSelectedVariation(product);
		return variation ? variation.oldPrice : product.old_price;
	}

	// Обработчик изменения вариации
	function handleVariationChange(e: Event, productId: number) {
		e.stopPropagation();
		const select = e.target as HTMLSelectElement;
		selectedVariations[productId] = parseInt(select.value);
	}

	// Добавление товара в корзину
	async function handleAddToCart(e: Event, productId: number) {
		e.stopPropagation(); // Prevent card click
		if (addingToCart === productId) return; // Prevent double click

		addingToCart = productId;
		try {
			const product = data.products.find(p => p.id === productId);
			const variation = product ? getSelectedVariation(product) : null;

			await cart.addItem(productId, 1, variation?.id);
			// Visual feedback - show briefly that item was added
			setTimeout(() => {
				addingToCart = null;
			}, 500);
		} catch (error) {
			console.error('Failed to add to cart:', error);
			addingToCart = null;
		}
	}
</script>

<svelte:head>
	<title>Меню доставки и самовывоза - Мурзико</title>
</svelte:head>

<div class="products-page">
	<header class="page-header">
		<h1>🛍️ Меню доставки и для самовывоза</h1>
		<p class="subtitle">Изображения блюд представлены в ознакомительных целях и могут отличаться от фактической подачи</p>
	</header>

	<div class="filters-section">
		<div class="search-bar">
			<span class="search-icon">🔍</span>
			<input
				type="text"
				placeholder="Поиск товаров..."
				bind:value={searchValue}
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
				class="search-input"
			/>
			{#if searchValue}
				<button class="clear-search" onclick={() => { searchValue = ''; handleSearch(); }}>✕</button>
			{/if}
		</div>

		<div class="categories-bar">
			<button
				class="category-btn"
				class:active={selectedCategory === 'all'}
				onclick={() => handleCategoryChange('all')}
			>
				Все
			</button>
			{#each categoriesNew as category (category.id)}
				<button
					class="category-btn"
					class:active={selectedCategory === category.slug}
					onclick={() => handleCategoryChange(category.slug)}
				>
					{category.name}
				</button>
			{/each}
		</div>

		{#if searchValue || selectedCategory !== 'all'}
			<button class="reset-filters" onclick={clearFilters}>
				Сбросить фильтры
			</button>
		{/if}
	</div>

	<div class="products-grid">
		{#each data.products as product}
			{@const currentPrice = getCurrentPrice(product)}
			{@const currentOldPrice = getCurrentOldPrice(product)}
			{@const selectedVariation = getSelectedVariation(product)}
			<article class="product-card">
				<div class="product-image-wrapper" onclick={() => openProductDetail(product)} role="button" tabindex="0">
					<img src={product.image} alt={product.name} class="product-image" />
					{#if currentOldPrice && currentOldPrice > currentPrice}
						<span class="discount-badge">
							-{Math.round((1 - currentPrice / currentOldPrice) * 100)}%
						</span>
					{/if}
				</div>

				<div class="product-info">
					<h3 class="product-name" onclick={() => openProductDetail(product)} role="button" tabindex="0">{product.name}</h3>
					<span class="product-category">{product.category}</span>

					{#if product.hasVariations && product.variations.length > 0}
						<div class="variation-selector">
							<select
								class="variation-select"
								value={selectedVariation?.id || ''}
								onchange={(e) => handleVariationChange(e, product.id)}
							>
								{#each product.variations as variation}
									<option value={variation.id}>
										{variation.name} — {variation.price.toLocaleString('ru-RU')} ₽
									</option>
								{/each}
							</select>
						</div>
					{/if}

					<div class="product-footer">
						<div class="product-pricing">
							{#if currentOldPrice && currentOldPrice > currentPrice}
								<span class="old-price">{currentOldPrice.toLocaleString('ru-RU')} ₽</span>
							{/if}
							<span class="price">{currentPrice.toLocaleString('ru-RU')} ₽</span>
						</div>

						<button
							class="add-to-cart-btn"
							class:adding={addingToCart === product.id}
							onclick={(e) => handleAddToCart(e, product.id)}
							aria-label="Добавить в корзину"
						>
							{#if addingToCart === product.id}
								<span class="check-icon">✓</span>
							{:else}
								<span class="cart-plus-icon">🛒</span>
							{/if}
						</button>
					</div>
				</div>
			</article>
		{/each}
	</div>

	{#if data.products.length === 0}
		<div class="empty-state">
			<span class="empty-icon">📦</span>
			<h2>Товары не найдены</h2>
			<p>Попробуйте изменить фильтры</p>
			<button class="reset-btn" onclick={clearFilters}>Сбросить фильтры</button>
		</div>
	{/if}
</div>

<!-- Product Detail Sheet -->
<ProductDetailSheet
	product={selectedProduct}
	open={productSheetOpen}
	onClose={closeProductDetail}
/>

<style>
	.products-page {
		padding: 0 16px 24px;
		max-width: 480px;
		margin: 0 auto;
	}

	.page-header {
		text-align: center;
		padding: 24px 0;
	}

	.page-header h1 {
		font-size: 28px;
		font-weight: bold;
		color: var(--text-primary);
		margin: 0 0 8px 0;
		letter-spacing: -0.025em;
	}

	.subtitle {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0;
	}

	.filters-section {
		margin-bottom: 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.search-bar {
		position: relative;
		display: flex;
		align-items: center;
		background: var(--bg-light);
		border-radius: 12px;
		padding: 12px 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	.search-icon {
		font-size: 18px;
		margin-right: 10px;
	}

	.search-input {
		flex: 1;
		border: none;
		background: transparent;
		font-size: 15px;
		color: var(--text-primary);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-secondary);
	}

	.clear-search {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 18px;
		padding: 4px;
		transition: color 0.2s ease;
	}

	.clear-search:hover {
		color: var(--text-primary);
	}

	.categories-bar {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.categories-bar::-webkit-scrollbar {
		display: none;
	}

	.category-btn {
		padding: 8px 16px;
		border-radius: 20px;
		border: 1px solid var(--border-color);
		background: var(--bg-white);
		color: var(--text-secondary);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.category-btn:hover {
		border-color: var(--primary-orange);
		color: var(--primary-orange);
	}

	.category-btn.active {
		background: var(--primary-orange);
		color: white;
		border-color: var(--primary-orange);
	}

	.reset-filters {
		padding: 10px 16px;
		border-radius: 10px;
		border: none;
		background: var(--bg-light);
		color: var(--text-secondary);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.reset-filters:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.products-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}

	.product-card {
		background: var(--card-bg);
		border-radius: 12px;
		overflow: hidden;
		box-shadow: var(--shadow);
		transition: all 0.3s ease;
		cursor: pointer;
	}

	.product-card:hover {
		box-shadow: var(--shadow-lg);
		transform: translateY(-4px);
	}

	.product-image-wrapper {
		position: relative;
		width: 100%;
		padding-top: 100%;
		background: var(--bg-light);
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

	.discount-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		background: var(--accent-red);
		color: white;
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 700;
	}

	.product-info {
		padding: 12px;
	}

	.product-name {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 4px 0;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.product-category {
		font-size: 12px;
		color: var(--text-secondary);
		display: block;
		margin-bottom: 8px;
	}

	.variation-selector {
		margin-bottom: 8px;
	}

	.variation-select {
		width: 100%;
		padding: 6px 8px;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		background: var(--bg-white);
		font-size: 12px;
		color: var(--text-primary);
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 8px center;
		padding-right: 24px;
	}

	.variation-select:focus {
		outline: none;
		border-color: var(--primary-orange);
	}

	.product-footer {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 8px;
	}

	.product-pricing {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.old-price {
		font-size: 12px;
		color: var(--text-secondary);
		text-decoration: line-through;
	}

	.price {
		font-size: 16px;
		font-weight: 700;
		color: var(--primary-orange);
	}

	.add-to-cart-btn {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--primary-orange);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.add-to-cart-btn:hover {
		background: var(--primary-orange-dark);
		transform: scale(1.05);
	}

	.add-to-cart-btn:active {
		transform: scale(0.95);
	}

	.add-to-cart-btn.adding {
		background: var(--accent-green, #22c55e);
		animation: pulse 0.3s ease-out;
	}

	@keyframes pulse {
		0% { transform: scale(1); }
		50% { transform: scale(1.2); }
		100% { transform: scale(1); }
	}

	.cart-plus-icon {
		font-size: 16px;
		filter: grayscale(1) brightness(10);
	}

	.check-icon {
		font-size: 18px;
		color: white;
		font-weight: bold;
	}

	.empty-state {
		text-align: center;
		padding: 64px 20px;
	}

	.empty-icon {
		font-size: 64px;
		display: block;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state h2 {
		font-size: 20px;
		font-weight: bold;
		color: var(--text-primary);
		margin: 0 0 8px 0;
	}

	.empty-state p {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0 0 16px 0;
	}

	.reset-btn {
		padding: 12px 24px;
		border-radius: 10px;
		border: none;
		background: var(--primary-orange);
		color: white;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.reset-btn:hover {
		background: var(--primary-orange-dark);
		transform: scale(1.02);
	}

	.reset-btn:active {
		transform: scale(0.98);
	}

	@media (max-width: 480px) {
		.products-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 10px;
		}
	}

	@media (min-width: 481px) {
		.products-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
