<script lang="ts">
  import Header from '$lib/components/loyalty/layout/Header.svelte';
  import MobileMenu from '$lib/components/loyalty/layout/MobileMenu.svelte';
  import ProductCard from '$lib/components/loyalty/ui/ProductCard.svelte';

  let { data } = $props();
  let menuOpen = $state(false);

  function openMenu() {
    menuOpen = true;
  }

  function closeMenu() {
    menuOpen = false;
  }
</script>

<section class="section-content">
  <h2 class="section-header">
    <span>🛍️</span>
    <span>Топовые товары</span>
  </h2>
  <div class="products-grid">
    {#each data.products as product}
      <ProductCard {product} />
    {/each}
  </div>
</section>

<style>
  .section-content {
    padding: 20px 16px 24px;
  }

  .section-header {
    font-size: 20px;
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 16px;
    letter-spacing: -0.025em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .products-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  @media (max-width: 480px) {
    .section-content {
      padding: 20px 12px 24px;
    }

    .products-grid {
      gap: 10px;
    }
  }
</style>
