<script lang="ts">
  import { onMount } from 'svelte';
  import type { User } from '$lib/types/loyalty';
  import { formatNumber, initializeUser, waitForTelegramUser, formatTelegramCardNumber } from '$lib/telegram';
  import { loyaltyCardSettings } from '$lib/stores/customization';

  interface Props {
    user: User;
  }

  let { user }: Props = $props();

  // State for merged user data (Telegram + JSON)
  let displayUser = $state<User>(user);
  let isLoading = $state(true);

  // State for error handling and retry
  let registrationError = $state<string | null>(null);
  let isRegistering = $state(false);
  let retryCount = $state(0);
  const MAX_RETRIES = 3;

  // Get user initials
  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  };

  // Retry registration function
  async function retryRegistration() {
    if (retryCount >= MAX_RETRIES) {
      registrationError = 'Превышено количество попыток. Перезапустите приложение.';
      return;
    }

    retryCount++;
    registrationError = null;
    isRegistering = true;

    const telegramUser = await waitForTelegramUser(5000);
    if (!telegramUser) {
      registrationError = `Не удалось загрузить данные Telegram. Попытка ${retryCount}/${MAX_RETRIES}`;
      isRegistering = false;
      return;
    }

    try {
      const result = await initializeUser(undefined, telegramUser);

      if (result && result.success) {
        displayUser = { ...displayUser, balance: result.user.current_balance };
        registrationError = null;
        retryCount = 0;  // Reset on success
      } else {
        registrationError = `Ошибка загрузки. Попытка ${retryCount}/${MAX_RETRIES}`;
      }
    } catch (error) {
      registrationError = `Ошибка сервера. Попытка ${retryCount}/${MAX_RETRIES}`;
      console.error('[ProfileCard] Retry failed:', error);
    } finally {
      isRegistering = false;
    }
  }

  // Initialize Telegram user on mount
  onMount(async () => {
    const telegramUser = await waitForTelegramUser(5000);

    // If running in Telegram Web App, initialize user
    if (telegramUser) {
      // STEP 1: Update UI IMMEDIATELY (synchronous)
      const newName = `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`.trim();

      displayUser = {
        ...user,
        name: newName,
        cardNumber: formatTelegramCardNumber(telegramUser.id),
        balance: 0  // Show 0 until API confirms (prevents misleading demo balance)
      };

      isLoading = false;

      // STEP 2: Load balance in background (with error handling)
      isRegistering = true;
      try {
        const result = await initializeUser(undefined, telegramUser);

        if (result && result.success) {
          displayUser = {
            ...displayUser,
            balance: result.user.current_balance,
          };
          registrationError = null;  // Clear error on success
        } else {
          // Show error to user
          registrationError = 'Не удалось загрузить данные. Попробуйте перезапустить приложение.';
          console.error('[ProfileCard] Failed to initialize user:', result);
        }
      } catch (error) {
        // Show error to user
        registrationError = 'Ошибка подключения к серверу. Проверьте интернет и перезапустите приложение.';
        console.error('[ProfileCard] API error:', error);
      } finally {
        isRegistering = false;
      }
    } else {
      // Not in Telegram Web App - use demo user
      displayUser = user;
      isLoading = false;
    }
  });
</script>

<div
  class="profile-card"
  class:no-shimmer={!$loyaltyCardSettings.showShimmer}
  style="
    --card-gradient-start: {$loyaltyCardSettings.gradientStart};
    --card-gradient-end: {$loyaltyCardSettings.gradientEnd};
    --card-text-color: {$loyaltyCardSettings.textColor};
    --card-accent-color: {$loyaltyCardSettings.accentColor};
    --card-badge-bg: {$loyaltyCardSettings.badgeBg};
    --card-badge-text: {$loyaltyCardSettings.badgeText};
    --card-border-radius: {$loyaltyCardSettings.borderRadius}px;
  "
>
  {#if registrationError}
    <div class="error-banner">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{registrationError}</span>
      {#if retryCount < MAX_RETRIES}
        <button class="retry-button" onclick={retryRegistration} disabled={isRegistering}>
          {isRegistering ? 'Повтор...' : 'Повторить'}
        </button>
      {/if}
    </div>
  {/if}

  <div class="profile-header">
    <div class="profile-avatar">
      {getInitials(displayUser.name)}
    </div>
    <div class="profile-info">
      <h2 class="profile-name">{displayUser.name}</h2>
      <p class="profile-status">Карта № {displayUser.cardNumber}</p>
    </div>
  </div>

  <div class="profile-stats">
    <div class="profile-stat-item">
      <div class="profile-stat-value profile-stat-orange">{displayUser.totalPurchases}</div>
      <div class="profile-stat-label">Покупок за 45 дней</div>
    </div>
    <div class="profile-stat-item">
      <div class="profile-stat-value profile-stat-green">{formatNumber(displayUser.totalSaved)}</div>
      <div class="profile-stat-label">Сэкономлено за 45 дней</div>
    </div>
  </div>
</div>

<style>
  .profile-card {
    background: linear-gradient(135deg, var(--card-gradient-start), var(--card-gradient-end));
    border-radius: var(--card-border-radius);
    padding: 20px;
    box-shadow: 0 25px 50px -12px color-mix(in srgb, var(--card-gradient-start) 50%, transparent);
    border: 1px solid var(--border-color);
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;
    color: var(--card-text-color);
  }

  .profile-card::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      45deg,
      transparent 30%,
      rgba(255, 255, 255, 0.15) 50%,
      transparent 70%
    );
    animation: shimmer 3s infinite;
    pointer-events: none;
  }

  .profile-card.no-shimmer::before {
    display: none;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
    100% {
      transform: translateX(100%) translateY(100%) rotate(45deg);
    }
  }

  .error-banner {
    background: #fee;
    border: 1px solid #fcc;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .error-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .error-text {
    font-size: 14px;
    color: #c00;
    flex: 1;
  }

  .retry-button {
    background: #ef4444;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .retry-button:hover:not(:disabled) {
    background: #dc2626;
  }

  .retry-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    position: relative;
    z-index: 1;
  }

  .profile-avatar {
    width: 72px;
    height: 72px;
    background: var(--card-badge-bg);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--card-badge-text);
    font-size: 24px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .profile-info {
    flex: 1;
  }

  .profile-name {
    font-size: 20px;
    font-weight: bold;
    color: var(--card-text-color);
    margin-bottom: 4px;
  }

  .profile-status {
    color: var(--card-accent-color);
    opacity: 0.9;
    font-size: 14px;
  }

  .profile-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    padding-top: 20px;
    border-top: 1px solid color-mix(in srgb, var(--card-text-color) 30%, transparent);
    position: relative;
    z-index: 1;
  }

  .profile-stat-item {
    text-align: center;
  }

  .profile-stat-value {
    font-size: 32px;
    font-weight: bold;
    margin-bottom: 4px;
    color: var(--card-text-color);
  }

  .profile-stat-orange {
    color: var(--card-text-color);
  }

  .profile-stat-green {
    color: var(--card-text-color);
  }

  .profile-stat-label {
    color: var(--card-accent-color);
    opacity: 0.85;
    font-size: 13px;
    font-weight: 500;
  }

  @media (max-width: 480px) {
    .profile-card {
      padding: 16px;
    }

    .profile-avatar {
      width: 64px;
      height: 64px;
      font-size: 20px;
    }

    .profile-name {
      font-size: 18px;
    }

    .profile-stat-value {
      font-size: 28px;
    }

    .error-banner {
      flex-wrap: wrap;
    }

    .retry-button {
      width: 100%;
      margin-top: 4px;
    }
  }
</style>
