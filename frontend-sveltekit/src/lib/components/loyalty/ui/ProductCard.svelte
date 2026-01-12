<script lang="ts">
  import type { Product } from '$lib/types/loyalty';
  import { formatNumber } from '$lib/telegram';
  import { cart } from '$lib/stores/cart';

  interface Props {
    product: Product;
    onclick?: (product: Product) => void;
    showCartButton?: boolean;
  }

  let { product, onclick, showCartButton = true }: Props = $props();
  let addingToCart = $state(false);

  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const handleClick = () => {
    onclick?.(product);
  };

  async function handleAddToCart(e: Event) {
    e.stopPropagation(); // Prevent card click
    if (addingToCart) return;

    addingToCart = true;
    try {
      await cart.addItem(product.id, 1);
      setTimeout(() => {
        addingToCart = false;
      }, 500);
    } catch (error) {
      console.error('Failed to add to cart:', error);
      addingToCart = false;
    }
  }
</script>

<div class="product-card" onclick={handleClick} role="button" tabindex="0" onkeypress={(e) => e.key === 'Enter' && handleClick()}>
  <div class="product-image">
    <img src={product.image} alt={product.name} />
    {#if discount > 0}
      <div class="discount-badge">-{discount}%</div>
    {/if}
  </div>

  <div class="product-info">
    <h3>{product.name}</h3>
    <div class="product-category">{product.category}</div>
    <div class="product-footer">
      <div class="product-pricing">
        <span class="product-price">{formatNumber(product.price)} ₽</span>
        {#if product.oldPrice}
          <span class="product-old-price">{formatNumber(product.oldPrice)} ₽</span>
        {/if}
      </div>
      {#if showCartButton}
        <button
          class="add-to-cart-btn"
          class:adding={addingToCart}
          onclick={handleAddToCart}
          aria-label="Добавить в корзину"
        >
          {#if addingToCart}
            <span class="check-icon">✓</span>
          {:else}
            <span class="cart-icon">🛒</span>
          {/if}
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .product-card {
    background: var(--card-bg);
    border-radius: 16px;
    padding: 12px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.3s ease;
    animation: fadeIn 0.5s ease-out;
  }

  .product-card:hover {
    background: var(--card-hover);
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .product-image {
    width: 100%;
    height: 120px;
    background: var(--bg-light);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
    overflow: hidden;
    position: relative;
  }

  .product-image img {
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
    border-radius: 8px;
    font-size: 12px;
    font-weight: bold;
  }

  .product-info h3 {
    font-size: 14px;
    color: var(--text-primary);
    margin-bottom: 4px;
    font-weight: 600;
    line-height: 1.3;
    min-height: 36px;
  }

  .product-category {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-bottom: 8px;
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

  .product-price {
    color: var(--primary-orange);
    font-weight: bold;
    font-size: 16px;
  }

  .product-old-price {
    color: var(--text-secondary);
    text-decoration: line-through;
    font-size: 12px;
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

  .cart-icon {
    font-size: 16px;
    filter: grayscale(1) brightness(10);
  }

  .check-icon {
    font-size: 18px;
    color: white;
    font-weight: bold;
  }
</style>
