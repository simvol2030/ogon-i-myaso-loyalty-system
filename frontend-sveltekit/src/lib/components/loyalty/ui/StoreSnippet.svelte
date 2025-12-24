<script lang="ts">
  /**
   * StoreSnippet - компактный виджет магазина для главной страницы
   * Показывает: название, адрес, телефон и ссылку на страницу магазинов
   */

  interface Store {
    id: number;
    name: string;
    city?: string;
    address: string;
    phone: string;
    hours: string;
  }

  interface Props {
    store: Store;
  }

  let { store }: Props = $props();

  // Phone call handler (same as Header)
  function handlePhoneCall(e: MouseEvent) {
    e.preventDefault();
    const telUrl = `tel:${store.phone}`;

    const tg = (window as any).Telegram?.WebApp;

    if (tg && typeof tg.openLink === 'function') {
      try {
        tg.openLink(telUrl, { try_instant_view: false });
        return;
      } catch (err) {
        console.warn('[StoreSnippet] Telegram openLink failed:', err);
      }
    }

    // Fallback
    window.location.href = telUrl;
  }
</script>

<section class="store-snippet">
  <a href="/stores" class="snippet-link">
    <div class="snippet-header">
      <span class="snippet-icon">📞</span>
      <h3 class="snippet-title">Наши контакты</h3>
      <span class="arrow">→</span>
    </div>
  </a>

  <div class="snippet-content">
    <div class="info-row">
      <span class="info-icon">📍</span>
      <span class="info-text">Наш адрес: {store.address}</span>
    </div>

    <div class="info-row clickable" role="button" tabindex="0" onclick={handlePhoneCall} onkeydown={(e) => e.key === 'Enter' && handlePhoneCall(e as any)}>
      <span class="info-icon">📞</span>
      <span class="info-text phone">{store.phone}</span>
    </div>

    <div class="info-row">
      <span class="info-icon">🕐</span>
      <span class="info-text">{store.hours}</span>
    </div>
  </div>
</section>

<style>
  .store-snippet {
    margin: 16px;
    background: var(--card-bg, var(--bg-white));
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    border: 1px solid var(--border-color);
  }

  .snippet-link {
    display: block;
    text-decoration: none;
    color: inherit;
    padding: 16px;
    background: var(--bg-light);
    border-bottom: 1px solid var(--border-color);
    transition: background 0.2s ease;
  }

  .snippet-link:hover {
    background: var(--bg-tertiary);
  }

  .snippet-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .snippet-icon {
    font-size: 24px;
  }

  .snippet-title {
    flex: 1;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .arrow {
    font-size: 18px;
    color: var(--primary-orange);
    font-weight: 600;
  }

  .snippet-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .info-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .info-row.clickable {
    cursor: pointer;
    padding: 8px;
    margin: -8px;
    border-radius: 8px;
    transition: background 0.2s ease;
  }

  .info-row.clickable:hover {
    background: var(--bg-light);
  }

  .info-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .info-text {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.4;
  }

  .info-text.phone {
    color: var(--primary-orange);
    font-weight: 600;
  }

  @media (max-width: 480px) {
    .store-snippet {
      margin: 12px;
    }

    .snippet-content {
      padding: 14px;
    }
  }
</style>
