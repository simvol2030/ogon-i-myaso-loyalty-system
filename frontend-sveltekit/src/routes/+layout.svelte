<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import { initTheme } from '$lib/stores/loyalty';
  import { loadCustomization, customization, applyCustomStyles, appName, colors } from '$lib/stores/customization';
  import type { CustomizationData } from '$lib/stores/customization';
  import Header from '$lib/components/loyalty/layout/Header.svelte';
  import BottomNav from '$lib/components/loyalty/layout/BottomNav.svelte';
  import MobileMenu from '$lib/components/loyalty/layout/MobileMenu.svelte';
  import QRModal from '$lib/components/loyalty/ui/QRModal.svelte';
  import CartDrawer from '$lib/components/loyalty/ui/CartDrawer.svelte';
  import favicon from '$lib/assets/favicon.svg';
  import '$lib/styles/themes.css';
  import '$lib/styles/loyalty.css';

  let { children, data } = $props();

  // BUG FIX: Initialize customization immediately from server data to prevent logo flashing
  // IMPORTANT: Merge server data with defaults because server may not include all fields (navigation, loyaltyCard, etc.)
  // Only overwrite fields that are actually present in server data, preserve defaults for missing fields
  // This runs BEFORE first render, unlike onMount which runs after
  if (data.customization && typeof window !== 'undefined') {
    const defaultCustomization = get(customization); // Get current defaults
    const serverData = data.customization as Partial<CustomizationData>;
    const mergedData: CustomizationData = {
      ...defaultCustomization,
      // Only include server fields that exist (not undefined)
      ...(serverData.appName !== undefined && { appName: serverData.appName }),
      ...(serverData.appSlogan !== undefined && { appSlogan: serverData.appSlogan }),
      ...(serverData.logoUrl !== undefined && { logoUrl: serverData.logoUrl }),
      ...(serverData.faviconUrl !== undefined && { faviconUrl: serverData.faviconUrl }),
      ...(serverData.productsLabel !== undefined && { productsLabel: serverData.productsLabel }),
      ...(serverData.productsIcon !== undefined && { productsIcon: serverData.productsIcon }),
      // Deep merge nested objects
      colors: { ...defaultCustomization.colors, ...(serverData.colors || {}) },
      darkTheme: { ...defaultCustomization.darkTheme, ...(serverData.darkTheme || {}) },
      navigation: serverData.navigation || defaultCustomization.navigation,
      loyaltyCard: { ...defaultCustomization.loyaltyCard, ...(serverData.loyaltyCard || {}) }
    };
    customization.set(mergedData);
    applyCustomStyles(mergedData);
  }

  // Check if current route is loyalty app (not admin routes or cashier)
  // Note: Admin routes use (admin)/+layout@.svelte but we still need to exclude them here
  // to prevent root layout from rendering Header + BottomNav before admin layout takes over
  const isLoyaltyApp = $derived(!$page.url.pathname.startsWith('/dashboard') &&
                                !$page.url.pathname.startsWith('/clients') &&
                                !$page.url.pathname.startsWith('/promotions') &&
                                !$page.url.pathname.startsWith('/campaigns') &&
                                !$page.url.pathname.startsWith('/triggers') &&
                                !$page.url.pathname.startsWith('/products-admin') &&
                                !$page.url.pathname.startsWith('/categories') &&
                                !$page.url.pathname.startsWith('/orders') &&
                                !$page.url.pathname.startsWith('/store-list') &&
                                !$page.url.pathname.startsWith('/sellers') &&
                                !$page.url.pathname.startsWith('/statistics') &&
                                !$page.url.pathname.startsWith('/shop-settings') &&
                                !$page.url.pathname.startsWith('/stories') &&
                                !$page.url.pathname.startsWith('/settings') &&
                                !$page.url.pathname.startsWith('/feed-admin') &&
                                !$page.url.pathname.startsWith('/delivery-locations') &&
                                !$page.url.pathname.startsWith('/login') &&
                                !$page.url.pathname.startsWith('/logout') &&
                                !$page.url.pathname.startsWith('/cashier') &&
                                !$page.url.pathname.startsWith('/seller'));

  let menuOpen = $state(false);
  let qrModalOpen = $state(false);
  let cartDrawerOpen = $state(false);

  // Reactive user data for QR Modal (updated by LoyaltyCard)
  let currentCardNumber = $state(data.user.cardNumber);
  let currentBalance = $state(data.user.balance);
  let currentUserId = $state(data.user.id || 1);
  let pointsName = $state('баллов'); // Default fallback

  function openMenu() {
    menuOpen = true;
  }

  function closeMenu() {
    menuOpen = false;
  }

  function openQRModal() {
    qrModalOpen = true;
  }

  function closeQRModal() {
    qrModalOpen = false;
  }

  function openCartDrawer() {
    cartDrawerOpen = true;
  }

  function closeCartDrawer() {
    cartDrawerOpen = false;
  }

  // Function to update user data from child components
  function updateUserData(cardNumber: string, balance: number, userId?: number) {
    currentCardNumber = cardNumber;
    currentBalance = balance;
    if (userId !== undefined) currentUserId = userId;
  }

  // Set context so child components can access these functions
  setContext('openQRModal', openQRModal);
  setContext('updateUserData', updateUserData);
  setContext('pointsName', () => pointsName); // Reactive getter for pointsName

  onMount(async () => {
    if (isLoyaltyApp) {
      console.log('[+layout] 🚀 Loyalty app detected, starting initialization');
      console.log('[+layout] 🌐 window.Telegram at mount:', !!window.Telegram);
      console.log('[+layout] 📍 Current pathname:', $page.url.pathname);

      // Customization already loaded from server data (see lines 17-22)
      // Only fallback to API if server data was not available
      if (!data.customization) {
        console.log('[+layout] ⚠️ No server customization, loading from API');
        loadCustomization().catch(err => {
          console.warn('[+layout] ⚠️ Failed to load customization:', err);
        });
      } else {
        console.log('[+layout] ✅ Using server-loaded customization (SSR)');
      }

      // Initialize theme
      initTheme();

      // TEMPORARY FIX: Telegram initialization disabled for iPhone testing
      // TODO: Re-enable after phone button is fixed
      console.log('[+layout] ⚠️ TELEGRAM INITIALIZATION TEMPORARILY DISABLED FOR TESTING');

      /* TEMPORARILY DISABLED FOR TESTING
      // CRITICAL: Call ensureTelegramReady() IMMEDIATELY to unblock scroll
      // This must happen BEFORE waiting for user data
      const { ensureTelegramReady, initializeUser } = await import('$lib/telegram');

      console.log('[+layout] 🔄 Calling ensureTelegramReady...');
      await ensureTelegramReady();
      console.log('[+layout] ✅ Telegram ready, scroll enabled');
      console.log('[+layout] 🔍 initDataUnsafe after ready:', !!window.Telegram?.WebApp?.initDataUnsafe?.user);

      // CRITICAL: Initialize user on FIRST app load (any page)
      // This ensures user is registered in DB even if they land on /history directly
      // The API endpoint is idempotent - safe to call multiple times
      try {
        console.log('[+layout] 🔄 Initializing user...');
        const result = await initializeUser();
        console.log('[+layout] 📊 initializeUser result:', result);

        if (result?.success) {
          console.log('[+layout] ✅ User initialized:', {
            isNewUser: result.isNewUser,
            telegram_user_id: result.user.telegram_user_id,
            balance: result.user.current_balance,
            bonus: result.isNewUser ? '500 Murzikoyns awarded' : 'Welcome back'
          });
        } else {
          console.warn('[+layout] ⚠️ User initialization returned no result');
          console.warn('[+layout] ⚠️ Check browser console for errors in initializeUser()');
        }
      } catch (error) {
        console.error('[+layout] ❌ Failed to initialize user:', error);
        console.error('[+layout] ❌ Stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Don't block app load if initialization fails
      }
      */

      // Load loyalty settings (pointsName) from API
      try {
        const response = await fetch('/api/loyalty/settings');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.pointsName) {
            pointsName = result.data.pointsName;
            console.log('[+layout] ✅ Loaded pointsName:', pointsName);
          }
        }
      } catch (error) {
        console.warn('[+layout] ⚠️ Failed to load loyalty settings, using default pointsName:', error);
      }
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  {#if isLoyaltyApp}
    <title>{$appName} - Программа лояльности</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content={$colors.primary} />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  {/if}
</svelte:head>

{#if isLoyaltyApp}
  <div class="app-container">
    <Header onMenuClick={openMenu} onCartClick={openCartDrawer} />
    <MobileMenu open={menuOpen} onClose={closeMenu} />
    <CartDrawer open={cartDrawerOpen} onClose={closeCartDrawer} />

    <main class="content">
      {@render children?.()}
    </main>

    <BottomNav />

    {#if data?.user && qrModalOpen}
      <QRModal
        userId={currentUserId}
        cardNumber={currentCardNumber}
        balance={currentBalance}
        pointsName={pointsName}
        open={qrModalOpen}
        onClose={closeQRModal}
      />
    {/if}
  </div>
{:else}
  {@render children?.()}
{/if}

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-white);
  }

  .content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--bg-white);
    -webkit-overflow-scrolling: touch;
    margin-top: calc(64px + env(safe-area-inset-top));
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
  }
</style>
