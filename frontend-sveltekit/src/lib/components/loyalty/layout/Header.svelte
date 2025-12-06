<script lang="ts">
  import { theme, toggleTheme } from '$lib/stores/loyalty';
  import CartIcon from '$lib/components/loyalty/ui/CartIcon.svelte';

  interface Props {
    onMenuClick: () => void;
    onCartClick?: () => void;
  }

  let { onMenuClick, onCartClick }: Props = $props();
</script>

<header class="app-header">
  <div class="header-left">
    <img src="/logo.png" alt="Мурзико" class="app-logo" />
    <div class="header-title">
      <span class="store-name">Мурзико</span>
      <span class="header-divider">|</span>
      <span class="section-name">Лояльность</span>
    </div>
  </div>

  <div class="header-right">
    <button class="theme-toggle" onclick={toggleTheme} aria-label="Переключить тему">
      <span class="theme-icon">{$theme === 'light' ? '🌙' : '☀️'}</span>
    </button>

    <CartIcon onClick={onCartClick} />

    <button class="hamburger-button" onclick={onMenuClick} aria-label="Открыть меню">
      <svg class="hamburger-icon" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
      </svg>
    </button>
  </div>
</header>

<style>
  .app-header {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    max-width: 480px;
    width: 100%;
    background: var(--bg-white);
    border-bottom: 1px solid var(--border-color);
    padding: 12px 16px;
    padding-top: calc(12px + env(safe-area-inset-top));
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .app-logo {
    height: 40px;
    width: auto;
    flex-shrink: 0;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
  }

  .store-name {
    color: var(--text-primary);
    font-weight: 700;
  }

  .header-divider {
    color: var(--text-tertiary);
    font-weight: 400;
  }

  .section-name {
    color: var(--primary-orange);
    font-weight: 600;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .theme-toggle,
  .hamburger-button {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--bg-light);
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    flex-shrink: 0;
  }

  .theme-toggle:hover,
  .hamburger-button:hover {
    background: var(--bg-tertiary);
    transform: scale(1.05);
  }

  .theme-toggle:active,
  .hamburger-button:active {
    transform: scale(0.95);
  }

  .theme-icon {
    font-size: 20px;
  }

  .hamburger-icon {
    width: 24px;
    height: 24px;
    color: var(--text-primary);
  }

  @media (max-width: 480px) {
    .header-title {
      font-size: 11px;
      gap: 4px;
    }

    .app-logo {
      height: 36px;
    }
  }
</style>
