<script lang="ts">
  import { onMount } from 'svelte';
  import type { User } from '$lib/types/loyalty';
  import { formatNumber, initializeUser, waitForTelegramUser, formatTelegramCardNumber } from '$lib/telegram';

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
      console.log('[ProfileCard] 🔄 Retry: Calling initializeUser() with pre-fetched user...');
      const result = await initializeUser(undefined, telegramUser);

      if (result && result.success) {
        displayUser = { ...displayUser, balance: result.user.current_balance };
        registrationError = null;
        retryCount = 0;  // Reset on success
        console.log('[ProfileCard] ✅ Retry successful, balance:', result.user.current_balance);
      } else {
        registrationError = `Ошибка регистрации. Попытка ${retryCount}/${MAX_RETRIES}`;
      }
    } catch (error) {
      registrationError = `Ошибка сервера. Попытка ${retryCount}/${MAX_RETRIES}`;
      console.error('[ProfileCard] ❌ Retry failed:', error);
    } finally {
      isRegistering = false;
    }
  }

  // Initialize Telegram user on mount
  onMount(async () => {
    console.log('[ProfileCard] Mounting component...');

    const telegramUser = await waitForTelegramUser(5000);
    console.log('[ProfileCard] Telegram user from SDK:', telegramUser);

    // If running in Telegram Web App, initialize user
    if (telegramUser) {
      console.log('[ProfileCard] Running in Telegram Web App mode');

      // STEP 1: Update UI IMMEDIATELY (synchronous)
      const newName = `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`.trim();
      console.log('[ProfileCard] ⚡ INSTANT UPDATE: Setting name to:', newName);

      displayUser = {
        ...user,
        name: newName,
        cardNumber: formatTelegramCardNumber(telegramUser.id),
        balance: 0  // Show 0 until API confirms (prevents misleading demo balance)
      };

      isLoading = false;

      // STEP 2: Register user in background (with error handling)
      isRegistering = true;
      try {
        console.log('[ProfileCard] 📡 Background: Calling initializeUser() with pre-fetched user...');
        const result = await initializeUser(undefined, telegramUser);
        console.log('[ProfileCard] 📡 Background: initializeUser() result:', result);

        if (result && result.success) {
          console.log('[ProfileCard] 💰 Updating balance from API:', result.user.current_balance);

          displayUser = {
            ...displayUser,
            balance: result.user.current_balance,
          };

          registrationError = null;  // Clear error on success

          console.log('[ProfileCard] ✅ Telegram user registered:', {
            isNewUser: result.isNewUser,
            bonus: result.isNewUser ? '500 Murzikoyns awarded' : 'Welcome back',
            displayUserName: displayUser.name,
            displayUserBalance: displayUser.balance
          });
        } else {
          // Show error to user
          registrationError = 'Не удалось зарегистрировать аккаунт. Попробуйте перезапустить приложение.';
          console.warn('[ProfileCard] ⚠️ API returned no result');
        }
      } catch (error) {
        // Show error to user
        registrationError = 'Ошибка подключения к серверу. Проверьте интернет и перезапустите приложение.';
        console.error('[ProfileCard] ❌ Background API failed:', error);
      } finally {
        isRegistering = false;
      }
    } else {
      // Not in Telegram Web App - use demo user
      console.log('[ProfileCard] Demo mode: Not running in Telegram Web App');
      displayUser = user;
      isLoading = false;
    }

    console.log('[ProfileCard] Mount complete. Final displayUser:', displayUser.name);
  });
</script>

<div class="profile-card">
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

  {#if isRegistering}
    <div class="registration-progress">
      <span class="spinner"></span>
      <span>Регистрация...</span>
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
    background: linear-gradient(135deg, var(--primary-orange), var(--primary-orange-dark), var(--accent-red));
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 25px 50px -12px rgba(255, 107, 0, 0.5);
    border: 1px solid var(--border-color);
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;
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

  .registration-progress {
    background: #ffd;
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #660;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #cc0;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
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
    background: linear-gradient(135deg, var(--primary-orange), var(--accent-red));
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
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
    color: white;
    margin-bottom: 4px;
  }

  .profile-status {
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
  }

  .profile-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.3);
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
    color: white;
  }

  .profile-stat-orange {
    color: white;
  }

  .profile-stat-green {
    color: white;
  }

  .profile-stat-label {
    color: rgba(255, 255, 255, 0.85);
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
