<script lang="ts">
  import type { Store } from '$lib/types/loyalty';

  interface Props {
    store: Store;
    onClick: () => void;
  }

  let { store, onClick }: Props = $props();
</script>

<button class="list-item" onclick={onClick}>
  <div class="list-item-content">
    <div class="list-item-icon icon-{store.iconColor}">
      <svg width="28" height="28" fill="white" viewBox="0 0 24 24">
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
        />
      </svg>
    </div>
    <div class="list-item-text">
      <h3>{store.name}</h3>
      <p>{store.address}</p>
      <div class="list-item-meta">{store.hours}</div>
    </div>
  </div>
</button>

<style>
  .list-item {
    background: var(--card-bg);
    border-radius: 20px;
    padding: 20px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.3s ease;
    width: 100%;
    text-align: left;
  }

  .list-item:hover {
    background: var(--card-hover);
    transform: translateX(4px);
    box-shadow: var(--shadow-lg);
  }

  .list-item-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .list-item-icon {
    width: 64px;
    height: 64px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow);
    flex-shrink: 0;
  }

  .icon-orange {
    background: linear-gradient(135deg, var(--primary-orange), var(--primary-orange-dark));
  }

  .icon-green {
    background: linear-gradient(135deg, var(--secondary-green), var(--secondary-green-dark));
  }

  .icon-blue {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
  }

  .icon-purple {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  }

  .icon-pink {
    background: linear-gradient(135deg, #ec4899, #db2777);
  }

  .icon-indigo {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
  }

  .list-item-text {
    flex: 1;
  }

  .list-item-text h3 {
    font-weight: bold;
    color: var(--text-primary);
    font-size: 16px;
    letter-spacing: -0.025em;
    margin-bottom: 4px;
  }

  .list-item-text p {
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
  }

  .list-item-meta {
    color: var(--secondary-green);
    font-weight: bold;
    font-size: 13px;
    margin-top: 6px;
  }
</style>
