<script lang="ts">
	import type { PageData } from './$types';
	import { goto, invalidateAll } from '$app/navigation';
	import { Input, Select, Button, Badge, Card } from '$lib/components/ui';
	import type { Category, CategoryFormData } from '$lib/types/admin';
	import { categoriesAPI } from '$lib/api/admin/categories';
	import CategoryFormModal from '$lib/components/admin/categories/CategoryFormModal.svelte';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state(data.filters.search);
	let statusFilter = $state(data.filters.status);
	let parentFilter = $state(data.filters.parent);

	// Modal state
	let formModalOpen = $state(false);
	let editingCategory = $state<Category | null>(null);

	// Drag and drop state
	let draggedItem = $state<Category | null>(null);
	let dragOverId = $state<number | null>(null);

	const applyFilters = () => {
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (statusFilter !== 'all') params.set('status', statusFilter);
		if (parentFilter !== 'all') params.set('parent', parentFilter);
		goto(`/categories?${params.toString()}`);
	};

	const resetFilters = () => {
		searchQuery = '';
		statusFilter = 'all';
		parentFilter = 'all';
		goto('/categories');
	};

	const openCreateModal = () => {
		editingCategory = null;
		formModalOpen = true;
	};

	const openEditModal = (category: Category) => {
		editingCategory = category;
		formModalOpen = true;
	};

	const handleDelete = async (category: Category) => {
		const productCount = category.productCount || 0;
		const message = productCount > 0
			? `Категория "${category.name}" содержит ${productCount} товаров. Скрыть категорию?`
			: `Удалить категорию "${category.name}"?`;

		if (!confirm(message)) return;

		try {
			await categoriesAPI.delete(category.id, productCount > 0);
			await invalidateAll();
		} catch (error: any) {
			alert(error.message || 'Ошибка при удалении категории');
		}
	};

	const toggleActive = async (category: Category) => {
		await categoriesAPI.toggleActive(category.id, !category.isActive);
		await invalidateAll();
	};

	// Drag and drop handlers
	const handleDragStart = (e: DragEvent, category: Category) => {
		draggedItem = category;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
		}
	};

	const handleDragOver = (e: DragEvent, category: Category) => {
		e.preventDefault();
		if (draggedItem && draggedItem.id !== category.id) {
			dragOverId = category.id;
		}
	};

	const handleDragLeave = () => {
		dragOverId = null;
	};

	const handleDrop = async (e: DragEvent, targetCategory: Category) => {
		e.preventDefault();
		dragOverId = null;

		if (!draggedItem || draggedItem.id === targetCategory.id) {
			draggedItem = null;
			return;
		}

		// Calculate new positions
		const categories = [...data.categories];
		const draggedIndex = categories.findIndex(c => c.id === draggedItem!.id);
		const targetIndex = categories.findIndex(c => c.id === targetCategory.id);

		if (draggedIndex === -1 || targetIndex === -1) {
			draggedItem = null;
			return;
		}

		// Remove dragged item and insert at new position
		const [removed] = categories.splice(draggedIndex, 1);
		categories.splice(targetIndex, 0, removed);

		// Update positions
		const items = categories.map((cat, index) => ({
			id: cat.id,
			position: index
		}));

		try {
			await categoriesAPI.reorder(items);
			await invalidateAll();
		} catch (error: any) {
			alert(error.message || 'Ошибка при изменении порядка');
		}

		draggedItem = null;
	};

	const handleDragEnd = () => {
		draggedItem = null;
		dragOverId = null;
	};

	// Move up/down handlers
	const moveUp = async (index: number) => {
		if (index === 0) return;
		const categories = [...data.categories];
		const items = categories.map((cat, i) => ({
			id: cat.id,
			position: i === index ? i - 1 : i === index - 1 ? i + 1 : i
		}));
		await categoriesAPI.reorder(items);
		await invalidateAll();
	};

	const moveDown = async (index: number) => {
		if (index === data.categories.length - 1) return;
		const categories = [...data.categories];
		const items = categories.map((cat, i) => ({
			id: cat.id,
			position: i === index ? i + 1 : i === index + 1 ? i - 1 : i
		}));
		await categoriesAPI.reorder(items);
		await invalidateAll();
	};

	// Get parent options for filter
	const parentOptions = $derived(() => {
		const rootCategories = data.categories.filter(c => !c.parentId);
		return [
			{ value: 'all', label: 'Все категории' },
			{ value: 'root', label: 'Только корневые' },
			...rootCategories.map(c => ({ value: String(c.id), label: `↳ ${c.name}` }))
		];
	});
</script>

<svelte:head>
	<title>Категории - Loyalty Admin</title>
</svelte:head>

<div class="categories-page">
	<div class="page-header">
		<div>
			<h1>Категории</h1>
			<p class="text-muted">Всего: {data.total}</p>
		</div>
		<Button variant="primary" onclick={openCreateModal}>+ Создать категорию</Button>
	</div>

	<div class="filters-panel">
		<div class="search-box">
			<Input placeholder="Поиск..." icon="🔍" bind:value={searchQuery} />
		</div>
		<div class="filters-row">
			<Select
				bind:value={statusFilter}
				options={[
					{ value: 'all', label: 'Все' },
					{ value: 'active', label: 'Активные' },
					{ value: 'inactive', label: 'Скрытые' }
				]}
			/>
			<Select bind:value={parentFilter} options={parentOptions()} />
		</div>
		<div class="filter-actions">
			<Button variant="primary" onclick={applyFilters}>🔍 Применить</Button>
			<Button variant="ghost" onclick={resetFilters}>✕ Сбросить</Button>
		</div>
	</div>

	<div class="categories-list">
		{#each data.categories as category, index (category.id)}
			<div
				class="category-item"
				class:dragging={draggedItem?.id === category.id}
				class:drag-over={dragOverId === category.id}
				draggable="true"
				ondragstart={(e) => handleDragStart(e, category)}
				ondragover={(e) => handleDragOver(e, category)}
				ondragleave={handleDragLeave}
				ondrop={(e) => handleDrop(e, category)}
				ondragend={handleDragEnd}
				role="listitem"
			>
				<div class="drag-handle" title="Перетащите для изменения порядка">
					<span class="drag-icon">☰</span>
				</div>

				<div class="category-image">
					{#if category.image}
						<img src={category.image} alt={category.name} />
					{:else}
						<div class="no-image">📁</div>
					{/if}
				</div>

				<div class="category-info">
					<div class="category-name">
						{#if category.parentId}
							<span class="parent-indicator">↳</span>
						{/if}
						{category.name}
						{#if !category.isActive}
							<Badge variant="secondary">Скрыта</Badge>
						{/if}
					</div>
					<div class="category-meta">
						<span class="slug">/{category.slug}</span>
						<span class="product-count">{category.productCount || 0} товаров</span>
					</div>
				</div>

				<div class="position-controls">
					<button
						class="position-btn"
						onclick={() => moveUp(index)}
						disabled={index === 0}
						title="Переместить выше"
					>
						↑
					</button>
					<button
						class="position-btn"
						onclick={() => moveDown(index)}
						disabled={index === data.categories.length - 1}
						title="Переместить ниже"
					>
						↓
					</button>
				</div>

				<div class="actions">
					<Button variant="ghost" size="sm" onclick={() => toggleActive(category)}>
						{category.isActive ? '👁️' : '👁️‍🗨️'}
					</Button>
					<Button variant="primary" size="sm" onclick={() => openEditModal(category)}>✏️</Button>
					<Button variant="danger" size="sm" onclick={() => handleDelete(category)}>🗑️</Button>
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<p>Категории не найдены</p>
				<Button variant="primary" onclick={openCreateModal}>Создать первую категорию</Button>
			</div>
		{/each}
	</div>
</div>

<CategoryFormModal
	isOpen={formModalOpen}
	editingCategory={editingCategory}
	categories={data.categories.filter(c => !c.parentId)}
	onClose={() => (formModalOpen = false)}
	onSuccess={() => {
		formModalOpen = false;
		invalidateAll();
	}}
/>

<style>
	.categories-page {
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

	.search-box {
		margin-bottom: 1rem;
	}

	.filters-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.filter-actions {
		display: flex;
		gap: 0.75rem;
	}

	.categories-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.category-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		transition: all 0.2s ease;
		cursor: grab;
	}

	.category-item:hover {
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
	}

	.category-item.dragging {
		opacity: 0.5;
		cursor: grabbing;
	}

	.category-item.drag-over {
		border: 2px dashed #3b82f6;
		background: #eff6ff;
	}

	.drag-handle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		color: #9ca3af;
		cursor: grab;
	}

	.drag-handle:hover {
		color: #6b7280;
	}

	.drag-icon {
		font-size: 1.25rem;
	}

	.category-image {
		width: 60px;
		height: 60px;
		border-radius: 0.5rem;
		overflow: hidden;
		background: #f3f4f6;
		flex-shrink: 0;
	}

	.category-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.no-image {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		opacity: 0.3;
	}

	.category-info {
		flex: 1;
		min-width: 0;
	}

	.category-name {
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.parent-indicator {
		color: #9ca3af;
		font-size: 0.875rem;
	}

	.category-meta {
		display: flex;
		gap: 1rem;
		margin-top: 0.25rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.slug {
		font-family: monospace;
		background: #f3f4f6;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	.position-controls {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.position-btn {
		width: 28px;
		height: 28px;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		background: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		color: #6b7280;
		transition: all 0.15s ease;
	}

	.position-btn:hover:not(:disabled) {
		background: #f3f4f6;
		color: #374151;
	}

	.position-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
	}

	.empty-state p {
		color: #6b7280;
		margin-bottom: 1rem;
	}
</style>
