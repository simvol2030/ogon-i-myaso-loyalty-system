<script lang="ts">
  import HistoryItem from '$lib/components/loyalty/ui/HistoryItem.svelte';

  let { data } = $props();

  // Get pointsName from data
  const pointsName = data?.pointsName || 'баллов';

  // DEBUG: Log data structure
  $effect(() => {
    console.log('[history/+page.svelte] === DATA DEBUG ===');
    console.log('[history/+page.svelte] realHistory.length:', data?.realHistory?.length);
    console.log('[history/+page.svelte] pointsName:', pointsName);
  });
</script>

<section class="section-content">
  <h2 class="section-header">
    <span>📜</span>
    <span>История операций</span>
  </h2>

  <!-- Real transactions from database -->
  {#if data?.realHistory && data.realHistory.length > 0}
    <div class="history-list">
      {#each data.realHistory as transaction}
        <HistoryItem {transaction} {pointsName} />
      {/each}
    </div>
  {:else}
    <!-- Empty state -->
    <div class="empty-state">
      <p>У вас пока нет операций</p>
      <p class="empty-hint">Совершите первую покупку, чтобы начать копить {pointsName}!</p>
    </div>
  {/if}
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

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 48px 16px;
    color: var(--text-secondary);
  }

  .empty-state p {
    margin: 0;
    font-size: 16px;
  }

  .empty-hint {
    margin-top: 8px;
    font-size: 14px;
    opacity: 0.7;
  }

  @media (max-width: 480px) {
    .section-content {
      padding: 20px 12px 24px;
    }
  }
</style>
