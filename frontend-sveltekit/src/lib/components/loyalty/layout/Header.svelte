<script lang="ts">
  import { theme, toggleTheme } from '$lib/stores/loyalty';
  import { appName, appSlogan, logoUrl } from '$lib/stores/customization';
  import CartIcon from '$lib/components/loyalty/ui/CartIcon.svelte';
  import { browser } from '$app/environment';

  interface Props {
    onMenuClick: () => void;
    onCartClick?: () => void;
  }

  let { onMenuClick, onCartClick }: Props = $props();

  const PHONE_NUMBER = '+79328883388';

  /**
   * Phone call handler with iOS Telegram WebApp compatibility
   * Problem: tel: links don't work properly in Telegram WebApp on older iOS devices
   * Solution: Use Telegram WebApp API openLink() or fallback to multiple methods
   */
  function handlePhoneCall() {
    if (!browser) return;

    const telUrl = `tel:${PHONE_NUMBER}`;

    // Check if running inside Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;

    if (tg && typeof tg.openLink === 'function') {
      // Method 1: Use Telegram WebApp API (works on iOS)
      try {
        tg.openLink(telUrl, { try_instant_view: false });
        return;
      } catch (e) {
        console.warn('[Header] Telegram openLink failed:', e);
      }
    }

    // Method 2: Try window.open (works in some browsers)
    try {
      const opened = window.open(telUrl, '_blank');
      if (opened) return;
    } catch (e) {
      console.warn('[Header] window.open failed:', e);
    }

    // Method 3: Create a temporary link and click it (fallback for older browsers)
    try {
      const link = document.createElement('a');
      link.href = telUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    } catch (e) {
      console.warn('[Header] Link click failed:', e);
    }

    // Method 4: Direct location change (last resort)
    window.location.href = telUrl;
  }
</script>

<header class="app-header">
  <div class="header-left">
    <img src={$logoUrl} alt={$appName} class="app-logo" />
    <div class="header-title">
      <span class="store-name">{$appName}</span>
      <span class="header-divider">|</span>
      <span class="section-name">{$appSlogan}</span>
    </div>
  </div>

  <div class="header-right">
    <button class="theme-toggle" onclick={toggleTheme} aria-label="Переключить тему">
      <span class="theme-icon">{$theme === 'light' ? '🌙' : '☀️'}</span>
    </button>

    <button class="phone-button" onclick={handlePhoneCall} aria-label="Позвонить">
      <svg class="phone-icon" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
      </svg>
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
  .phone-button,
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

  .phone-button {
    text-decoration: none;
    /* iOS Safari fix for clickable links */
    -webkit-tap-highlight-color: rgba(16, 185, 129, 0.3);
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }

  .theme-toggle:hover,
  .phone-button:hover,
  .hamburger-button:hover {
    background: var(--bg-tertiary);
    transform: scale(1.05);
  }

  .theme-toggle:active,
  .phone-button:active,
  .hamburger-button:active {
    transform: scale(0.95);
  }

  .theme-icon {
    font-size: 20px;
  }

  .phone-icon,
  .hamburger-icon {
    width: 24px;
    height: 24px;
    color: var(--text-primary);
  }

  /* Critical fix for iOS Safari - prevent SVG from blocking clicks */
  .phone-icon,
  .phone-icon * {
    pointer-events: none;
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
