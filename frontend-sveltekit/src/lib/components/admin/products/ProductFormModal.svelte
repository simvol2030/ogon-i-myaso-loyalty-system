<script lang="ts">
	import type { Product, ProductFormData, Category } from '$lib/types/admin';
	import { Modal, Button, Input, Textarea, Select } from '$lib/components/ui';
	import { productsAPI } from '$lib/api/admin/products';

	interface Props {
		isOpen: boolean;
		editingProduct?: Product | null;
		categories: string[]; // Legacy text categories
		categoriesNew?: Category[]; // New categories from table
		onClose: () => void;
		onSuccess?: () => void;
	}

	let { isOpen, editingProduct = null, categories, categoriesNew = [], onClose, onSuccess }: Props = $props();

	let formData = $state<ProductFormData>({
		name: '',
		description: undefined,
		price: 0,
		oldPrice: undefined,
		quantityInfo: undefined,
		image: '',
		category: categories[0] || '',
		categoryId: null,
		sku: undefined,
		isActive: true,
		showOnHome: false,
		isRecommendation: false
	});

	let imagePreview = $state<string | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// MEDIUM FIX #2: Mutual exclusion - product cannot be both "Top Product" and "Recommendation"
	$effect(() => {
		if (formData.showOnHome && formData.isRecommendation) {
			formData.isRecommendation = false;
		}
	});

	$effect(() => {
		if (formData.isRecommendation && formData.showOnHome) {
			formData.showOnHome = false;
		}
	});

	$effect(() => {
		if (isOpen && editingProduct) {
			formData = {
				name: editingProduct.name,
				description: editingProduct.description ?? undefined,
				price: editingProduct.price,
				oldPrice: editingProduct.oldPrice ?? undefined,
				quantityInfo: editingProduct.quantityInfo ?? undefined,
				image: editingProduct.image,
				category: editingProduct.category,
				categoryId: editingProduct.categoryId ?? null,
				sku: editingProduct.sku ?? undefined,
				isActive: editingProduct.isActive,
				showOnHome: editingProduct.showOnHome,
				isRecommendation: editingProduct.isRecommendation
			};
			imagePreview = editingProduct.image;
		} else if (isOpen) {
			formData = {
				name: '',
				description: undefined,
				price: 0,
				oldPrice: undefined,
				quantityInfo: undefined,
				image: '',
				category: categories[0] || '',
				categoryId: null,
				sku: undefined,
				isActive: true,
				showOnHome: false,
				isRecommendation: false
			};
			imagePreview = null;
		}
	});

	const isFormValid = $derived(() => {
		if (!formData.name || formData.name.length < 3) return false;
		if (formData.price <= 0) return false;
		// FIX #2: Image is optional - can be empty or valid URL
		if (formData.image && formData.image.length > 0 && formData.image.length < 3) return false;
		// Either legacy category or new categoryId must be set
		if (!formData.category && !formData.categoryId) return false;
		return true;
	});

	// Category options from new categories table
	const categoryOptions = $derived(() => {
		return [
			{ value: '', label: 'Без категории' },
			...categoriesNew.map(c => ({ value: String(c.id), label: c.name }))
		];
	});

	const handleCategoryChange = (value: string) => {
		formData.categoryId = value ? parseInt(value) : null;
		// Auto-set legacy category from selected category name
		if (value) {
			const selectedCategory = categoriesNew.find(c => c.id === parseInt(value));
			if (selectedCategory) {
				formData.category = selectedCategory.name;
			}
		}
	};

	const handleImageUrlChange = (value: string) => {
		formData.image = value;
		if (value && value.startsWith('http')) {
			imagePreview = value;
		}
	};

	const handleFileUpload = async (e: Event) => {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			error = 'Пожалуйста, выберите изображение';
			return;
		}

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			error = 'Размер изображения не должен превышать 5 МБ';
			return;
		}

		error = null;
		loading = true;

		try {
			// Create preview
			const reader = new FileReader();
			reader.onload = (e) => {
				imagePreview = e.target?.result as string;
			};
			reader.readAsDataURL(file);

			// Upload file to server
			const formDataToUpload = new FormData();
			formDataToUpload.append('image', file);

			const response = await fetch('/api/admin/products/upload', {
				method: 'POST',
				body: formDataToUpload
			});

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'Ошибка загрузки изображения');
			}

			// Save the server URL path to form data
			formData.image = result.data.url;
		} catch (err: any) {
			error = err.message || 'Ошибка загрузки изображения';
			imagePreview = null;
			formData.image = '';
		} finally {
			loading = false;
		}
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		if (!isFormValid()) return;

		loading = true;
		error = null;

		try {
			if (editingProduct) {
				await productsAPI.update(editingProduct.id, formData);
			} else {
				await productsAPI.create(formData);
			}
			onSuccess?.();
			onClose();
		} catch (err: any) {
			error = err.message || 'Ошибка при сохранении товара';
		} finally {
			loading = false;
		}
	};

	// FIX #3: Prevent modal from closing when Delete/Backspace is pressed
	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Delete' || e.key === 'Backspace') {
			// Only prevent default if we're NOT in an input/textarea
			const target = e.target as HTMLElement;
			if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
				e.stopPropagation();
			}
		}
	};
</script>

<Modal {isOpen} onClose={onClose} title={editingProduct ? 'Редактировать товар' : 'Создать товар'} size="lg">
	<form onsubmit={handleSubmit} onkeydown={handleKeyDown}>
		<Input label="Название" bind:value={formData.name} minLength={3} maxLength={200} required />

		<Textarea label="Описание" bind:value={formData.description} maxLength={1000} rows={3} />

		<Input label="Количество/Упаковка" bind:value={formData.quantityInfo} placeholder="1 кг, 500 г, 12 шт" maxLength={50} />

		<div class="form-row">
			<Input label="Цена (₽)" type="number" bind:value={formData.price} min={0} step={0.01} required />
			<Input label="Старая цена (₽)" type="number" bind:value={formData.oldPrice} min={0} step={0.01} />
		</div>

		<!-- Изображение -->
		<div class="image-section">
			<label class="section-label">Изображение товара *</label>

			<div class="image-upload-area">
				<!-- Image URL Input -->
				<Input
					label="URL изображения"
					placeholder="https://example.com/image.jpg"
					value={formData.image}
					onInput={handleImageUrlChange}
					maxLength={500}
				/>

				<!-- OR -->
				<div class="divider">
					<span>или</span>
				</div>

				<!-- File Upload -->
				<div class="file-upload-box">
					<label for="product-image-upload" class="file-upload-label">
						<span class="upload-icon">📁</span>
						<span>Загрузить файл</span>
						<span class="upload-hint">PNG, JPG, GIF до 5 МБ</span>
					</label>
					<input
						type="file"
						id="product-image-upload"
						accept="image/*"
						onchange={handleFileUpload}
						class="file-input"
					/>
				</div>

				<!-- Image Preview -->
				{#if imagePreview}
					<div class="image-preview">
						<img src={imagePreview} alt="Preview" />
					</div>
				{/if}
			</div>
		</div>

		<!-- Категория и SKU -->
		<div class="form-row">
			{#if categoriesNew.length > 0}
				<Select
					label="Категория"
					value={formData.categoryId ? String(formData.categoryId) : ''}
					options={categoryOptions()}
					onChange={handleCategoryChange}
				/>
			{:else}
				<Select label="Категория" bind:value={formData.category} options={categories.map(c => ({ value: c, label: c }))} />
			{/if}
			<Input label="Артикул (SKU)" bind:value={formData.sku} placeholder="ABC-12345" maxLength={50} />
		</div>

		<div class="checkboxes-section">
			<div class="checkbox-row">
				<label>
					<input type="checkbox" bind:checked={formData.isActive} />
					<span>✓ Товар активен</span>
				</label>
			</div>
			<div class="checkbox-row">
				<label>
					<input type="checkbox" bind:checked={formData.showOnHome} disabled={formData.isRecommendation} />
					<span>✓ Показывать на главной (Топовые товары)</span>
				</label>
			</div>
			<div class="checkbox-row">
				<label>
					<input type="checkbox" bind:checked={formData.isRecommendation} disabled={formData.showOnHome} />
					<span>✓ Рекомендация (без цены)</span>
				</label>
			</div>
		</div>

		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		<div class="modal-actions">
			<Button variant="ghost" onclick={onClose} disabled={loading}>Отмена</Button>
			<Button type="submit" variant="primary" disabled={!isFormValid() || loading} {loading}>
				{editingProduct ? 'Сохранить' : 'Создать'}
			</Button>
		</div>
	</form>
</Modal>

<style>
	form { display: flex; flex-direction: column; gap: 1.5rem; }
	.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

	.section-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.75rem;
	}

	.image-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.image-upload-area {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: #9ca3af;
		font-size: 0.875rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: #d1d5db;
	}

	.file-upload-box {
		position: relative;
	}

	.file-upload-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
		border: 2px dashed #d1d5db;
		border-radius: 0.5rem;
		background: #f9fafb;
		cursor: pointer;
		transition: all 0.2s;
	}

	.file-upload-label:hover {
		border-color: #10b981;
		background: #ecfdf5;
	}

	.upload-icon {
		font-size: 2rem;
	}

	.upload-hint {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.file-input {
		position: absolute;
		width: 0.1px;
		height: 0.1px;
		opacity: 0;
		overflow: hidden;
		z-index: -1;
	}

	.image-preview {
		max-width: 400px;
		max-height: 200px;
		overflow: hidden;
		border-radius: 0.5rem;
		border: 1px solid #d1d5db;
	}

	.image-preview img {
		width: 100%;
		height: auto;
		display: block;
	}

	.checkboxes-section { display: flex; flex-direction: column; gap: 0.75rem; }
	.checkbox-row { padding: 1rem; background: #f9fafb; border-radius: 0.5rem; }
	.checkbox-row label { display: flex; align-items: center; gap: 0.75rem; font-size: 0.875rem; cursor: pointer; }
	.checkbox-row input[type='checkbox'] { width: 1.25rem; height: 1.25rem; cursor: pointer; accent-color: #10b981; }
	.error-message { padding: 0.75rem 1rem; background: #fee2e2; color: #991b1b; border-radius: 0.5rem; font-size: 0.875rem; }
	.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }
</style>
