<script lang="ts">
	import type { PageData } from './$types';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui';
	import { triggersAPI, type TriggerTemplate } from '$lib/api/admin/triggers';
	import ConfirmModal from '$lib/components/admin/clients/ConfirmModal.svelte';

	let { data }: { data: PageData } = $props();

	let deleteModalOpen = $state(false);
	let selectedTrigger = $state<TriggerTemplate | null>(null);
	let actionLoading = $state(false);

	// Toggle trigger
	const toggleTrigger = async (trigger: TriggerTemplate) => {
		try {
			await triggersAPI.toggle(trigger.id, !trigger.isActive);
			await invalidateAll();
		} catch (error) {
			console.error('Error toggling trigger:', error);
			alert('Ошибка при изменении статуса триггера');
		}
	};

	// Open delete modal
	const openDeleteModal = (trigger: TriggerTemplate) => {
		selectedTrigger = trigger;
		deleteModalOpen = true;
	};

	// Delete trigger
	const confirmDelete = async () => {
		if (!selectedTrigger) return;
		actionLoading = true;
		try {
			await triggersAPI.delete(selectedTrigger.id);
			await invalidateAll();
			deleteModalOpen = false;
		} catch (error) {
			console.error('Error deleting trigger:', error);
			alert('Ошибка при удалении триггера');
		} finally {
			actionLoading = false;
		}
	};

	// Format date
	const formatDate = (date: string) => {
		return new Date(date).toLocaleDateString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	};

	// Get config description
	const getConfigDescription = (trigger: TriggerTemplate) => {
		if (!trigger.eventConfig) return '';

		const config = trigger.eventConfig;
		const parts = [];

		if (config.days) parts.push(`${config.days} дней`);
		if (config.min_balance) parts.push(`от ${config.min_balance} баллов`);
		if (config.max_balance) parts.push(`до ${config.max_balance} баллов`);
		if (config.count) parts.push(`${config.count} покупок`);
		if (config.years) parts.push(`${config.years} лет`);

		return parts.join(', ');
	};

	const activeCount = $derived(data.triggers.filter((t: TriggerTemplate) => t.isActive).length);
</script>

<svelte:head>
	<title>Триггеры - Loyalty Admin</title>
</svelte:head>

<div class="triggers-page">
	<div class="page-header">
		<div>
			<h1>Триггеры рассылок</h1>
			<p class="text-muted">
				Всего: {data.triggers.length} | Активных: {activeCount}
			</p>
		</div>

		<Button variant="primary" onclick={() => goto('/triggers/new')}>+ Создать триггер</Button>
	</div>

	<div class="info-box">
		<p>
			<strong>Триггеры</strong> — автоматические правила для отправки рассылок.
			Когда условие срабатывает, система создаёт кампанию и отправляет сообщения клиентам.
		</p>
	</div>

	<div class="triggers-list">
		{#each data.triggers as trigger (trigger.id)}
			<div class="trigger-card" class:inactive={!trigger.isActive}>
				<div class="trigger-header">
					<div class="trigger-title">
						<h3>{trigger.name}</h3>
						<span class="event-type">{trigger.eventTypeName}</span>
					</div>

					<label class="toggle-switch">
						<input
							type="checkbox"
							checked={trigger.isActive}
							onchange={() => toggleTrigger(trigger)}
						/>
						<span class="slider"></span>
					</label>
				</div>

				{#if trigger.description}
					<p class="trigger-description">{trigger.description}</p>
				{/if}

				<div class="trigger-config">
					{#if getConfigDescription(trigger)}
						<span class="config-item">⚙️ {getConfigDescription(trigger)}</span>
					{/if}
					{#if trigger.autoSend}
						<span class="config-item auto-send">🚀 Авто-отправка</span>
					{/if}
				</div>

				<div class="trigger-message">
					<p class="message-preview">{trigger.messageTemplate.slice(0, 100)}{trigger.messageTemplate.length > 100 ? '...' : ''}</p>
				</div>

				<div class="trigger-footer">
					<span class="trigger-date">Создан: {formatDate(trigger.createdAt)}</span>

					<div class="trigger-actions">
						<Button variant="ghost" onclick={() => goto(`/triggers/new?edit=${trigger.id}`)}>
							Редактировать
						</Button>
						<Button variant="ghost" onclick={() => openDeleteModal(trigger)}>
							Удалить
						</Button>
					</div>
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<p>Триггеры не созданы</p>
				<Button variant="primary" onclick={() => goto('/triggers/new')}>
					Создать первый триггер
				</Button>
			</div>
		{/each}
	</div>
</div>

<!-- Delete Modal -->
<ConfirmModal
	isOpen={deleteModalOpen}
	title="Удалить триггер?"
	message={`Вы уверены, что хотите удалить триггер "${selectedTrigger?.name}"?`}
	confirmText="Удалить"
	confirmVariant="danger"
	onConfirm={confirmDelete}
	onCancel={() => (deleteModalOpen = false)}
	loading={actionLoading}
/>

<style>
	.triggers-page {
		max-width: 1000px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		font-weight: 700;
	}

	.text-muted {
		color: #6b7280;
		margin: 0;
	}

	.info-box {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 0.5rem;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.info-box p {
		margin: 0;
		color: #1e40af;
		font-size: 0.875rem;
	}

	.triggers-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.trigger-card {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		padding: 1.5rem;
		transition: opacity 0.2s;
	}

	.trigger-card.inactive {
		opacity: 0.6;
	}

	.trigger-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.trigger-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.trigger-title h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.event-type {
		padding: 0.25rem 0.5rem;
		background: #f3f4f6;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		color: #6b7280;
	}

	/* Toggle switch */
	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 48px;
		height: 24px;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #d1d5db;
		transition: 0.3s;
		border-radius: 24px;
	}

	.slider:before {
		position: absolute;
		content: "";
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.3s;
		border-radius: 50%;
	}

	input:checked + .slider {
		background-color: #10b981;
	}

	input:checked + .slider:before {
		transform: translateX(24px);
	}

	.trigger-description {
		color: #6b7280;
		margin: 0 0 0.75rem 0;
		font-size: 0.875rem;
	}

	.trigger-config {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.config-item {
		padding: 0.25rem 0.5rem;
		background: #f9fafb;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		color: #374151;
	}

	.config-item.auto-send {
		background: #ecfdf5;
		color: #059669;
	}

	.trigger-message {
		padding: 0.75rem;
		background: #f9fafb;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
	}

	.message-preview {
		margin: 0;
		color: #4b5563;
		font-size: 0.875rem;
	}

	.trigger-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.75rem;
		border-top: 1px solid #e5e7eb;
	}

	.trigger-date {
		font-size: 0.875rem;
		color: #9ca3af;
	}

	.trigger-actions {
		display: flex;
		gap: 0.5rem;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
	}

	.empty-state p {
		color: #9ca3af;
		font-size: 1.125rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.trigger-footer {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}
	}
</style>
