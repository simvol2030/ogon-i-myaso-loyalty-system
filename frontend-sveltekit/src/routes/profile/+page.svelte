<script lang="ts">
  import ProfileCard from '$lib/components/loyalty/ui/ProfileCard.svelte';
  import LoyaltyRulesCard from '$lib/components/loyalty/ui/LoyaltyRulesCard.svelte';
  import ProfileMenuItem from '$lib/components/loyalty/ui/ProfileMenuItem.svelte';
  import Modal from '$lib/components/loyalty/ui/Modal.svelte';
  import Toast from '$lib/components/loyalty/ui/Toast.svelte';
  import PetsModal from '$lib/components/loyalty/ui/PetsModal.svelte';
  import NotificationsModal from '$lib/components/loyalty/ui/NotificationsModal.svelte';
  import PaymentModal from '$lib/components/loyalty/ui/PaymentModal.svelte';
  import ReferralModal from '$lib/components/loyalty/ui/ReferralModal.svelte';
  import BirthdayModal from '$lib/components/loyalty/ui/BirthdayModal.svelte';
  import { modalStore } from '$lib/stores/modal.svelte';

  let { data } = $props();
</script>

<div class="profile-page">
  <h2 class="section-header">👤 Мой профиль</h2>

  {#if data.user}
    <ProfileCard user={data.user} />
  {/if}

  {#if data.loyaltyRulesDetailed}
    <LoyaltyRulesCard rulesData={data.loyaltyRulesDetailed} />
  {/if}

  {#if data.profileMenu && data.profileMenu.length > 0}
    <div class="profile-menu-list">
      {#each data.profileMenu as item}
        <ProfileMenuItem {item} />
      {/each}
    </div>
  {/if}
</div>

<!-- Modals -->
{#if modalStore.type === 'pets'}
  <Modal title="🐾 Мои питомцы" size="large">
    <PetsModal />
  </Modal>
{:else if modalStore.type === 'notifications'}
  <Modal title="🔔 Уведомления">
    <NotificationsModal />
  </Modal>
{:else if modalStore.type === 'payment'}
  <Modal title="💳 Способы оплаты" size="large">
    <PaymentModal />
  </Modal>
{:else if modalStore.type === 'referral'}
  <Modal title="🎁 Пригласить друзей">
    <ReferralModal />
  </Modal>
{:else if modalStore.type === 'birthday'}
  <Modal title="🎂 День рождения">
    <BirthdayModal />
  </Modal>
{/if}

<!-- Toast Notifications -->
<Toast />

<style>
  .profile-page {
    padding: 0 16px;
    padding-bottom: 24px;
  }

  .section-header {
    font-size: 24px;
    font-weight: bold;
    color: var(--text-primary);
    margin: 16px 0 20px 0;
    letter-spacing: -0.025em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .profile-menu-list {
    margin-top: 16px;
  }

  @media (max-width: 480px) {
    .profile-page {
      padding: 0 12px 20px 12px;
    }

    .section-header {
      font-size: 22px;
      margin: 12px 0 16px 0;
    }
  }
</style>
