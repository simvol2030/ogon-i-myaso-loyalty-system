<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { Product } from '$lib/types/loyalty';
  import LoyaltyCard from '$lib/components/loyalty/ui/LoyaltyCard.svelte';
  import StoriesCarousel from '$lib/components/loyalty/ui/StoriesCarousel.svelte';
  import StoreSnippet from '$lib/components/loyalty/ui/StoreSnippet.svelte';
  import RecommendationCard from '$lib/components/loyalty/ui/RecommendationCard.svelte';
  import OfferCardCompact from '$lib/components/loyalty/ui/OfferCardCompact.svelte';
  import ProductCard from '$lib/components/loyalty/ui/ProductCard.svelte';
  import ProductDetailSheet from '$lib/components/loyalty/ui/ProductDetailSheet.svelte';

  let { data } = $props();

  // Product detail sheet state
  let selectedProduct = $state<Product | null>(null);
  let productSheetOpen = $state(false);

  const openProductDetail = (product: Product) => {
    selectedProduct = product;
    productSheetOpen = true;
  };

  const closeProductDetail = () => {
    productSheetOpen = false;
  };

  // TEMPORARY FIX: Redirect disabled for iPhone testing without Telegram
  // TODO: Re-enable after phone button is fixed and tested
  /* TEMPORARILY DISABLED FOR TESTING
  onMount(() => {
    if (browser) {
      // Check if we're running inside Telegram WebApp
      const isInTelegramWebApp = window.Telegram?.WebApp?.initData;

      if (!isInTelegramWebApp) {
        // Redirect to Telegram bot
        window.location.href = 'https://t.me/granat_loyalty_bot';
      }
    }
  });
  */
</script>

<!-- 1. Карта лояльности -->
<LoyaltyCard user={data.user} loyaltyRules={data.loyaltyRules} />

<!-- 2. Web Stories -->
<StoriesCarousel userId={data.user?.id} />

<!-- 2.5. Snippet магазина -->
{#if data.store}
  <StoreSnippet store={data.store} />
{/if}

<!-- 3. Акции месяца -->
<section class="section-content">
  <h2 class="section-header centered">
    <span>🎉</span>
    <span>Акции месяца</span>
  </h2>
  <div class="offers-list">
    {#each data.monthOffers as offer}
      <OfferCardCompact {offer} />
    {/each}
  </div>
  <a href="/offers" class="see-all-link">
    <span>Все акции</span>
    <span>→</span>
  </a>
</section>

<!-- Section Divider -->
<div class="section-divider"></div>

<!-- 3. Топовые товары -->
<section class="section-content">
  <h2 class="section-header centered">
    <span>⭐</span>
    <span>Топовые товары</span>
  </h2>
  <div class="products-grid">
    {#each data.topProducts as product}
      <ProductCard {product} onclick={openProductDetail} />
    {/each}
  </div>
  <a href="/products" class="see-all-link">
    <span>Все товары</span>
    <span>→</span>
  </a>
</section>

<!-- Section Divider -->
<div class="section-divider"></div>

<!-- 4. Рекомендации для Вас -->
<section class="section-content">
  <h2 class="section-header centered">
    <span>Рекомендации для Вас</span>
  </h2>
  <div class="recommendations-list">
    {#each data.recommendations as recommendation}
      <RecommendationCard {recommendation} />
    {/each}
  </div>
</section>

<!-- Product Detail Sheet -->
<ProductDetailSheet
  product={selectedProduct}
  open={productSheetOpen}
  onClose={closeProductDetail}
/>

<style>
  .section-content {
    padding: 0 16px;
    margin-bottom: 24px;
  }

  .section-header {
    font-size: 20px;
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 20px;
    letter-spacing: -0.025em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-header.centered {
    justify-content: center;
    text-align: center;
  }

  .section-divider {
    height: 1px;
    background: var(--border-color);
    margin: 32px 16px;
  }

  .see-all-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 20px;
    font-size: 15px;
    color: var(--primary-orange);
    text-decoration: none;
    font-weight: 600;
    transition: all 0.2s ease;
    padding: 8px;
    border-radius: 8px;
  }

  .see-all-link:hover {
    background: var(--bg-tertiary);
    transform: translateX(2px);
  }

  .offers-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .recommendations-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  @media (max-width: 480px) {
    .section-content {
      padding: 0 12px;
    }

    .section-divider {
      margin: 24px 12px;
    }

    .products-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
