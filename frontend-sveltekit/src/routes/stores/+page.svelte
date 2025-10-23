<script lang="ts">
  import Header from '$lib/components/loyalty/layout/Header.svelte';
  import MobileMenu from '$lib/components/loyalty/layout/MobileMenu.svelte';
  import StoreCard from '$lib/components/loyalty/ui/StoreCard.svelte';
  import StoreModal from '$lib/components/loyalty/ui/StoreModal.svelte';
  import type { Store } from '$lib/types/loyalty';

  let { data } = $props();
  let menuOpen = $state(false);
  let selectedStore = $state<Store | null>(null);

  function openMenu() {
    menuOpen = true;
  }

  function closeMenu() {
    menuOpen = false;
  }

  function selectStore(store: Store) {
    selectedStore = store;
  }

  function closeStoreModal() {
    selectedStore = null;
  }
</script>

<section class="section-content">
  <h2 class="section-header">
    <span>🏪</span>
    <span>Наши магазины</span>
  </h2>
  <div class="stores-list">
    {#each data.stores as store}
      <StoreCard {store} onClick={() => selectStore(store)} />
    {/each}
  </div>
</section>

<StoreModal store={selectedStore} open={!!selectedStore} onClose={closeStoreModal} />

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

  .stores-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  @media (max-width: 480px) {
    .section-content {
      padding: 20px 12px 24px;
    }
  }
</style>
