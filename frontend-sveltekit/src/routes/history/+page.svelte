<script lang="ts">
  import HistoryItem from '$lib/components/loyalty/ui/HistoryItem.svelte';

  let { data } = $props();

  // DEBUG: Log data structure to diagnose rendering issue
  $effect(() => {
    console.log('[history/+page.svelte] === DATA DEBUG ===');
    console.log('[history/+page.svelte] data:', data);
    console.log('[history/+page.svelte] data?.realHistory:', data?.realHistory);
    console.log('[history/+page.svelte] realHistory.length:', data?.realHistory?.length);
    console.log('[history/+page.svelte] showExamples:', data?.showExamples);
    console.log('[history/+page.svelte] exampleHistory.length:', data?.exampleHistory?.length);
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
        <HistoryItem {transaction} />
      {/each}
    </div>
  {/if}

  <!-- Example transactions divider and list -->
  {#if data?.showExamples && data?.exampleHistory && data.exampleHistory.length > 0}
    <div class="example-divider">
      <div class="divider-line"></div>
      <h3 class="example-header">💡 Пример истории операций</h3>
      <div class="divider-line"></div>
    </div>

    <div class="history-list example-list">
      {#each data.exampleHistory as transaction}
        <HistoryItem {transaction} isExample={true} />
      {/each}
    </div>
  {/if}

  <!-- Empty state (shouldn't happen because of welcome bonus, but just in case) -->
  {#if (!data?.realHistory || data.realHistory.length === 0) && (!data?.exampleHistory || data.exampleHistory.length === 0)}
    <div class="empty-state">
      <p>У вас пока нет операций</p>
      <p class="empty-hint">Совершите первую покупку, чтобы начать копить Мурзи-коины!</p>
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

  /* Example transactions styling */
  .example-divider {
    margin: 32px 0 24px;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      to right,
      transparent,
      var(--border-color),
      transparent
    );
  }

  .example-header {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
    text-align: center;
  }

  .example-list {
    opacity: 0.7;
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

    .example-divider {
      margin: 24px 0 20px;
      gap: 12px;
    }

    .example-header {
      font-size: 14px;
    }
  }
</style>
