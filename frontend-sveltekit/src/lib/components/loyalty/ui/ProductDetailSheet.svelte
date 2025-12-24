<script lang="ts">
	import type { Product, ProductVariation } from '$lib/types/loyalty';
	import { cart } from '$lib/stores/cart';
	import { formatNumber } from '$lib/telegram';

	interface Props {
		product: Product | null;
		open: boolean;
		onClose: () => void;
	}

	let { product, open, onClose }: Props = $props();

	let quantity = $state(1);
	let selectedVariation = $state<ProductVariation | null>(null);
	let adding = $state(false);
	let touchStartY = $state(0);
	let touchCurrentY = $state(0);
	let isDragging = $state(false);
	let scrollableRef = $state<HTMLElement | null>(null);

	// Reset state when product changes
	$effect(() => {
		if (product) {
			quantity = 1;
			// Select default variation if available
			if (product.variations && product.variations.length > 0) {
				selectedVariation = product.variations.find(v => v.isDefault) || product.variations[0];
			} else {
				selectedVariation = null;
			}
		}
	});

	// Current price (from variation or product)
	const currentPrice = $derived(selectedVariation?.price ?? product?.price ?? 0);
	const currentOldPrice = $derived(selectedVariation?.oldPrice ?? product?.oldPrice);

	const discount = $derived(
		currentOldPrice ? Math.round(((currentOldPrice - currentPrice) / currentOldPrice) * 100) : 0
	);

	const totalPrice = $derived(currentPrice * quantity);

	const handleQuantityChange = (delta: number) => {
		const newQty = quantity + delta;
		if (newQty >= 1 && newQty <= 99) {
			quantity = newQty;
		}
	};

	const handleAddToCart = async () => {
		if (!product) return;

		adding = true;
		try {
			await cart.addItem(product.id, quantity, selectedVariation?.id);
			onClose();
		} catch (error) {
			console.error('Failed to add to cart:', error);
		} finally {
			adding = false;
		}
	};

	const handleOverlayClick = (e: MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	// Touch handlers for swipe-to-dismiss (only when at top of scroll)
	const handleTouchStart = (e: TouchEvent) => {
		// Only enable drag if scrolled to top
		if (scrollableRef && scrollableRef.scrollTop <= 0) {
			touchStartY = e.touches[0].clientY;
			touchCurrentY = touchStartY;
			isDragging = true;
		}
	};

	const handleTouchMove = (e: TouchEvent) => {
		if (!isDragging) return;

		const currentY = e.touches[0].clientY;
		const delta = currentY - touchStartY;

		// Only allow dragging down
		if (delta > 0) {
			touchCurrentY = currentY;
			// Prevent scroll while dragging down
			e.preventDefault();
		} else {
			// User is scrolling up, cancel drag
			isDragging = false;
		}
	};

	const handleTouchEnd = () => {
		if (!isDragging) return;
		const dragDistance = touchCurrentY - touchStartY;

		// If dragged down more than 100px, close the sheet
		if (dragDistance > 100) {
			onClose();
		}

		isDragging = false;
		touchStartY = 0;
		touchCurrentY = 0;
	};

	const dragOffset = $derived(isDragging ? Math.max(0, touchCurrentY - touchStartY) : 0);
</script>

{#if open && product}
	<div class="sheet-overlay" onclick={handleOverlayClick} role="dialog" aria-modal="true">
		<div
			class="product-sheet"
			style:transform={dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined}
		>
			<!-- Drag handle (for swipe to dismiss) -->
			<div
				class="drag-handle"
				ontouchstart={handleTouchStart}
				ontouchmove={handleTouchMove}
				ontouchend={handleTouchEnd}
			>
				<div class="handle-bar"></div>
			</div>

			<!-- Close button (floating) -->
			<button class="close-btn" onclick={onClose} aria-label="Закрыть">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>

			<!-- Scrollable content (image + info) -->
			<div
				class="scrollable-content"
				bind:this={scrollableRef}
				ontouchstart={handleTouchStart}
				ontouchmove={handleTouchMove}
				ontouchend={handleTouchEnd}
			>
				<!-- Product image -->
				<div class="product-image">
					<img src={product.image} alt={product.name} />
					{#if discount > 0}
						<div class="discount-badge">-{discount}%</div>
					{/if}
				</div>

				<!-- Product info -->
				<div class="product-content">
					<div class="product-category">{product.category}</div>
					<h2 class="product-name">{product.name}</h2>

					{#if product.quantityInfo}
						<div class="product-quantity-info">{product.quantityInfo}</div>
					{/if}

					{#if product.description}
						<p class="product-description">{product.description}</p>
					{/if}

					<!-- Variations selector -->
					{#if product.variations && product.variations.length > 0 && product.variationAttribute}
						<div class="variations-section">
							<div class="variations-label">{product.variationAttribute}:</div>
							<div class="variations-list">
								{#each product.variations.filter(v => v.isActive) as variation (variation.id)}
									<button
										class="variation-btn"
										class:selected={selectedVariation?.id === variation.id}
										onclick={() => selectedVariation = variation}
									>
										{variation.name}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Pricing -->
					<div class="product-pricing">
						<span class="current-price">{formatNumber(currentPrice)} ₽</span>
						{#if currentOldPrice && currentOldPrice > currentPrice}
							<span class="old-price">{formatNumber(currentOldPrice)} ₽</span>
						{/if}
					</div>
				</div>

				<!-- Footer with quantity and add to cart (now inside scroll area) -->
				<div class="sheet-footer">
				<div class="quantity-selector">
					<button
						class="qty-btn"
						onclick={() => handleQuantityChange(-1)}
						disabled={quantity <= 1}
					>
						−
					</button>
					<span class="qty-value">{quantity}</span>
					<button
						class="qty-btn"
						onclick={() => handleQuantityChange(1)}
						disabled={quantity >= 99}
					>
						+
					</button>
				</div>

				<button class="add-to-cart-btn" onclick={handleAddToCart} disabled={adding}>
					{#if adding}
						<span class="spinner"></span>
					{:else}
						<svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke-linecap="round" stroke-linejoin="round"/>
							<path d="M3 6h18" stroke-linecap="round"/>
							<path d="M16 10a4 4 0 01-8 0" stroke-linecap="round"/>
						</svg>
						<span class="btn-text">В корзину</span>
						<span class="btn-divider"></span>
						<span class="total-price">{formatNumber(totalPrice)} ₽</span>
					{/if}
				</button>
			</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.sheet-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1000;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.product-sheet {
		width: 100%;
		max-width: 500px;
		/* FIX: Теперь всё скроллится, можно использовать большую высоту */
		max-height: 90vh;
		max-height: 90dvh;
		background: var(--bg-white);
		border-radius: 24px 24px 0 0;
		display: flex;
		flex-direction: column;
		animation: slideUp 0.3s ease-out;
		position: relative;
		overflow: hidden;
	}

	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	.drag-handle {
		padding: 12px;
		display: flex;
		justify-content: center;
		cursor: grab;
		flex-shrink: 0;
		background: var(--bg-white);
		border-radius: 24px 24px 0 0;
	}

	.handle-bar {
		width: 40px;
		height: 4px;
		background: var(--border-color);
		border-radius: 2px;
	}

	.close-btn {
		position: absolute;
		top: 56px; /* Below drag handle */
		right: 16px;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.4);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 10;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		background: rgba(0, 0, 0, 0.6);
	}

	.close-btn svg {
		width: 20px;
		height: 20px;
		color: white;
	}

	/* Scrollable area containing both image and content */
	.scrollable-content {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
	}

	.product-image {
		width: 100%;
		aspect-ratio: 1 / 1;
		max-height: 280px;
		background: var(--bg-light);
		position: relative;
		overflow: hidden;
		flex-shrink: 0;
	}

	.product-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.discount-badge {
		position: absolute;
		top: 16px;
		left: 16px;
		background: var(--accent-red);
		color: white;
		padding: 6px 12px;
		border-radius: 12px;
		font-size: 14px;
		font-weight: bold;
	}

	.product-content {
		padding: 20px;
	}

	.product-category {
		font-size: 13px;
		color: var(--text-tertiary);
		margin-bottom: 4px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.product-name {
		font-size: 22px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 8px;
		line-height: 1.3;
	}

	.product-quantity-info {
		font-size: 14px;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}

	.product-description {
		font-size: 15px;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0 0 16px;
		white-space: pre-wrap;
	}

	.variations-section {
		margin-bottom: 16px;
	}

	.variations-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.variations-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.variation-btn {
		padding: 8px 16px;
		border: 2px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-white);
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.variation-btn:hover {
		border-color: var(--primary-orange);
		background: var(--bg-light);
	}

	.variation-btn.selected {
		border-color: var(--primary-orange);
		background: var(--primary-orange);
		color: white;
	}

	.product-pricing {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-bottom: 8px;
	}

	.current-price {
		font-size: 24px;
		font-weight: 700;
		color: var(--primary-orange);
	}

	.old-price {
		font-size: 16px;
		color: var(--text-secondary);
		text-decoration: line-through;
	}

	.sheet-footer {
		/* FIX: Footer теперь внутри scroll area - всегда доступен через прокрутку */
		padding: 16px 20px;
		/* Добавляем отступ снизу ~2см (80px) + safe-area */
		padding-bottom: calc(80px + env(safe-area-inset-bottom, 0));
		background: var(--bg-white);
		border-top: 1px solid var(--border-color);
		display: flex;
		gap: 12px;
		align-items: center;
		margin-top: auto;
		box-sizing: border-box;
	}

	.quantity-selector {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-light);
		border-radius: 12px;
		padding: 4px;
	}

	.qty-btn {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: var(--bg-white);
		border: none;
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.qty-btn:hover:not(:disabled) {
		background: var(--primary-orange);
		color: white;
	}

	.qty-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.qty-value {
		min-width: 32px;
		text-align: center;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.add-to-cart-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 16px 24px;
		background: linear-gradient(135deg, var(--primary-orange) 0%, #e85a00 100%);
		color: white;
		border: none;
		border-radius: 14px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3);
	}

	.add-to-cart-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, #e85a00 0%, #cc4e00 100%);
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(255, 107, 0, 0.4);
	}

	.add-to-cart-btn:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 2px 8px rgba(255, 107, 0, 0.3);
	}

	.add-to-cart-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
		box-shadow: none;
	}

	.cart-icon {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
	}

	.btn-text {
		font-weight: 600;
	}

	.btn-divider {
		width: 1px;
		height: 20px;
		background: rgba(255, 255, 255, 0.3);
	}

	.total-price {
		padding: 6px 12px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		font-size: 15px;
		font-weight: 700;
		backdrop-filter: blur(4px);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@media (max-width: 480px) {
		.product-sheet {
			/* FIX: На маленьких экранах тоже всё скроллится */
			max-height: 85vh;
			max-height: 85dvh;
		}

		.product-image {
			max-height: 200px;
		}

		.product-name {
			font-size: 20px;
		}

		.current-price {
			font-size: 22px;
		}

		.qty-btn {
			width: 36px;
			height: 36px;
		}

		.sheet-footer {
			padding: 12px 16px;
			padding-bottom: calc(80px + env(safe-area-inset-bottom, 0));
			gap: 8px;
		}

		.add-to-cart-btn {
			padding: 12px 16px;
			font-size: 14px;
		}
	}
</style>
