<script lang="ts">
	import type { Category, CategoryFormData } from '$lib/types/admin';
	import { Modal, Button, Input, Textarea, Select } from '$lib/components/ui';
	import { categoriesAPI } from '$lib/api/admin/categories';

	interface Props {
		isOpen: boolean;
		editingCategory?: Category | null;
		categories: Category[]; // Root categories for parent selection
		onClose: () => void;
		onSuccess?: () => void;
	}

	let { isOpen, editingCategory = null, categories, onClose, onSuccess }: Props = $props();

	let formData = $state<CategoryFormData>({
		name: '',
		description: undefined,
		image: undefined,
		parentId: null,
		isActive: true
	});

	let imagePreview = $state<string | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (isOpen && editingCategory) {
			formData = {
				name: editingCategory.name,
				description: editingCategory.description ?? undefined,
				image: editingCategory.image ?? undefined,
				parentId: editingCategory.parentId,
				isActive: editingCategory.isActive
			};
			imagePreview = editingCategory.image;
		} else if (isOpen) {
			formData = {
				name: '',
				description: undefined,
				image: undefined,
				parentId: null,
				isActive: true
			};
			imagePreview = null;
		}
	});

	const isFormValid = $derived(() => {
		if (!formData.name || formData.name.trim().length < 2) return false;
		return true;
	});

	// Filter out the current category from parent options (can't be parent of itself)
	const parentOptions = $derived(() => {
		const filtered = editingCategory
			? categories.filter(c => c.id !== editingCategory.id)
			: categories;
		return [
			{ value: '', label: 'Без родительской категории' },
			...filtered.map(c => ({ value: String(c.id), label: c.name }))
		];
	});

	const handleImageUrlChange = (value: string) => {
		formData.image = value || undefined;
		if (value && value.startsWith('http')) {
			imagePreview = value;
		} else if (value && value.startsWith('/')) {
			imagePreview = value;
		}
	};

	const handleFileUpload = async (e: Event) => {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			error = 'Пожалуйста, выберите изображение';
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			error = 'Размер изображения не должен превышать 5 МБ';
			return;
		}

		error = null;
		loading = true;

		try {
			const reader = new FileReader();
			reader.onload = (e) => {
				imagePreview = e.target?.result as string;
			};
			reader.readAsDataURL(file);

			const result = await categoriesAPI.uploadImage(file);
			formData.image = result.url;
		} catch (err: any) {
			error = err.message || 'Ошибка загрузки изображения';
			imagePreview = null;
			formData.image = undefined;
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
			const dataToSend = {
				...formData,
				parentId: formData.parentId ? parseInt(String(formData.parentId)) : null
			};

			if (editingCategory) {
				await categoriesAPI.update(editingCategory.id, dataToSend);
			} else {
				await categoriesAPI.create(dataToSend);
			}
			onSuccess?.();
			onClose();
		} catch (err: any) {
			error = err.message || 'Ошибка при сохранении категории';
		} finally {
			loading = false;
		}
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Delete' || e.key === 'Backspace') {
			const target = e.target as HTMLElement;
			if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
				e.stopPropagation();
			}
		}
	};

	const handleParentChange = (value: string) => {
		formData.parentId = value ? parseInt(value) : null;
	};
</script>

<Modal {isOpen} onClose={onClose} title={editingCategory ? 'Редактировать категорию' : 'Создать категорию'} size="md">
	<form onsubmit={handleSubmit} onkeydown={handleKeyDown}>
		<Input
			label="Название категории"
			bind:value={formData.name}
			minLength={2}
			maxLength={100}
			required
			placeholder="Например: Корма для собак"
		/>

		<Textarea
			label="Описание"
			bind:value={formData.description}
			maxLength={500}
			rows={3}
			placeholder="Краткое описание категории (необязательно)"
		/>

		<Select
			label="Родительская категория"
			value={formData.parentId ? String(formData.parentId) : ''}
			options={parentOptions()}
			onChange={handleParentChange}
		/>

		<!-- Изображение -->
		<div class="image-section">
			<label class="section-label">Изображение категории</label>

			<div class="image-upload-area">
				<Input
					label="URL изображения"
					placeholder="https://example.com/image.jpg"
					value={formData.image || ''}
					onInput={handleImageUrlChange}
					maxLength={500}
				/>

				<div class="divider">
					<span>или</span>
				</div>

				<div class="file-upload-box">
					<label for="category-image-upload" class="file-upload-label">
						<span class="upload-icon">📁</span>
						<span>Загрузить файл</span>
						<span class="upload-hint">PNG, JPG, GIF до 5 МБ</span>
					</label>
					<input
						type="file"
						id="category-image-upload"
						accept="image/*"
						onchange={handleFileUpload}
						class="file-input"
					/>
				</div>

				{#if imagePreview}
					<div class="image-preview">
						<img src={imagePreview} alt="Preview" />
						<button
							type="button"
							class="remove-image"
							onclick={() => {
								imagePreview = null;
								formData.image = undefined;
							}}
						>
							✕
						</button>
					</div>
				{/if}
			</div>
		</div>

		<div class="checkboxes-section">
			<div class="checkbox-row">
				<label>
					<input type="checkbox" bind:checked={formData.isActive} />
					<span>✓ Категория активна (отображается в каталоге)</span>
				</label>
			</div>
		</div>

		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		<div class="modal-actions">
			<Button variant="ghost" onclick={onClose} disabled={loading}>Отмена</Button>
			<Button type="submit" variant="primary" disabled={!isFormValid() || loading} {loading}>
				{editingCategory ? 'Сохранить' : 'Создать'}
			</Button>
		</div>
	</form>
</Modal>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

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
		position: relative;
		max-width: 200px;
		overflow: hidden;
		border-radius: 0.5rem;
		border: 1px solid #d1d5db;
	}

	.image-preview img {
		width: 100%;
		height: auto;
		display: block;
	}

	.remove-image {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
	}

	.remove-image:hover {
		background: rgba(0, 0, 0, 0.8);
	}

	.checkboxes-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.checkbox-row {
		padding: 1rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.checkbox-row label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.checkbox-row input[type='checkbox'] {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
		accent-color: #10b981;
	}

	.error-message {
		padding: 0.75rem 1rem;
		background: #fee2e2;
		color: #991b1b;
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}
</style>
