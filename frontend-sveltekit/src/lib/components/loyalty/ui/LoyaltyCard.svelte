<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { User } from '$lib/types/loyalty';
  import { formatNumber, waitForTelegramUser, initializeUser, formatTelegramCardNumber } from '$lib/telegram';
  import { loyaltyCardSettings } from '$lib/stores/customization';

  interface LoyaltyRule {
    icon: string;
    title: string;
    value: string;
  }

  interface LoyaltyRules {
    earning: LoyaltyRule;
    payment: LoyaltyRule;
    expiry: LoyaltyRule;
    detailedRulesLink: string;
    detailedRulesText: string;
  }

  interface Props {
    user: User;
    loyaltyRules: LoyaltyRules;
  }

  let { user, loyaltyRules }: Props = $props();
  const openQRModal = getContext<() => void>('openQRModal');
  const updateUserData = getContext<(cardNumber: string, balance: number, userId?: number) => void>('updateUserData');
  const getPointsName = getContext<() => string>('pointsName');

  // State for merged user data (Telegram + demo)
  let displayUser = $state<User>(user);
  let isLoading = $state(true);

  // HYBRID APPROACH: Initialize Telegram user on mount
  onMount(async () => {
    console.log('[LoyaltyCard] Mounting component...');

    const telegramUser = await waitForTelegramUser(5000);
    console.log('[LoyaltyCard] Telegram user from SDK:', telegramUser);

    if (telegramUser) {
      console.log('[LoyaltyCard] Running in Telegram Web App mode');

      // 🔥 STEP 1: Update UI IMMEDIATELY (synchronous) - like static version
      const newName = `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`.trim();
      console.log('[LoyaltyCard] ⚡ INSTANT UPDATE: Setting name to:', newName);

      displayUser = {
        ...user,
        name: newName,
        cardNumber: formatTelegramCardNumber(telegramUser.id),
      };

      // Update parent layout for QR Modal
      updateUserData(displayUser.cardNumber, displayUser.balance, telegramUser.id);

      isLoading = false;

      // 🔥 STEP 2: Register user in background (asynchronous)
      try {
        console.log('[LoyaltyCard] 📡 Background: Calling initializeUser()...');
        const result = await initializeUser();
        console.log('[LoyaltyCard] 📡 Background: initializeUser() result:', result);

        if (result && result.success) {
          console.log('[LoyaltyCard] 💰 Updating balance from API:', result.user.current_balance);

          displayUser = {
            ...displayUser,
            balance: result.user.current_balance,
          };

          // Update parent layout with new balance
          updateUserData(displayUser.cardNumber, displayUser.balance, telegramUser.id);

          console.log('[LoyaltyCard] ✅ Telegram user registered:', {
            isNewUser: result.isNewUser,
            bonus: result.isNewUser ? '500 Murzikoyns awarded' : 'Welcome back',
            displayUserName: displayUser.name,
            displayUserBalance: displayUser.balance
          });
        } else {
          console.warn('[LoyaltyCard] ⚠️ API failed, but name is already shown');
        }
      } catch (error) {
        console.error('[LoyaltyCard] ❌ Background API failed, but name is already shown:', error);
      }
    } else {
      console.log('[LoyaltyCard] Demo mode: Not running in Telegram Web App');
      console.log('[LoyaltyCard] Using demo user:', user.name);
      displayUser = user;
      isLoading = false;
    }

    console.log('[LoyaltyCard] Mount complete. Final displayUser:', displayUser.name);
  });
</script>

<div
  class="loyalty-card"
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
  <div class="card-header">
    <div class="card-info">
      <div class="user-badge">
        <div class="user-name">{displayUser.name}</div>
        <div class="card-number">Карта: {displayUser.cardNumber}</div>
      </div>
    </div>

    <button class="qr-button" onclick={openQRModal} aria-label="Показать QR-код">
      <img src="/qr-code.png" alt="QR Code" class="qr-code" />
    </button>
  </div>

  <div class="balance">
    <div class="balance-amount">{formatNumber(displayUser.balance)}</div>
    <div class="balance-label">{getPointsName()}</div>
  </div>

  <div class="loyalty-info">
    <div class="loyalty-info-item">
      <div class="loyalty-info-icon">{loyaltyRules.earning.icon}</div>
      <div class="loyalty-info-text">
        <div class="loyalty-info-label">{loyaltyRules.earning.title}</div>
        <div class="loyalty-info-value">{loyaltyRules.earning.value}</div>
      </div>
    </div>

    <div class="loyalty-info-divider"></div>

    <div class="loyalty-info-item">
      <div class="loyalty-info-icon">{loyaltyRules.payment.icon}</div>
      <div class="loyalty-info-text">
        <div class="loyalty-info-label">{loyaltyRules.payment.title}</div>
        <div class="loyalty-info-value">{loyaltyRules.payment.value}</div>
      </div>
    </div>

    <div class="loyalty-info-divider"></div>

    <div class="loyalty-info-item">
      <div class="loyalty-info-icon">{loyaltyRules.expiry.icon}</div>
      <div class="loyalty-info-text">
        <div class="loyalty-info-label">{loyaltyRules.expiry.title}</div>
        <div class="loyalty-info-value">{loyaltyRules.expiry.value}</div>
      </div>
    </div>
  </div>

  <a href={loyaltyRules.detailedRulesLink} class="loyalty-rules-button">
    <span>{loyaltyRules.detailedRulesText}</span>
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
    </svg>
  </a>
</div>

<style>
  .loyalty-card {
    background: linear-gradient(135deg, var(--card-gradient-start), var(--card-gradient-end));
    border-radius: var(--card-border-radius);
    padding: 20px;
    margin: 16px;
    box-shadow: 0 25px 50px -12px color-mix(in srgb, var(--card-gradient-start) 50%, transparent);
    position: relative;
    animation: slideInDown 0.6s ease-out;
    overflow: hidden;
    color: var(--card-text-color);
  }

  .loyalty-card::before {
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

  .loyalty-card.no-shimmer::before {
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

  @keyframes slideInDown {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }

  .card-info {
    color: color-mix(in srgb, var(--card-text-color) 85%, transparent);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .user-badge {
    background: var(--card-badge-bg);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 6px 14px;
    margin-top: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  .user-name {
    color: var(--card-badge-text);
    font-weight: bold;
    font-size: 16px;
    letter-spacing: -0.025em;
  }

  .card-number {
    color: var(--card-gradient-start);
    font-size: 13px;
    font-weight: 600;
    margin-top: 2px;
    letter-spacing: 0.5px;
  }

  .qr-button {
    background: var(--card-badge-bg);
    backdrop-filter: blur(10px);
    padding: 16px;
    border-radius: 16px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    border: none;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .qr-button:hover {
    transform: scale(1.05);
    box-shadow: 0 15px 25px -5px rgba(0, 0, 0, 0.2);
  }

  .qr-button:active {
    transform: scale(0.95);
  }

  .qr-code {
    width: 64px;
    height: 64px;
    display: block;
  }

  .balance {
    text-align: center;
    position: relative;
    z-index: 1;
  }

  .balance-amount {
    font-size: 40px;
    font-weight: bold;
    color: var(--card-text-color);
    letter-spacing: -0.025em;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .balance-label {
    color: var(--card-accent-color);
    opacity: 0.9;
    font-size: 13px;
    font-weight: 500;
    margin-top: 2px;
  }

  .loyalty-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid color-mix(in srgb, var(--card-text-color) 20%, transparent);
    position: relative;
    z-index: 1;
  }

  .loyalty-info-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .loyalty-info-icon {
    font-size: 24px;
    margin-bottom: 4px;
  }

  .loyalty-info-text {
    text-align: center;
  }

  .loyalty-info-label {
    font-size: 11px;
    color: color-mix(in srgb, var(--card-text-color) 70%, transparent);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .loyalty-info-value {
    font-size: 13px;
    color: var(--card-text-color);
    font-weight: bold;
    margin-top: 2px;
  }

  .loyalty-info-divider {
    width: 1px;
    height: 40px;
    background: color-mix(in srgb, var(--card-text-color) 20%, transparent);
  }

  .loyalty-rules-button {
    width: 100%;
    margin-top: 12px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--card-text-color) 15%, transparent);
    backdrop-filter: blur(10px);
    border: 1px solid color-mix(in srgb, var(--card-text-color) 30%, transparent);
    border-radius: 12px;
    color: var(--card-text-color);
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    z-index: 1;
    text-decoration: none;
  }

  .loyalty-rules-button:hover {
    background: color-mix(in srgb, var(--card-text-color) 25%, transparent);
    transform: translateY(-2px);
  }

  .loyalty-rules-button:active {
    transform: translateY(0);
  }

  @media (max-width: 480px) {
    .loyalty-card {
      margin: 16px 12px;
      padding: 20px;
    }

    .balance-amount {
      font-size: 38px;
    }
  }
</style>
