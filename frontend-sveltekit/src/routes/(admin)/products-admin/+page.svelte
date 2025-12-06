<script lang="ts">
	import type { PageData } from './$types';
	import { goto, invalidateAll } from '$app/navigation';
	import { Input, Select, Button, Badge, Card } from '$lib/components/ui';
	import type { Product, ProductCategory, Category } from '$lib/types/admin';
	import { productsAPI } from '$lib/api/admin/products';
	import ProductFormModal from '$lib/components/admin/products/ProductFormModal.svelte';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state(data.filters.search);
	let statusFilter = $state(data.filters.status);
	let categoryFilter = $state(data.filters.category);

	// CRITICAL FIX: ProductFormModal state
	let formModalOpen = $state(false);
	let editingProduct = $state<Product | null>(null);

	const canEdit = true;
	const canDelete = true;

	// CRITICAL FIX #4: Corrected routing from /products to /products-admin
	const applyFilters = () => {
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (statusFilter !== 'all') params.set('status', statusFilter);
		if (categoryFilter !== 'all') params.set('category', categoryFilter);
		goto(`/products-admin?${params.toString()}`);
	};

	const resetFilters = () => {
		searchQuery = '';
		statusFilter = 'all';
		categoryFilter = 'all';
		goto('/products-admin');
	};

	// CRITICAL FIX #3: Modal handlers
	const openCreateModal = () => {
		editingProduct = null;
		formModalOpen = true;
	};

	const openEditModal = (product: Product) => {
		editingProduct = product;
		formModalOpen = true;
	};

	const handleDelete = async (product: Product) => {
		if (!confirm(`Удалить товар "${product.name}"?`)) return;
		try {
			await productsAPI.delete(product.id);
			await invalidateAll();
		} catch (error) {
			alert('Ошибка при удалении товара');
		}
	};

	const categoryOptions = $derived(() => {
		// Use new categories from table if available, otherwise fallback to legacy
		const categoriesNew = data.categoriesNew as Category[];
		if (categoriesNew && categoriesNew.length > 0) {
			return [
				{ value: 'all', label: 'Все категории' },
				...categoriesNew.map((c) => ({ value: c.name, label: `${c.name} (${c.productCount || 0})` }))
			];
		}
		return [
			{ value: 'all', label: 'Все категории' },
			...data.categories.map((c: ProductCategory) => ({ value: c.name, label: `${c.name} (${c.count})` }))
		];
	});

	const formatCurrency = (num: number) =>
		num.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });

	const getDiscountPercent = (product: Product) => {
		if (!product.oldPrice || product.oldPrice <= product.price) return 0;
		return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
	};

	const toggleActive = async (product: Product) => {
		await productsAPI.toggleActive(product.id, !product.isActive);
		await invalidateAll();
	};
</script>

<svelte:head>
	<title>Товары - Loyalty Admin</title>
</svelte:head>

<div class="products-page">
	<div class="page-header">
		<div>
			<h1>Товары</h1>
			<p class="text-muted">Всего: {data.pagination.total}</p>
		</div>
		<div class="header-actions">
			<a href="/products-admin/import" class="import-btn">
				<span class="icon">📥</span>
				Импорт
			</a>
			<Button variant="primary" onclick={openCreateModal}>+ Создать товар</Button>
		</div>
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
			<Select bind:value={categoryFilter} options={categoryOptions()} />
		</div>
		<div class="filter-actions">
			<Button variant="primary" onclick={applyFilters}>🔍 Применить</Button>
			<Button variant="ghost" onclick={resetFilters}>✕ Сбросить</Button>
		</div>
	</div>

	<div class="products-grid">
		{#each data.products as product (product.id)}
			<Card>
				<div class="product-image">
					{#if product.image}
						<img src={product.image} alt={product.name} />
					{:else}
						<div class="no-image">📦</div>
					{/if}

					{#if getDiscountPercent(product) > 0}
						<Badge variant="danger" class="discount-badge">-{getDiscountPercent(product)}%</Badge>
					{/if}

					{#if !product.isActive}
						<Badge variant="secondary" class="inactive-badge">Скрыт</Badge>
					{/if}
				</div>

				<h3>{product.name}</h3>
				<p class="category">{product.category}</p>

				<div class="price-row">
					{#if product.oldPrice && product.oldPrice > product.price}
						<span class="old-price">{formatCurrency(product.oldPrice)}</span>
					{/if}
					<span class="price">{formatCurrency(product.price)}</span>
				</div>

				<div class="actions">
					<Button variant="ghost" size="sm" onclick={() => toggleActive(product)}>
						{product.isActive ? '👁️ Скрыть' : '👁️ Показать'}
					</Button>
					{#if canEdit}
						<Button variant="primary" size="sm" onclick={() => openEditModal(product)}>✏️</Button>
					{/if}
					{#if canDelete}
						<Button variant="danger" size="sm" onclick={() => handleDelete(product)}>🗑️</Button>
					{/if}
				</div>
			</Card>
		{/each}
	</div>
</div>

<ProductFormModal
	isOpen={formModalOpen}
	editingProduct={editingProduct}
	categories={data.categories.map((c: ProductCategory) => c.name)}
	categoriesNew={data.categoriesNew as Category[]}
	onClose={() => (formModalOpen = false)}
	onSuccess={() => {
		formModalOpen = false;
		invalidateAll();
	}}
/>

<style>
	.products-page {
		max-width: 1400px;
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

	.header-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.import-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--color-bg-secondary, #f3f4f6);
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		color: #374151;
		text-decoration: none;
		transition: background 0.2s;
	}

	.import-btn:hover {
		background: #e5e7eb;
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

	.products-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.product-image {
		position: relative;
		width: 100%;
		padding-top: 100%;
		background: #f3f4f6;
		border-radius: 0.5rem;
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.product-image img {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.no-image {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: 3rem;
		opacity: 0.3;
	}

	:global(.discount-badge) {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
	}

	:global(.inactive-badge) {
		position: absolute;
		bottom: 0.5rem;
		left: 0.5rem;
	}

	h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.category {
		font-size: 0.813rem;
		color: #6b7280;
		margin: 0 0 0.75rem;
	}

	.price-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.old-price {
		text-decoration: line-through;
		color: #9ca3af;
		font-size: 0.875rem;
	}

	.price {
		font-size: 1.25rem;
		font-weight: bold;
		color: #059669;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
