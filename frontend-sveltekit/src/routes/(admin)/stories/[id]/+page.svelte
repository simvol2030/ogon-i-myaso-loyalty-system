<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { StoryItem, StoriesSettings } from '$lib/types/stories';
	import { storiesAPI } from '$lib/api/admin/stories';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	let { data }: { data: PageData } = $props();

	// State
	let highlight = $state(data.highlight);
	let items = $state<StoryItem[]>(data.highlight?.items || []);
	let settings = $state<StoriesSettings | null>(data.settings);
	let analytics = $state(data.analytics);

	// Form states
	let titleEditing = $state(false);
	let titleValue = $state(highlight?.title || '');
	let coverUploading = $state(false);

	// Item modal
	let itemModalOpen = $state(false);
	let editingItem = $state<StoryItem | null>(null);
	let itemForm = $state({
		type: 'photo' as 'photo' | 'video',
		mediaUrl: '',
		thumbnailUrl: '',
		duration: 5,
		linkUrl: '',
		linkText: '',
		isActive: true
	});
	let itemLoading = $state(false);
	let itemError = $state<string | null>(null);

	// Delete modal
	let deleteModalOpen = $state(false);
	let deletingItem = $state<StoryItem | null>(null);

	// Upload state
	let uploading = $state(false);
	let uploadProgress = $state(0);
	let uploadComplete = $state(false);

	// Drag & Drop
	let draggedItem = $state<StoryItem | null>(null);
	let dragOverId = $state<number | null>(null);

	// =====================================================
	// HIGHLIGHT HANDLERS
	// =====================================================

	async function saveTitle() {
		if (!highlight || !titleValue.trim()) return;

		try {
			await storiesAPI.highlights.update(highlight.id, { title: titleValue.trim() });
			highlight = { ...highlight, title: titleValue.trim() };
			titleEditing = false;
		} catch (err: any) {
			alert(err.message || 'Ошибка сохранения');
		}
	}

	async function handleCoverUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !highlight) return;

		coverUploading = true;
		try {
			const result = await storiesAPI.upload.uploadMedia(file);
			await storiesAPI.highlights.update(highlight.id, { coverImage: result.url });
			highlight = { ...highlight, coverImage: result.url };
		} catch (err: any) {
			alert(err.message || 'Ошибка загрузки');
		} finally {
			coverUploading = false;
			input.value = '';
		}
	}

	// =====================================================
	// ITEM HANDLERS
	// =====================================================

	function openAddItem() {
		editingItem = null;
		itemForm = {
			type: 'photo',
			mediaUrl: '',
			thumbnailUrl: '',
			duration: 5,
			linkUrl: '',
			linkText: '',
			isActive: true
		};
		itemError = null;
		itemModalOpen = true;
	}

	function openEditItem(item: StoryItem) {
		editingItem = item;
		itemForm = {
			type: item.type,
			mediaUrl: item.mediaUrl,
			thumbnailUrl: item.thumbnailUrl || '',
			duration: item.duration,
			linkUrl: item.linkUrl || '',
			linkText: item.linkText || '',
			isActive: item.isActive
		};
		itemError = null;
		itemModalOpen = true;
	}

	async function handleItemSubmit() {
		if (!highlight) return;

		if (!itemForm.mediaUrl) {
			itemError = 'Загрузите медиафайл';
			return;
		}

		itemLoading = true;
		itemError = null;

		try {
			if (editingItem) {
				// Update
				const updated = await storiesAPI.items.update(editingItem.id, {
					type: itemForm.type,
					mediaUrl: itemForm.mediaUrl,
					thumbnailUrl: itemForm.thumbnailUrl || null,
					duration: itemForm.duration,
					linkUrl: itemForm.linkUrl || null,
					linkText: itemForm.linkText || null,
					isActive: itemForm.isActive
				});
				items = items.map(i => i.id === updated.id ? updated : i);
			} else {
				// Create
				const created = await storiesAPI.items.create({
					highlightId: highlight.id,
					type: itemForm.type,
					mediaUrl: itemForm.mediaUrl,
					thumbnailUrl: itemForm.thumbnailUrl || null,
					duration: itemForm.duration,
					linkUrl: itemForm.linkUrl || null,
					linkText: itemForm.linkText || null,
					isActive: itemForm.isActive
				});
				items = [...items, created];
			}

			itemModalOpen = false;
		} catch (err: any) {
			itemError = err.message || 'Ошибка сохранения';
		} finally {
			itemLoading = false;
		}
	}

	async function handleMediaUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Determine type
		const isVideo = file.type.startsWith('video/');
		itemForm.type = isVideo ? 'video' : 'photo';

		// Validate video
		if (isVideo && settings) {
			const validation = await storiesAPI.upload.validateVideo(
				file,
				settings.maxVideoDuration,
				settings.maxVideoSizeMb
			);

			if (!validation.valid) {
				itemError = validation.error || 'Видео не прошло валидацию';
				input.value = '';
				return;
			}

			if (validation.duration) {
				itemForm.duration = Math.ceil(validation.duration);
			}
		}

		// Reset upload state
		uploading = true;
		uploadProgress = 0;
		uploadComplete = false;
		itemError = null;

		try {
			const result = await storiesAPI.upload.uploadMedia(file, (percent) => {
				uploadProgress = percent;
			});
			itemForm.mediaUrl = result.url;
			if (result.thumbnailUrl) {
				itemForm.thumbnailUrl = result.thumbnailUrl;
			}
			if (result.duration) {
				itemForm.duration = Math.ceil(result.duration);
			}
			// Show success state briefly
			uploadComplete = true;
			setTimeout(() => {
				uploadComplete = false;
			}, 2000);
		} catch (err: any) {
			itemError = err.message || 'Ошибка загрузки';
		} finally {
			uploading = false;
			uploadProgress = 0;
			input.value = '';
		}
	}

	function confirmDeleteItem(item: StoryItem) {
		deletingItem = item;
		deleteModalOpen = true;
	}

	async function handleDeleteItem() {
		if (!deletingItem) return;

		try {
			await storiesAPI.items.delete(deletingItem.id);
			items = items.filter(i => i.id !== deletingItem!.id);
			deleteModalOpen = false;
			deletingItem = null;
		} catch (err: any) {
			alert(err.message || 'Ошибка удаления');
		}
	}

	async function toggleItemActive(item: StoryItem) {
		try {
			const updated = await storiesAPI.items.update(item.id, { isActive: !item.isActive });
			items = items.map(i => i.id === item.id ? updated : i);
		} catch (err: any) {
			alert(err.message || 'Ошибка');
		}
	}

	// Drag & Drop
	function handleDragStart(e: DragEvent, item: StoryItem) {
		draggedItem = item;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(e: DragEvent, item: StoryItem) {
		e.preventDefault();
		if (draggedItem && draggedItem.id !== item.id) {
			dragOverId = item.id;
		}
	}

	function handleDragLeave() {
		dragOverId = null;
	}

	async function handleDrop(e: DragEvent, targetItem: StoryItem) {
		e.preventDefault();
		dragOverId = null;

		if (!draggedItem || draggedItem.id === targetItem.id) {
			draggedItem = null;
			return;
		}

		const draggedIndex = items.findIndex(i => i.id === draggedItem!.id);
		const targetIndex = items.findIndex(i => i.id === targetItem.id);

		const newItems = [...items];
		const [removed] = newItems.splice(draggedIndex, 1);
		newItems.splice(targetIndex, 0, removed);

		const reorderedItems = newItems.map((i, index) => ({
			id: i.id,
			position: index
		}));

		items = newItems.map((i, index) => ({ ...i, position: index }));
		draggedItem = null;

		try {
			await storiesAPI.items.reorder(reorderedItems);
		} catch (err: any) {
			console.error('Failed to save order:', err);
			await invalidateAll();
		}
	}

	function handleDragEnd() {
		draggedItem = null;
		dragOverId = null;
	}
</script>

<div class="page-header">
	<a href="/stories" class="back-link">← Назад к списку</a>

	<div class="header-main">
		<div class="header-left">
			{#if titleEditing}
				<div class="title-edit">
					<input
						type="text"
						bind:value={titleValue}
						class="title-input"
						onkeydown={(e) => e.key === 'Enter' && saveTitle()}
					/>
					<Button variant="primary" size="sm" onclick={saveTitle}>Сохранить</Button>
					<Button variant="ghost" size="sm" onclick={() => { titleEditing = false; titleValue = highlight?.title || ''; }}>Отмена</Button>
				</div>
			{:else}
				<h1 onclick={() => titleEditing = true} class="editable-title">
					{highlight?.title}
					<span class="edit-icon">✏️</span>
				</h1>
			{/if}
			<p class="subtitle">Редактирование контента хайлайта</p>
		</div>

		<div class="header-actions">
			<Button variant="primary" onclick={openAddItem}>
				+ Добавить контент
			</Button>
		</div>
	</div>
</div>

<div class="content-grid">
	<!-- Left: Cover & Stats -->
	<div class="sidebar-panel">
		<div class="panel-card">
			<h3>Обложка</h3>
			<div class="cover-upload">
				{#if highlight?.coverImage}
					<img src={highlight.coverImage} alt="Обложка" class="cover-preview" />
				{:else}
					<div class="cover-placeholder">📷</div>
				{/if}
				<label class="upload-btn" class:uploading={coverUploading}>
					{coverUploading ? 'Загрузка...' : 'Изменить обложку'}
					<input type="file" accept="image/*" onchange={handleCoverUpload} disabled={coverUploading} hidden />
				</label>
			</div>
		</div>

		{#if analytics}
			<div class="panel-card">
				<h3>Статистика (30 дней)</h3>
				<div class="stats-grid">
					<div class="stat-item">
						<span class="stat-value">{analytics.totalViews}</span>
						<span class="stat-label">Просмотров</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">{analytics.completionRate?.toFixed(0) || 0}%</span>
						<span class="stat-label">Досмотры</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">{analytics.linkClickRate?.toFixed(0) || 0}%</span>
						<span class="stat-label">Клики по ссылкам</span>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Right: Items List -->
	<div class="main-panel">
		<div class="panel-card">
			<div class="items-header">
				<h3>Контент ({items.length})</h3>
				<p class="hint">Перетаскивайте для изменения порядка</p>
			</div>

			{#if items.length === 0}
				<div class="empty-state">
					<div class="empty-icon">🖼️</div>
					<h4>Нет контента</h4>
					<p>Добавьте фото или видео для этого хайлайта</p>
					<Button variant="primary" onclick={openAddItem}>
						+ Добавить контент
					</Button>
				</div>
			{:else}
				<div class="items-list">
					{#each items as item, index (item.id)}
						<div
							class="item-card"
							class:dragging={draggedItem?.id === item.id}
							class:drag-over={dragOverId === item.id}
							class:inactive={!item.isActive}
							draggable="true"
							ondragstart={(e) => handleDragStart(e, item)}
							ondragover={(e) => handleDragOver(e, item)}
							ondragleave={handleDragLeave}
							ondrop={(e) => handleDrop(e, item)}
							ondragend={handleDragEnd}
						>
							<div class="item-number">{index + 1}</div>
							<div class="item-drag-handle">⠿</div>

							<div class="item-preview">
								{#if item.type === 'video'}
									<video src={item.mediaUrl} muted></video>
									<div class="type-badge video">🎬</div>
								{:else}
									<img src={item.mediaUrl} alt="Story" />
									<div class="type-badge photo">🖼️</div>
								{/if}
							</div>

							<div class="item-info">
								<div class="item-type">
									{item.type === 'video' ? 'Видео' : 'Фото'}
									<span class="duration">{item.duration} сек</span>
								</div>
								{#if item.linkUrl}
									<div class="item-link">
										🔗 {item.linkText || item.linkUrl}
									</div>
								{/if}
								<div class="item-status">
									<span class="status-dot" class:active={item.isActive}></span>
									{item.isActive ? 'Активен' : 'Неактивен'}
								</div>
							</div>

							<div class="item-actions">
								<button class="action-btn" onclick={() => openEditItem(item)} title="Редактировать">
									✏️
								</button>
								<button class="action-btn" onclick={() => toggleItemActive(item)} title={item.isActive ? 'Выключить' : 'Включить'}>
									{item.isActive ? '👁️' : '👁️‍🗨️'}
								</button>
								<button class="action-btn danger" onclick={() => confirmDeleteItem(item)} title="Удалить">
									🗑️
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Item Modal -->
<Modal isOpen={itemModalOpen} onClose={() => itemModalOpen = false} title={editingItem ? 'Редактировать контент' : 'Добавить контент'} size="md">
	<form onsubmit={(e) => { e.preventDefault(); handleItemSubmit(); }}>
		<!-- Media Upload -->
		<div class="form-section">
			<label class="form-label">Медиафайл *</label>
			{#if itemForm.mediaUrl}
				<div class="media-preview">
					{#if itemForm.type === 'video'}
						<video src={itemForm.mediaUrl} controls></video>
					{:else}
						<img src={itemForm.mediaUrl} alt="Preview" />
					{/if}
					<button type="button" class="remove-media" onclick={() => itemForm.mediaUrl = ''}>✕</button>
				</div>
			{:else}
				<label class="upload-area" class:uploading class:upload-complete={uploadComplete}>
					{#if uploading}
						<div class="upload-progress-container">
							<div class="upload-progress-bar">
								<div class="upload-progress-fill" style="width: {uploadProgress}%"></div>
							</div>
							<span class="upload-progress-text">Загрузка... {uploadProgress}%</span>
						</div>
					{:else if uploadComplete}
						<span class="upload-success-icon">✓</span>
						<span class="upload-success-text">Загружено!</span>
					{:else}
						<span class="upload-icon">📤</span>
						<span>Нажмите для загрузки фото или видео</span>
						<span class="upload-hint">
							Фото: JPG, PNG, WebP | Видео: MP4 (H.264), WebM (до {settings?.maxVideoDuration || 90} сек)
						</span>
					{/if}
					<input type="file" accept="image/*,video/mp4,video/webm" onchange={handleMediaUpload} hidden disabled={uploading} />
				</label>
			{/if}
		</div>

		<!-- Duration -->
		<div class="form-row">
			<div class="form-group">
				<Input
					type="number"
					label="Длительность показа (сек)"
					bind:value={itemForm.duration}
					min={1}
					max={60}
				/>
			</div>
			<div class="form-group">
				<label class="form-label">Статус</label>
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={itemForm.isActive} />
					<span>Активен</span>
				</label>
			</div>
		</div>

		<!-- Link -->
		<div class="form-section">
			<label class="form-label">Кнопка-ссылка (опционально)</label>
			<div class="form-row">
				<div class="form-group flex-2">
					<Input
						label="URL ссылки"
						placeholder="https://example.com или /offers"
						bind:value={itemForm.linkUrl}
					/>
				</div>
				<div class="form-group flex-1">
					<Input
						label="Текст кнопки"
						placeholder="Подробнее"
						bind:value={itemForm.linkText}
					/>
				</div>
			</div>
		</div>

		{#if itemError}
			<div class="form-error">{itemError}</div>
		{/if}

		<div class="modal-actions">
			<Button variant="ghost" onclick={() => itemModalOpen = false} disabled={itemLoading}>
				Отмена
			</Button>
			<Button variant="primary" type="submit" loading={itemLoading}>
				{editingItem ? 'Сохранить' : 'Добавить'}
			</Button>
		</div>
	</form>
</Modal>

<!-- Delete Confirmation -->
<Modal isOpen={deleteModalOpen} onClose={() => deleteModalOpen = false} title="Удалить элемент?" size="sm">
	<p class="confirm-text">
		Вы уверены, что хотите удалить этот элемент? Это действие нельзя отменить.
	</p>
	<div class="modal-actions">
		<Button variant="ghost" onclick={() => deleteModalOpen = false}>Отмена</Button>
		<Button variant="danger" onclick={handleDeleteItem}>Удалить</Button>
	</div>
</Modal>

<style>
	.page-header {
		margin-bottom: 1.5rem;
	}

	.back-link {
		display: inline-block;
		margin-bottom: 1rem;
		color: #6b7280;
		text-decoration: none;
		font-size: 0.875rem;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: #374151;
	}

	.header-main {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.editable-title {
		margin: 0 0 0.25rem 0;
		font-size: 1.75rem;
		font-weight: 700;
		color: #111827;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.editable-title:hover .edit-icon {
		opacity: 1;
	}

	.edit-icon {
		font-size: 1rem;
		opacity: 0.3;
		transition: opacity 0.2s;
	}

	.title-edit {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.title-input {
		font-size: 1.5rem;
		font-weight: 700;
		border: 2px solid #667eea;
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
		outline: none;
	}

	.subtitle {
		margin: 0;
		color: #6b7280;
		font-size: 0.875rem;
	}

	/* Content Grid */
	.content-grid {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 1.5rem;
	}

	@media (max-width: 1024px) {
		.content-grid {
			grid-template-columns: 1fr;
		}
	}

	.panel-card {
		background: white;
		border-radius: 0.75rem;
		padding: 1.25rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		margin-bottom: 1rem;
	}

	.panel-card h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	/* Cover Upload */
	.cover-upload {
		text-align: center;
	}

	.cover-preview {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		object-fit: cover;
		margin-bottom: 1rem;
	}

	.cover-placeholder {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		background: #f3f4f6;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2.5rem;
		margin: 0 auto 1rem;
	}

	.upload-btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: #f3f4f6;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		color: #374151;
		cursor: pointer;
		transition: background 0.2s;
	}

	.upload-btn:hover {
		background: #e5e7eb;
	}

	.upload-btn.uploading {
		opacity: 0.7;
		cursor: wait;
	}

	/* Stats */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.stat-item {
		text-align: center;
		padding: 0.75rem 0.5rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.stat-value {
		display: block;
		font-size: 1.25rem;
		font-weight: 700;
		color: #111827;
	}

	.stat-label {
		display: block;
		font-size: 0.625rem;
		color: #6b7280;
		margin-top: 0.25rem;
	}

	/* Items */
	.items-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.items-header h3 {
		margin: 0;
	}

	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
	}

	.empty-icon {
		font-size: 2.5rem;
		margin-bottom: 0.75rem;
	}

	.empty-state h4 {
		margin: 0 0 0.5rem 0;
		color: #374151;
	}

	.empty-state p {
		margin: 0 0 1rem 0;
		color: #6b7280;
		font-size: 0.875rem;
	}

	.items-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.item-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		transition: all 0.2s;
		cursor: grab;
	}

	.item-card:hover {
		background: white;
		border-color: #d1d5db;
	}

	.item-card.dragging {
		opacity: 0.5;
		cursor: grabbing;
	}

	.item-card.drag-over {
		border-color: #667eea;
		background: #f5f3ff;
	}

	.item-card.inactive {
		opacity: 0.6;
	}

	.item-number {
		width: 24px;
		height: 24px;
		background: #e5e7eb;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
	}

	.item-drag-handle {
		color: #9ca3af;
		cursor: grab;
	}

	.item-preview {
		width: 60px;
		height: 80px;
		border-radius: 0.375rem;
		overflow: hidden;
		position: relative;
		background: #e5e7eb;
	}

	.item-preview img,
	.item-preview video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.type-badge {
		position: absolute;
		bottom: 4px;
		right: 4px;
		font-size: 0.75rem;
		background: rgba(0, 0, 0, 0.6);
		border-radius: 0.25rem;
		padding: 2px 4px;
	}

	.item-info {
		flex: 1;
		min-width: 0;
	}

	.item-type {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.duration {
		font-weight: 400;
		color: #6b7280;
		margin-left: 0.5rem;
	}

	.item-link {
		font-size: 0.75rem;
		color: #667eea;
		margin-top: 0.25rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-status {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: #6b7280;
		margin-top: 0.25rem;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #d1d5db;
	}

	.status-dot.active {
		background: #10b981;
	}

	.item-actions {
		display: flex;
		gap: 0.25rem;
	}

	.action-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.action-btn:hover {
		background: #e5e7eb;
	}

	.action-btn.danger:hover {
		background: #fee2e2;
	}

	/* Modal Form */
	.form-section {
		margin-bottom: 1.5rem;
	}

	.form-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
	}

	.form-row {
		display: flex;
		gap: 1rem;
	}

	.form-group {
		flex: 1;
	}

	.form-group.flex-2 {
		flex: 2;
	}

	.form-group.flex-1 {
		flex: 1;
	}

	.upload-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		border: 2px dashed #d1d5db;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
		text-align: center;
	}

	.upload-area:hover {
		border-color: #667eea;
		background: #f5f3ff;
	}

	.upload-area.uploading {
		opacity: 0.7;
		cursor: wait;
	}

	.upload-icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
	}

	.upload-hint {
		font-size: 0.75rem;
		color: #9ca3af;
		margin-top: 0.5rem;
	}

	/* Upload progress styles */
	.upload-progress-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		max-width: 200px;
	}

	.upload-progress-bar {
		width: 100%;
		height: 8px;
		background: #e5e7eb;
		border-radius: 4px;
		overflow: hidden;
	}

	.upload-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #667eea, #764ba2);
		border-radius: 4px;
		transition: width 0.2s ease;
	}

	.upload-progress-text {
		font-size: 0.875rem;
		color: #667eea;
		font-weight: 500;
	}

	.upload-area.upload-complete {
		border-color: #10b981;
		background: #ecfdf5;
	}

	.upload-success-icon {
		width: 48px;
		height: 48px;
		background: #10b981;
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		font-weight: bold;
		margin-bottom: 0.5rem;
	}

	.upload-success-text {
		font-size: 1rem;
		color: #10b981;
		font-weight: 600;
	}

	.media-preview {
		position: relative;
		max-width: 300px;
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.media-preview img,
	.media-preview video {
		width: 100%;
		display: block;
	}

	.remove-media {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 28px;
		height: 28px;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
		padding: 0.75rem 0;
	}

	.checkbox-label input {
		width: 18px;
		height: 18px;
	}

	.form-error {
		padding: 0.75rem;
		background: #fee2e2;
		color: #7f1d1d;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.confirm-text {
		margin: 0 0 1rem 0;
		color: #4b5563;
		font-size: 0.875rem;
	}

	@media (max-width: 640px) {
		.form-row {
			flex-direction: column;
		}
	}
</style>
