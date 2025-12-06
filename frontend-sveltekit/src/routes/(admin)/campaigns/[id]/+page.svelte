<script lang="ts">
	import type { PageData } from './$types';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui';
	import { campaignsAPI } from '$lib/api/admin/campaigns';
	import ConfirmModal from '$lib/components/admin/clients/ConfirmModal.svelte';

	let { data }: { data: PageData } = $props();

	let sendModalOpen = $state(false);
	let cancelModalOpen = $state(false);
	let actionLoading = $state(false);

	const campaign = $derived(data.campaign);
	const recipients = $derived(data.recipients);

	// Status labels
	const statusLabels: Record<string, { label: string; color: string }> = {
		draft: { label: 'Черновик', color: '#6b7280' },
		scheduled: { label: 'Запланирована', color: '#3b82f6' },
		sending: { label: 'Отправляется', color: '#f59e0b' },
		completed: { label: 'Завершена', color: '#10b981' },
		cancelled: { label: 'Отменена', color: '#ef4444' }
	};

	// Format date
	const formatDate = (date: string | null) => {
		if (!date) return '—';
		return new Date(date).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	// Send campaign
	const confirmSend = async () => {
		actionLoading = true;
		try {
			await campaignsAPI.send(campaign.id);
			await invalidateAll();
			sendModalOpen = false;
		} catch (error) {
			console.error('Error sending campaign:', error);
			alert('Ошибка при отправке рассылки');
		} finally {
			actionLoading = false;
		}
	};

	// Cancel campaign
	const confirmCancel = async () => {
		actionLoading = true;
		try {
			await campaignsAPI.cancel(campaign.id);
			await invalidateAll();
			cancelModalOpen = false;
		} catch (error) {
			console.error('Error cancelling campaign:', error);
			alert('Ошибка при отмене рассылки');
		} finally {
			actionLoading = false;
		}
	};

	// Recipient status labels
	const recipientStatusLabels: Record<string, { label: string; color: string }> = {
		pending: { label: 'Ожидает', color: '#6b7280' },
		sent: { label: 'Отправлено', color: '#3b82f6' },
		delivered: { label: 'Доставлено', color: '#10b981' },
		failed: { label: 'Ошибка', color: '#ef4444' }
	};
</script>

<svelte:head>
	<title>{campaign.title} - Рассылки - Loyalty Admin</title>
</svelte:head>

<div class="campaign-detail-page">
	<div class="page-header">
		<Button variant="ghost" onclick={() => goto('/campaigns')}>← К рассылкам</Button>
		<div class="header-content">
			<h1>{campaign.title}</h1>
			<span class="status-badge" style="background: {statusLabels[campaign.status]?.color}">
				{statusLabels[campaign.status]?.label}
			</span>
		</div>
	</div>

	<div class="content-grid">
		<!-- Main info -->
		<div class="card main-info">
			<h2>Информация</h2>

			<div class="info-row">
				<span class="info-label">Создано:</span>
				<span class="info-value">{formatDate(campaign.createdAt)}</span>
			</div>

			{#if campaign.scheduledAt}
				<div class="info-row">
					<span class="info-label">Запланировано:</span>
					<span class="info-value">{formatDate(campaign.scheduledAt)}</span>
				</div>
			{/if}

			{#if campaign.startedAt}
				<div class="info-row">
					<span class="info-label">Начало отправки:</span>
					<span class="info-value">{formatDate(campaign.startedAt)}</span>
				</div>
			{/if}

			{#if campaign.completedAt}
				<div class="info-row">
					<span class="info-label">Завершено:</span>
					<span class="info-value">{formatDate(campaign.completedAt)}</span>
				</div>
			{/if}

			<div class="info-row">
				<span class="info-label">Аудитория:</span>
				<span class="info-value">
					{campaign.targetType === 'all' ? 'Все клиенты' : 'По фильтрам'}
				</span>
			</div>

			<div class="actions">
				{#if campaign.status === 'draft'}
					<Button variant="primary" onclick={() => (sendModalOpen = true)}>Отправить сейчас</Button>
				{/if}
				{#if campaign.status === 'scheduled' || campaign.status === 'sending'}
					<Button variant="ghost" onclick={() => (cancelModalOpen = true)}>Отменить</Button>
				{/if}
			</div>
		</div>

		<!-- Statistics -->
		<div class="card statistics">
			<h2>Статистика</h2>

			<div class="stats-grid">
				<div class="stat-item">
					<span class="stat-value">{campaign.totalRecipients}</span>
					<span class="stat-label">Всего получателей</span>
				</div>
				<div class="stat-item">
					<span class="stat-value">{campaign.sentCount}</span>
					<span class="stat-label">Отправлено</span>
				</div>
				<div class="stat-item success">
					<span class="stat-value">{campaign.deliveredCount}</span>
					<span class="stat-label">Доставлено</span>
				</div>
				<div class="stat-item error">
					<span class="stat-value">{campaign.failedCount}</span>
					<span class="stat-label">Ошибок</span>
				</div>
			</div>

			{#if campaign.totalRecipients > 0}
				<div class="progress-bar">
					<div
						class="progress-fill success"
						style="width: {(campaign.deliveredCount / campaign.totalRecipients) * 100}%"
					></div>
					<div
						class="progress-fill error"
						style="width: {(campaign.failedCount / campaign.totalRecipients) * 100}%"
					></div>
				</div>
			{/if}
		</div>

		<!-- Message preview -->
		<div class="card message-preview">
			<h2>Сообщение</h2>

			{#if campaign.messageImage}
				<div class="message-image">
					<img src={campaign.messageImage} alt="Campaign image" />
				</div>
			{/if}

			<div class="message-text">
				{campaign.messageText}
			</div>

			{#if campaign.buttonText}
				<div class="message-button">
					<span class="button-preview">{campaign.buttonText}</span>
					{#if campaign.buttonUrl}
						<span class="button-url">{campaign.buttonUrl}</span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Recipients -->
		<div class="card recipients">
			<h2>Получатели</h2>

			{#if recipients.recipients && recipients.recipients.length > 0}
				<div class="recipients-list">
					{#each recipients.recipients as recipient}
						<div class="recipient-item">
							<span class="recipient-name">{recipient.userName}</span>
							<span
								class="recipient-status"
								style="background: {recipientStatusLabels[recipient.status]?.color}"
							>
								{recipientStatusLabels[recipient.status]?.label}
							</span>
							{#if recipient.sentAt}
								<span class="recipient-time">{formatDate(recipient.sentAt)}</span>
							{/if}
							{#if recipient.error}
								<span class="recipient-error" title={recipient.error}>⚠️</span>
							{/if}
						</div>
					{/each}
				</div>

				{#if recipients.stats?.total > 50}
					<p class="more-recipients">И ещё {recipients.stats.total - 50} получателей...</p>
				{/if}
			{:else}
				<p class="no-recipients">Получатели ещё не добавлены</p>
			{/if}
		</div>
	</div>
</div>

<!-- Modals -->
<ConfirmModal
	isOpen={sendModalOpen}
	title="Отправить рассылку?"
	message={`Будет отправлено ${campaign.totalRecipients} сообщений. Продолжить?`}
	confirmText="Отправить"
	confirmVariant="primary"
	onConfirm={confirmSend}
	onCancel={() => (sendModalOpen = false)}
	loading={actionLoading}
/>

<ConfirmModal
	isOpen={cancelModalOpen}
	title="Отменить рассылку?"
	message="Оставшиеся сообщения не будут отправлены. Продолжить?"
	confirmText="Отменить"
	confirmVariant="danger"
	onConfirm={confirmCancel}
	onCancel={() => (cancelModalOpen = false)}
	loading={actionLoading}
/>

<style>
	.campaign-detail-page {
		max-width: 1200px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
	}

	.header-content h1 {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}

	.content-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.card {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		padding: 1.5rem;
	}

	.card h2 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
	}

	.info-row {
		display: flex;
		padding: 0.5rem 0;
		border-bottom: 1px solid #f3f4f6;
	}

	.info-row:last-of-type {
		border-bottom: none;
	}

	.info-label {
		width: 150px;
		color: #6b7280;
	}

	.info-value {
		flex: 1;
		color: #111827;
	}

	.actions {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		gap: 0.5rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	.stat-item {
		text-align: center;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.stat-value {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
	}

	.stat-item.success .stat-value {
		color: #10b981;
	}

	.stat-item.error .stat-value {
		color: #ef4444;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.progress-bar {
		display: flex;
		height: 8px;
		background: #e5e7eb;
		border-radius: 4px;
		overflow: hidden;
		margin-top: 1rem;
	}

	.progress-fill {
		height: 100%;
	}

	.progress-fill.success {
		background: #10b981;
	}

	.progress-fill.error {
		background: #ef4444;
	}

	.message-preview {
		grid-column: span 2;
	}

	.message-image {
		margin-bottom: 1rem;
	}

	.message-image img {
		max-width: 300px;
		border-radius: 0.5rem;
	}

	.message-text {
		white-space: pre-wrap;
		line-height: 1.6;
		color: #374151;
	}

	.message-button {
		margin-top: 1rem;
		padding: 1rem;
		background: #f3f4f6;
		border-radius: 0.5rem;
	}

	.button-preview {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: #3b82f6;
		color: white;
		border-radius: 0.375rem;
		font-weight: 500;
	}

	.button-url {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.recipients {
		grid-column: span 2;
	}

	.recipients-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.recipient-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.recipient-name {
		flex: 1;
		font-weight: 500;
	}

	.recipient-status {
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		color: white;
	}

	.recipient-time {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.recipient-error {
		cursor: help;
	}

	.more-recipients {
		text-align: center;
		color: #6b7280;
		margin-top: 1rem;
	}

	.no-recipients {
		text-align: center;
		color: #9ca3af;
		padding: 2rem;
	}

	@media (max-width: 768px) {
		.content-grid {
			grid-template-columns: 1fr;
		}

		.message-preview,
		.recipients {
			grid-column: span 1;
		}

		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
