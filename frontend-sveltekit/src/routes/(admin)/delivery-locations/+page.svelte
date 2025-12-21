<script lang="ts">
	import { onMount } from 'svelte';
	import { deliveryLocationsAPI, type DeliveryLocation } from '$lib/api/admin/delivery-locations';

	// State
	let loading = $state(true);
	let locations = $state<DeliveryLocation[]>([]);
	let error = $state('');
	let success = $state('');

	// Pagination
	let currentPage = $state(1);
	let totalPages = $state(1);
	let total = $state(0);
	let limit = $state(50);

	// Search and filter
	let searchQuery = $state('');
	let filterEnabled = $state<boolean | undefined>(undefined);

	// Modal state
	let showModal = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let editingLocation = $state<DeliveryLocation | null>(null);

	// Form data
	let formName = $state('');
	let formPrice = $state('');
	let formEnabled = $state(true);
	let formSubmitting = $state(false);

	// Delete confirmation
	let deleteConfirmId = $state<number | null>(null);

	// Load locations
	async function loadLocations() {
		loading = true;
		error = '';

		try {
			const params: any = {
				page: currentPage,
				limit
			};

			if (searchQuery.trim()) {
				params.search = searchQuery.trim();
			}

			if (filterEnabled !== undefined) {
				params.enabled = filterEnabled;
			}

			const response = await deliveryLocationsAPI.list(params);
			locations = response.data;
			currentPage = response.pagination.page;
			totalPages = response.pagination.totalPages;
			total = response.pagination.total;
		} catch (e: any) {
			error = e.message || 'Failed to load locations';
		} finally {
			loading = false;
		}
	}

	// Search handler with debounce
	let searchTimeout: number | null = null;
	function handleSearch() {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		searchTimeout = setTimeout(() => {
			currentPage = 1;
			loadLocations();
		}, 500) as unknown as number;
	}

	// Filter handler
	function handleFilterChange() {
		currentPage = 1;
		loadLocations();
	}

	// Pagination
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
			loadLocations();
		}
	}

	// Open create modal
	function openCreateModal() {
		modalMode = 'create';
		formName = '';
		formPrice = '';
		formEnabled = true;
		editingLocation = null;
		showModal = true;
	}

	// Open edit modal
	function openEditModal(location: DeliveryLocation) {
		modalMode = 'edit';
		formName = location.name;
		formPrice = (location.price / 100).toString(); // Convert kopeks to rubles
		formEnabled = location.is_enabled;
		editingLocation = location;
		showModal = true;
	}

	// Close modal
	function closeModal() {
		showModal = false;
		formName = '';
		formPrice = '';
		formEnabled = true;
		editingLocation = null;
	}

	// Submit form
	async function handleSubmit() {
		if (!formName.trim() || formPrice === '' || formPrice === null || formPrice === undefined) {
			error = 'Заполните все обязательные поля';
			return;
		}

		const priceInRubles = parseFloat(formPrice.toString());
		if (isNaN(priceInRubles) || priceInRubles < 0) {
			error = 'Неверная цена доставки';
			return;
		}

		formSubmitting = true;
		error = '';
		success = '';

		try {
			const priceInKopeks = Math.round(priceInRubles * 100);

			if (modalMode === 'create') {
				await deliveryLocationsAPI.create({
					name: formName.trim(),
					price: priceInKopeks,
					is_enabled: formEnabled
				});
				success = 'Локация добавлена успешно';
			} else if (editingLocation) {
				await deliveryLocationsAPI.update(editingLocation.id, {
					name: formName.trim(),
					price: priceInKopeks,
					is_enabled: formEnabled
				});
				success = 'Локация обновлена успешно';
			}

			closeModal();
			await loadLocations();
			setTimeout(() => success = '', 3000);
		} catch (e: any) {
			error = e.message || 'Failed to save location';
		} finally {
			formSubmitting = false;
		}
	}

	// Toggle enabled status
	async function toggleEnabled(location: DeliveryLocation) {
		try {
			await deliveryLocationsAPI.toggle(location.id);
			await loadLocations();
			success = `Локация ${location.is_enabled ? 'отключена' : 'включена'}`;
			setTimeout(() => success = '', 3000);
		} catch (e: any) {
			error = e.message || 'Failed to toggle location';
		}
	}

	// Delete location
	async function confirmDelete(id: number) {
		deleteConfirmId = id;
	}

	async function executeDelete() {
		if (deleteConfirmId === null) return;

		try {
			await deliveryLocationsAPI.delete(deleteConfirmId);
			success = 'Локация удалена';
			deleteConfirmId = null;
			await loadLocations();
			setTimeout(() => success = '', 3000);
		} catch (e: any) {
			error = e.message || 'Failed to delete location';
		}
	}

	function cancelDelete() {
		deleteConfirmId = null;
	}

	// Format price
	function formatPrice(kopeks: number): string {
		return (kopeks / 100).toLocaleString('ru-RU');
	}

	// Load on mount
	onMount(() => {
		loadLocations();
	});
</script>

<svelte:head>
	<title>Управление доставкой</title>
</svelte:head>

<div class="page-container">
	<header class="page-header">
		<h1>Локации доставки</h1>
		<button class="btn btn-primary" onclick={openCreateModal}>
			+ Добавить локацию
		</button>
	</header>

	{#if error}
		<div class="alert alert-error">{error}</div>
	{/if}

	{#if success}
		<div class="alert alert-success">{success}</div>
	{/if}

	<!-- Filters -->
	<div class="filters-section">
		<div class="search-box">
			<input
				type="text"
				bind:value={searchQuery}
				oninput={handleSearch}
				placeholder="Поиск по названию..."
				class="search-input"
			/>
		</div>

		<div class="filter-group">
			<label>Статус:</label>
			<select bind:value={filterEnabled} onchange={handleFilterChange} class="filter-select">
				<option value={undefined}>Все</option>
				<option value={true}>Включено</option>
				<option value={false}>Отключено</option>
			</select>
		</div>
	</div>

	<!-- Table -->
	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Загрузка...</p>
		</div>
	{:else if locations.length === 0}
		<div class="empty-state">
			<p>Локации не найдены</p>
		</div>
	{:else}
		<div class="table-container">
			<table class="locations-table">
				<thead>
					<tr>
						<th>ID</th>
						<th>Название</th>
						<th>Цена доставки</th>
						<th>Статус</th>
						<th>Дата создания</th>
						<th>Действия</th>
					</tr>
				</thead>
				<tbody>
					{#each locations as location (location.id)}
						<tr>
							<td>{location.id}</td>
							<td class="location-name">{location.name}</td>
							<td class="price">{formatPrice(location.price)} ₽</td>
							<td>
								<button
									class="status-badge"
									class:enabled={location.is_enabled}
									class:disabled={!location.is_enabled}
									onclick={() => toggleEnabled(location)}
									title="Нажмите чтобы изменить"
								>
									{location.is_enabled ? 'Включено' : 'Отключено'}
								</button>
							</td>
							<td class="date">{new Date(location.created_at).toLocaleDateString('ru-RU')}</td>
							<td class="actions">
								<button class="btn-icon btn-edit" onclick={() => openEditModal(location)} title="Редактировать">
									✏️
								</button>
								<button class="btn-icon btn-delete" onclick={() => confirmDelete(location.id)} title="Удалить">
									🗑️
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="pagination">
				<button
					class="btn btn-secondary"
					onclick={() => goToPage(currentPage - 1)}
					disabled={currentPage === 1}
				>
					« Назад
				</button>

				<span class="page-info">
					Страница {currentPage} из {totalPages} (всего: {total})
				</span>

				<button
					class="btn btn-secondary"
					onclick={() => goToPage(currentPage + 1)}
					disabled={currentPage === totalPages}
				>
					Вперед »
				</button>
			</div>
		{/if}
	{/if}
</div>

<!-- Create/Edit Modal -->
{#if showModal}
	<div class="modal-overlay" onclick={closeModal}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>{modalMode === 'create' ? 'Добавить локацию' : 'Редактировать локацию'}</h2>
				<button class="modal-close" onclick={closeModal}>×</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				<div class="form-group">
					<label for="name">Название *</label>
					<input
						type="text"
						id="name"
						bind:value={formName}
						placeholder="Например: Пермь"
						required
					/>
				</div>

				<div class="form-group">
					<label for="price">Цена доставки (₽) *</label>
					<input
						type="number"
						id="price"
						bind:value={formPrice}
						placeholder="700"
						step="0.01"
						min="0"
						required
					/>
					<small>Будет храниться в копейках в базе данных</small>
				</div>

				<div class="form-group checkbox-group">
					<label>
						<input type="checkbox" bind:checked={formEnabled} />
						Включить локацию
					</label>
				</div>

				<div class="modal-actions">
					<button type="button" class="btn btn-secondary" onclick={closeModal}>
						Отмена
					</button>
					<button type="submit" class="btn btn-primary" disabled={formSubmitting}>
						{formSubmitting ? 'Сохранение...' : 'Сохранить'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if deleteConfirmId !== null}
	<div class="modal-overlay" onclick={cancelDelete}>
		<div class="modal-content modal-small" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Подтверждение удаления</h2>
				<button class="modal-close" onclick={cancelDelete}>×</button>
			</div>

			<p>Вы уверены, что хотите удалить эту локацию доставки?</p>

			<div class="modal-actions">
				<button class="btn btn-secondary" onclick={cancelDelete}>
					Отмена
				</button>
				<button class="btn btn-danger" onclick={executeDelete}>
					Удалить
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page-container {
		padding: 24px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.page-header h1 {
		font-size: 28px;
		font-weight: 700;
		margin: 0;
		color: var(--text-primary);
	}

	.alert {
		padding: 12px 16px;
		border-radius: 8px;
		margin-bottom: 16px;
		font-size: 14px;
	}

	.alert-error {
		background: #fee;
		color: #c33;
		border: 1px solid #fcc;
	}

	.alert-success {
		background: #efe;
		color: #3c3;
		border: 1px solid #cfc;
	}

	.filters-section {
		display: flex;
		gap: 16px;
		margin-bottom: 24px;
		align-items: center;
		flex-wrap: wrap;
	}

	.search-box {
		flex: 1;
		min-width: 250px;
	}

	.search-input {
		width: 100%;
		padding: 10px 16px;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		font-size: 14px;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.filter-group label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.filter-select {
		padding: 8px 12px;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		font-size: 14px;
	}

	.loading,
	.empty-state {
		text-align: center;
		padding: 60px 20px;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--border-color);
		border-top-color: var(--primary-orange);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto 16px;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.table-container {
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		margin-bottom: 24px;
	}

	.locations-table {
		width: 100%;
		border-collapse: collapse;
	}

	.locations-table thead {
		background: var(--bg-light);
	}

	.locations-table th {
		padding: 12px 16px;
		text-align: left;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.locations-table td {
		padding: 12px 16px;
		border-top: 1px solid var(--border-color);
		font-size: 14px;
		color: var(--text-primary);
	}

	.locations-table tbody tr:hover {
		background: var(--bg-light);
	}

	.location-name {
		font-weight: 500;
	}

	.price {
		font-weight: 600;
		color: var(--primary-orange);
	}

	.date {
		color: var(--text-secondary);
		font-size: 13px;
	}

	.status-badge {
		padding: 4px 12px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.status-badge.enabled {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.disabled {
		background: #f8d7da;
		color: #721c24;
	}

	.status-badge:hover {
		opacity: 0.8;
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.btn-icon {
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: 6px;
		font-size: 16px;
		transition: all 0.2s;
	}

	.btn-icon:hover {
		background: var(--bg-light);
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 16px;
	}

	.page-info {
		font-size: 14px;
		color: var(--text-secondary);
	}

	.btn {
		padding: 10px 20px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 600;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--primary-orange);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--primary-orange-dark);
	}

	.btn-secondary {
		background: var(--bg-light);
		color: var(--text-primary);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--border-color);
	}

	.btn-danger {
		background: #dc3545;
		color: white;
	}

	.btn-danger:hover {
		background: #c82333;
	}

	/* Modal styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.modal-content {
		background: white;
		border-radius: 16px;
		padding: 24px;
		max-width: 500px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
		animation: slideUp 0.3s ease;
	}

	.modal-small {
		max-width: 400px;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.modal-header h2 {
		font-size: 20px;
		font-weight: 700;
		margin: 0;
	}

	.modal-close {
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		font-size: 28px;
		cursor: pointer;
		color: var(--text-secondary);
		line-height: 1;
		padding: 0;
	}

	.modal-close:hover {
		color: var(--text-primary);
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		margin-bottom: 8px;
		color: var(--text-primary);
	}

	.form-group input[type="text"],
	.form-group input[type="number"] {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		font-size: 14px;
		box-sizing: border-box;
	}

	.form-group input:focus {
		outline: none;
		border-color: var(--primary-orange);
		box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.1);
	}

	.form-group small {
		display: block;
		margin-top: 4px;
		font-size: 12px;
		color: var(--text-secondary);
	}

	.checkbox-group label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.checkbox-group input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 24px;
	}
</style>
