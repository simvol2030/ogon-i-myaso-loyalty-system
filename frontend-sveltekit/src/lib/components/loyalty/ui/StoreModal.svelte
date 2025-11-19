<script lang="ts">
  import type { Store } from '$lib/types/loyalty';
  import { browser } from '$app/environment';

  interface Props {
    store: Store | null;
    open: boolean;
    onClose: () => void;
  }

  let { store, open, onClose }: Props = $props();

  $effect(() => {
    if (!browser) return;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function openRoute() {
    if (!store) return;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const url = isMobile
      ? `https://yandex.ru/maps/?pt=${store.coords.lng},${store.coords.lat}&z=16&l=map`
      : `https://maps.google.com/?q=${store.coords.lat},${store.coords.lng}`;
    window.open(url, '_blank');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="modal-overlay"
  class:show={open}
  onclick={handleOverlayClick}
  onkeydown={(e) => e.key === 'Enter' && handleOverlayClick(e as any)}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  {#if store}
    <div class="modal-content modal-content-large">
      <div class="modal-header">
        <h2 class="modal-title">{store.name}</h2>
        <button class="close-button" onclick={onClose} aria-label="Закрыть">
          <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>

      <div class="store-info">
        <div class="info-item">
          <strong>Адрес:</strong>
          <span>{store.address}</span>
        </div>

        <div class="info-item">
          <strong>Телефон:</strong>
          <a href="tel:{store.phone}">{store.phone}</a>
        </div>

        <div class="info-item">
          <strong>Часы работы:</strong>
          <span>{store.hours}</span>
        </div>

        <div class="features">
          <strong>Услуги:</strong>
          <div class="features-list">
            {#each store.features as feature}
              <span class="feature-badge">{feature}</span>
            {/each}
          </div>
        </div>

        <button class="route-button" onclick={openRoute}>
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
            />
          </svg>
          Построить маршрут
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    backdrop-filter: blur(5px);
  }

  .modal-overlay.show {
    opacity: 1;
    pointer-events: all;
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: 24px;
    padding: 32px;
    margin: 16px;
    max-width: 360px;
    width: 100%;
    transform: scale(0.9);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .modal-content-large {
    max-width: 420px;
    max-height: 85vh;
    overflow-y: auto;
  }

  .modal-overlay.show .modal-content {
    transform: scale(1);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .modal-title {
    font-size: 20px;
    font-weight: bold;
    color: var(--text-primary);
  }

  .close-button {
    width: 36px;
    height: 36px;
    background: var(--bg-tertiary);
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: var(--bg-light);
    transform: rotate(90deg);
  }

  .store-info {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .info-item strong {
    font-size: 13px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .info-item span,
  .info-item a {
    font-size: 15px;
    color: var(--text-primary);
    font-weight: 500;
  }

  .info-item a {
    color: var(--primary-orange);
    text-decoration: none;
  }

  .info-item a:hover {
    text-decoration: underline;
  }

  .features {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .features strong {
    font-size: 13px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .features-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .feature-badge {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
  }

  .route-button {
    width: 100%;
    background: linear-gradient(135deg, var(--primary-orange), var(--primary-orange-dark));
    color: white;
    border: none;
    padding: 14px 20px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.3s ease;
    margin-top: 8px;
  }

  .route-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(255, 107, 0, 0.3);
  }

  .route-button:active {
    transform: translateY(0);
  }
</style>
