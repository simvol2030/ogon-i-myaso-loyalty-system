<script lang="ts">
  import type { Transaction } from '$lib/types/loyalty';

  interface Props {
    transaction: Transaction;
    pointsName?: string; // Название бонусных баллов
  }

  let { transaction, pointsName = 'баллов' }: Props = $props();
</script>

<div class="history-item">
  <div class="history-content">
    <div class="history-left">
      <h3>{transaction.title}</h3>
      <p>{transaction.date}</p>
    </div>
    <div class="history-right">
      <div class="history-amount" class:green={transaction.type === 'earn'} class:red={transaction.type === 'spend'}>
        {transaction.type === 'earn' ? '+' : '-'}{transaction.amount} {pointsName}
      </div>
      <div class="history-spent">{transaction.spent}</div>
    </div>
  </div>
</div>

<style>
  .history-item {
    background: var(--card-bg);
    border-radius: 20px;
    padding: 10px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border-color);
    margin-bottom: 6px;
  }

  .history-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .history-left {
    flex: 1;
  }

  .history-left h3 {
    font-weight: bold;
    color: var(--text-primary);
    font-size: 15px;
    letter-spacing: -0.025em;
    margin-bottom: 4px;
  }

  .history-left p {
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
  }

  .history-right {
    text-align: right;
  }

  .history-amount {
    font-weight: bold;
    font-size: 16px;
    margin-bottom: 2px;
  }

  .history-amount.green {
    color: var(--secondary-green);
  }

  .history-amount.red {
    color: var(--accent-red);
  }

  .history-spent {
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
  }
</style>
