<script lang="ts">
  import { modalStore } from '$lib/stores/modal.svelte';

  interface Props {
    title: string;
    size?: 'normal' | 'large';
    children?: any;
  }

  let { title, size = 'normal', children }: Props = $props();

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      modalStore.close();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      modalStore.close();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if modalStore.isOpen}
  <div class="modal-overlay" onclick={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-content {size === 'large' ? 'modal-content-large' : ''}">
      <div class="modal-header">
        <h3 id="modal-title" class="modal-title">{title}</h3>
        <button class="close-button" onclick={() => modalStore.close()} aria-label="Закрыть модальное окно">
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: 16px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
    animation: slideUp 0.3s ease;
    transition: background-color 0.05s ease, border-color 0.05s ease;
    border: 1px solid var(--border-color);
  }

  .modal-content-large {
    max-width: 600px;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    transition: border-color 0.05s ease;
  }

  .modal-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    transition: color 0.05s ease;
  }

  .close-button {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    transform: scale(1.05);
  }

  .close-button:active {
    transform: scale(0.95);
  }

  .modal-body {
    padding: 24px;
  }

  @media (max-width: 480px) {
    .modal-overlay {
      padding: 12px;
    }

    .modal-content {
      max-height: 95vh;
      border-radius: 16px;
    }

    .modal-header {
      padding: 16px 20px;
    }

    .modal-title {
      font-size: 18px;
    }

    .modal-body {
      padding: 20px;
    }
  }
</style>
