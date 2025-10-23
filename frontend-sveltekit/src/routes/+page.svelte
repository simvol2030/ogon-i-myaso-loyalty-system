<script lang="ts">
  import LoyaltyCard from '$lib/components/loyalty/ui/LoyaltyCard.svelte';
  import RecommendationCard from '$lib/components/loyalty/ui/RecommendationCard.svelte';
  import OfferCardCompact from '$lib/components/loyalty/ui/OfferCardCompact.svelte';
  import ProductCard from '$lib/components/loyalty/ui/ProductCard.svelte';

  let { data } = $props();
</script>

<!-- 1. Карта лояльности -->
<LoyaltyCard user={data.user} loyaltyRules={data.loyaltyRules} />

<!-- 2. Акции месяца -->
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
      <ProductCard {product} />
    {/each}
  </div>
  <a href="/products" class="see-all-link">
    <span>Все товары</span>
    <span>→</span>
  </a>
</section>

<!-- Section Divider -->
<div class="section-divider"></div>

<!-- 4. Рекомендации для вашего питомца -->
<section class="section-content">
  <h2 class="section-header centered">
    <span>🐾</span>
    <span>Рекомендации для вашего питомца</span>
  </h2>
  <div class="recommendations-list">
    {#each data.recommendations as recommendation}
      <RecommendationCard {recommendation} />
    {/each}
  </div>
</section>

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
