<script lang="ts">
  import type { Product } from '$lib/types/loyalty';
  import { formatNumber } from '$lib/telegram';

  interface Props {
    product: Product;
    onclick?: (product: Product) => void;
  }

  let { product, onclick }: Props = $props();

  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const handleClick = () => {
    onclick?.(product);
  };
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
    <div class="product-pricing">
      <span class="product-price">{formatNumber(product.price)} ₽</span>
      {#if product.oldPrice}
        <span class="product-old-price">{formatNumber(product.oldPrice)} ₽</span>
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

  .product-pricing {
    display: flex;
    align-items: center;
    gap: 6px;
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
</style>
