<script lang="ts">
	import type { PageData } from './$types';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button, Select } from '$lib/components/ui';
	import { campaignsAPI, type Campaign } from '$lib/api/admin/campaigns';
	import ConfirmModal from '$lib/components/admin/clients/ConfirmModal.svelte';

	let { data }: { data: PageData } = $props();

	// Filters
	let statusFilter = $state(data.filters.status || '');

	// Modals
	let deleteModalOpen = $state(false);
	let sendModalOpen = $state(false);
	let selectedCampaign = $state<Campaign | null>(null);
	let actionLoading = $state(false);

	// Status labels
	const statusLabels: Record<string, { label: string; color: string }> = {
		draft: { label: 'Черновик', color: '#6b7280' },
		scheduled: { label: 'Запланирована', color: '#3b82f6' },
		sending: { label: 'Отправляется', color: '#f59e0b' },
		completed: { label: 'Завершена', color: '#10b981' },
		cancelled: { label: 'Отменена', color: '#ef4444' }
	};

	// Apply filters
	const applyFilters = () => {
		const params = new URLSearchParams();
		if (statusFilter) params.set('status', statusFilter);
		goto(`/campaigns?${params.toString()}`);
	};

	// Reset filters
	const resetFilters = () => {
		statusFilter = '';
		goto('/campaigns');
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

	// Open send confirmation
	const openSendModal = (campaign: Campaign) => {
		selectedCampaign = campaign;
		sendModalOpen = true;
	};

	// Send campaign
	const confirmSend = async () => {
		if (!selectedCampaign) return;
		actionLoading = true;
		try {
			await campaignsAPI.send(selectedCampaign.id);
			await invalidateAll();
			sendModalOpen = false;
		} catch (error) {
			console.error('Error sending campaign:', error);
			alert('Ошибка при отправке рассылки');
		} finally {
			actionLoading = false;
		}
	};

	// Open delete confirmation
	const openDeleteModal = (campaign: Campaign) => {
		selectedCampaign = campaign;
		deleteModalOpen = true;
	};

	// Delete campaign
	const confirmDelete = async () => {
		if (!selectedCampaign) return;
		actionLoading = true;
		try {
			await campaignsAPI.delete(selectedCampaign.id);
			await invalidateAll();
			deleteModalOpen = false;
		} catch (error) {
			console.error('Error deleting campaign:', error);
			alert('Ошибка при удалении рассылки');
		} finally {
			actionLoading = false;
		}
	};

	// Cancel campaign
	const cancelCampaign = async (campaign: Campaign) => {
		if (!confirm('Отменить рассылку?')) return;
		try {
			await campaignsAPI.cancel(campaign.id);
			await invalidateAll();
		} catch (error) {
			console.error('Error cancelling campaign:', error);
			alert('Ошибка при отмене рассылки');
		}
	};

	const draftCount = $derived(data.campaigns.filter((c: Campaign) => c.status === 'draft').length);
	const scheduledCount = $derived(data.campaigns.filter((c: Campaign) => c.status === 'scheduled').length);
</script>

<svelte:head>
	<title>Рассылки - Loyalty Admin</title>
</svelte:head>

<div class="campaigns-page">
	<div class="page-header">
		<div>
			<h1>Рассылки</h1>
			<p class="text-muted">
				Всего: {data.pagination.total} | Черновиков: {draftCount} | Запланировано: {scheduledCount}
			</p>
		</div>

		<Button variant="primary" onclick={() => goto('/campaigns/new')}>+ Создать рассылку</Button>
	</div>

	<!-- Фильтры -->
	<div class="filters-panel">
		<div class="filters-row">
			<Select
				bind:value={statusFilter}
				options={[
					{ value: '', label: 'Все статусы' },
					{ value: 'draft', label: 'Черновики' },
					{ value: 'scheduled', label: 'Запланированные' },
					{ value: 'sending', label: 'Отправляются' },
					{ value: 'completed', label: 'Завершённые' },
					{ value: 'cancelled', label: 'Отменённые' }
				]}
			/>

			<div class="filter-actions">
				<Button variant="primary" onclick={applyFilters}>Применить</Button>
				<Button variant="ghost" onclick={resetFilters}>Сбросить</Button>
			</div>
		</div>
	</div>

	<!-- Список рассылок -->
	<div class="campaigns-list">
		{#each data.campaigns as campaign (campaign.id)}
			<div class="campaign-card">
				<div class="campaign-header">
					<div class="campaign-title">
						<h3>{campaign.title}</h3>
						<span class="status-badge" style="background: {statusLabels[campaign.status]?.color}">
							{statusLabels[campaign.status]?.label}
						</span>
					</div>
					<div class="campaign-meta">
						<span>Создано: {formatDate(campaign.createdAt)}</span>
						{#if campaign.scheduledAt}
							<span>Запланировано: {formatDate(campaign.scheduledAt)}</span>
						{/if}
					</div>
				</div>

				<div class="campaign-content">
					<p class="message-preview">{campaign.messageText.slice(0, 150)}{campaign.messageText.length > 150 ? '...' : ''}</p>

					{#if campaign.messageImage}
						<div class="has-image">📷 С изображением</div>
					{/if}
				</div>

				<div class="campaign-stats">
					<div class="stat">
						<span class="stat-value">{campaign.totalRecipients}</span>
						<span class="stat-label">Получателей</span>
					</div>
					<div class="stat">
						<span class="stat-value">{campaign.deliveredCount}</span>
						<span class="stat-label">Доставлено</span>
					</div>
					<div class="stat">
						<span class="stat-value">{campaign.failedCount}</span>
						<span class="stat-label">Ошибок</span>
					</div>
				</div>

				<div class="campaign-actions">
					<Button variant="ghost" onclick={() => goto(`/campaigns/${campaign.id}`)}>
						Подробнее
					</Button>

					{#if campaign.status === 'draft'}
						<Button variant="primary" onclick={() => openSendModal(campaign)}>
							Отправить
						</Button>
						<Button variant="ghost" onclick={() => openDeleteModal(campaign)}>
							Удалить
						</Button>
					{/if}

					{#if campaign.status === 'scheduled'}
						<Button variant="ghost" onclick={() => cancelCampaign(campaign)}>
							Отменить
						</Button>
					{/if}
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<p>Рассылки не найдены</p>
				<Button variant="primary" onclick={() => goto('/campaigns/new')}>
					Создать первую рассылку
				</Button>
			</div>
		{/each}
	</div>
</div>

<!-- Modals -->
<ConfirmModal
	isOpen={sendModalOpen}
	title="Отправить рассылку?"
	message={`Вы уверены, что хотите отправить рассылку "${selectedCampaign?.title}"? Сообщения будут отправлены всем получателям.`}
	confirmText="Отправить"
	confirmVariant="primary"
	onConfirm={confirmSend}
	onCancel={() => (sendModalOpen = false)}
	loading={actionLoading}
/>

<ConfirmModal
	isOpen={deleteModalOpen}
	title="Удалить рассылку?"
	message={`Вы уверены, что хотите удалить рассылку "${selectedCampaign?.title}"?`}
	confirmText="Удалить"
	confirmVariant="danger"
	onConfirm={confirmDelete}
	onCancel={() => (deleteModalOpen = false)}
	loading={actionLoading}
/>

<style>
	.campaigns-page {
		max-width: 1200px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		font-weight: 700;
		color: #111827;
	}

	.text-muted {
		color: #6b7280;
		margin: 0;
	}

	.filters-panel {
		background: white;
		padding: 1.5rem;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		margin-bottom: 1.5rem;
	}

	.filters-row {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.filter-actions {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}

	.campaigns-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.campaign-card {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		padding: 1.5rem;
	}

	.campaign-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.campaign-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.campaign-title h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
	}

	.status-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 500;
		color: white;
	}

	.campaign-meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: #6b7280;
		text-align: right;
	}

	.campaign-content {
		margin-bottom: 1rem;
	}

	.message-preview {
		color: #4b5563;
		margin: 0;
		line-height: 1.5;
	}

	.has-image {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #3b82f6;
	}

	.campaign-stats {
		display: flex;
		gap: 2rem;
		padding: 1rem 0;
		border-top: 1px solid #e5e7eb;
		border-bottom: 1px solid #e5e7eb;
		margin-bottom: 1rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: #111827;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.campaign-actions {
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

		.filters-row {
			flex-direction: column;
		}

		.filter-actions {
			margin-left: 0;
			width: 100%;
		}

		.campaign-header {
			flex-direction: column;
			gap: 0.5rem;
		}

		.campaign-meta {
			text-align: left;
		}

		.campaign-stats {
			flex-wrap: wrap;
			gap: 1rem;
		}

		.campaign-actions {
			flex-wrap: wrap;
		}
	}
</style>
