<script lang="ts">
  import { modalStore } from '$lib/stores/modal.svelte';
  import { API_BASE_URL } from '$lib/config';

  // Get current Telegram user ID
  let telegramUserId: number | null = null;

  // State
  let month = $state('');
  let day = $state('');
  let saving = $state(false);
  let error = $state('');
  let success = $state(false);

  // Try to get Telegram user
  $effect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      telegramUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
    }
  });

  // Month options
  const months = [
    { value: '01', label: 'Январь' },
    { value: '02', label: 'Февраль' },
    { value: '03', label: 'Март' },
    { value: '04', label: 'Апрель' },
    { value: '05', label: 'Май' },
    { value: '06', label: 'Июнь' },
    { value: '07', label: 'Июль' },
    { value: '08', label: 'Август' },
    { value: '09', label: 'Сентябрь' },
    { value: '10', label: 'Октябрь' },
    { value: '11', label: 'Ноябрь' },
    { value: '12', label: 'Декабрь' }
  ];

  // Day options based on month
  const getDaysInMonth = (m: string): number => {
    const daysInMonth: Record<string, number> = {
      '01': 31, '02': 29, '03': 31, '04': 30,
      '05': 31, '06': 30, '07': 31, '08': 31,
      '09': 30, '10': 31, '11': 30, '12': 31
    };
    return daysInMonth[m] || 31;
  };

  const maxDays = $derived(getDaysInMonth(month));

  // Validation
  const isValid = $derived(month && day && parseInt(day) <= maxDays);

  // Save birthday
  async function saveBirthday() {
    if (!isValid || !telegramUserId) {
      error = 'Пожалуйста, выберите месяц и день';
      return;
    }

    saving = true;
    error = '';

    try {
      const birthday = `${month}-${day.padStart(2, '0')}`;

      const response = await fetch(`${API_BASE_URL}/profile/birthday`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId,
          birthday
        })
      });

      const result = await response.json();

      if (result.success) {
        success = true;
        setTimeout(() => {
          modalStore.close();
        }, 1500);
      } else {
        error = result.error || 'Не удалось сохранить';
      }
    } catch (err) {
      console.error('Error saving birthday:', err);
      error = 'Ошибка соединения с сервером';
    } finally {
      saving = false;
    }
  }
</script>

<div class="birthday-modal">
  {#if success}
    <div class="success-message">
      <span class="success-icon">🎉</span>
      <p>День рождения сохранён!</p>
    </div>
  {:else}
    <p class="description">
      Укажите ваш день рождения, чтобы получать персональные поздравления и бонусы!
    </p>

    <div class="date-inputs">
      <div class="input-group">
        <label for="month">Месяц</label>
        <select id="month" bind:value={month}>
          <option value="">Выберите</option>
          {#each months as m}
            <option value={m.value}>{m.label}</option>
          {/each}
        </select>
      </div>

      <div class="input-group">
        <label for="day">День</label>
        <select id="day" bind:value={day} disabled={!month}>
          <option value="">Выберите</option>
          {#each Array.from({ length: maxDays }, (_, i) => i + 1) as d}
            <option value={String(d)}>{d}</option>
          {/each}
        </select>
      </div>
    </div>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    <div class="actions">
      <button class="btn-cancel" onclick={() => modalStore.close()}>
        Отмена
      </button>
      <button class="btn-save" onclick={saveBirthday} disabled={!isValid || saving}>
        {saving ? 'Сохранение...' : 'Сохранить'}
      </button>
    </div>

    <p class="note">
      <span class="note-icon">ℹ️</span>
      Мы не храним год рождения — только день и месяц
    </p>
  {/if}
</div>

<style>
  .birthday-modal {
    padding: 8px 0;
  }

  .description {
    color: var(--text-secondary);
    font-size: 14px;
    margin: 0 0 20px 0;
    line-height: 1.5;
  }

  .date-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-group label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .input-group select {
    padding: 12px;
    font-size: 16px;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    appearance: none;
    cursor: pointer;
  }

  .input-group select:focus {
    outline: none;
    border-color: var(--primary-orange);
  }

  .input-group select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-message {
    background: #fee;
    color: #c00;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .btn-cancel, .btn-save {
    flex: 1;
    padding: 14px;
    font-size: 15px;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: var(--bg-secondary);
    color: var(--text-secondary);
  }

  .btn-cancel:hover {
    background: var(--border-color);
  }

  .btn-save {
    background: linear-gradient(135deg, var(--primary-orange), var(--accent-red));
    color: white;
  }

  .btn-save:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3);
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .note-icon {
    flex-shrink: 0;
  }

  .success-message {
    text-align: center;
    padding: 20px;
  }

  .success-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
  }

  .success-message p {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
</style>
