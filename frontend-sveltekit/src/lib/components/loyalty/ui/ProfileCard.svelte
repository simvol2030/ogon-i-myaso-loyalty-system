<script lang="ts">
  import { onMount } from 'svelte';
  import type { User } from '$lib/types/loyalty';
  import { formatNumber, initializeUser, getTelegramUser } from '$lib/telegram';

  interface Props {
    user: User;
  }

  let { user }: Props = $props();

  // State for merged user data (Telegram + JSON)
  let displayUser = $state<User>(user);
  let isLoading = $state(true);

  // Get user initials
  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  };

  // Initialize Telegram user on mount
  onMount(async () => {
    console.log('[ProfileCard] Mounting component...');

    const telegramUser = getTelegramUser();
    console.log('[ProfileCard] Telegram user from SDK:', telegramUser);

    // If running in Telegram Web App, initialize user
    if (telegramUser) {
      console.log('[ProfileCard] Running in Telegram Web App mode');
      try {
        // TODO: Extract store_id from URL parameter when implementing QR codes
        // For now, store_id is undefined (will be added later)
        console.log('[ProfileCard] Calling initializeUser()...');
        const result = await initializeUser();
        console.log('[ProfileCard] initializeUser() result:', result);

        if (result && result.success) {
          // Merge Telegram user data with existing user structure
          const newName = `${result.user.first_name}${result.user.last_name ? ' ' + result.user.last_name : ''}`;
          console.log('[ProfileCard] Updating displayUser with name:', newName, 'balance:', result.user.current_balance);

          displayUser = {
            ...user,
            name: newName,
            currentBalance: result.user.current_balance,
            // Keep other fields from demo user.json for now
            // (totalPurchases, totalSaved, etc. will come from database later)
          };

          console.log('[ProfileCard] Telegram user initialized:', {
            isNewUser: result.isNewUser,
            bonus: result.isNewUser ? '500 Murzikoyns awarded' : 'Welcome back',
            displayUserName: displayUser.name,
            displayUserBalance: displayUser.currentBalance
          });
        } else {
          console.error('[ProfileCard] initializeUser() returned unsuccessful result');
        }
      } catch (error) {
        console.error('[ProfileCard] Failed to initialize Telegram user:', error);
        // Fall back to demo user from props
        displayUser = user;
      }
    } else {
      // Not in Telegram Web App - use demo user
      console.log('[ProfileCard] Demo mode: Not running in Telegram Web App');
      console.log('[ProfileCard] Using demo user:', user.name);
      displayUser = user;
    }

    isLoading = false;
    console.log('[ProfileCard] Mount complete. Final displayUser:', displayUser.name);
  });
</script>

<div class="profile-card">
  <div class="profile-header">
    <div class="profile-avatar">
      {getInitials(displayUser.name)}
    </div>
    <div class="profile-info">
      <h2 class="profile-name">{displayUser.name}</h2>
      <p class="profile-status">Статус: VIP клиент 🌟</p>
    </div>
  </div>

  <div class="profile-stats">
    <div class="profile-stat-item">
      <div class="profile-stat-value profile-stat-orange">{displayUser.totalPurchases}</div>
      <div class="profile-stat-label">Покупок</div>
    </div>
    <div class="profile-stat-item">
      <div class="profile-stat-value profile-stat-green">{formatNumber(displayUser.totalSaved)}</div>
      <div class="profile-stat-label">Сэкономлено</div>
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
  }
</style>
