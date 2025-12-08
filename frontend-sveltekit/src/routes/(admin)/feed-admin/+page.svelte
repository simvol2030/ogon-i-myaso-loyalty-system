<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Filters
	let typeFilter = $state(data.filters.type || 'all');
	let statusFilter = $state(data.filters.status || 'all');

	// Modals
	let formModalOpen = $state(false);
	let deleteModalOpen = $state(false);
	let tagsModalOpen = $state(false);
	let editingPost = $state<any>(null);
	let deletingPost = $state<any>(null);
	let actionLoading = $state(false);

	// Форма создания/редактирования
	let formType = $state<'post' | 'article'>('post');
	let formTitle = $state('');
	let formContent = $state('');
	let formExcerpt = $state('');
	let formAuthorName = $state('');
	let formTagIds = $state<number[]>([]);
	let formIsPublished = $state(false);

	// Теги
	let tagFormOpen = $state(false);
	let editingTag = $state<any>(null);
	let tagName = $state('');
	let tagSlug = $state('');
	let tagColor = $state('#ff6b00');

	// Apply filters
	function applyFilters() {
		const params = new URLSearchParams();
		if (typeFilter !== 'all') params.set('type', typeFilter);
		if (statusFilter !== 'all') params.set('status', statusFilter);
		goto(`/feed-admin?${params.toString()}`);
	}

	function resetFilters() {
		typeFilter = 'all';
		statusFilter = 'all';
		goto('/feed-admin');
	}

	// Open modals
	function openCreateModal(type: 'post' | 'article') {
		editingPost = null;
		formType = type;
		formTitle = '';
		formContent = '';
		formExcerpt = '';
		formAuthorName = '';
		formTagIds = [];
		formIsPublished = false;
		formModalOpen = true;
	}

	async function openEditModal(post: any) {
		editingPost = post;
		// Загружаем полные данные поста
		try {
			const response = await fetch(`/api/admin/feed/posts/${post.id}`);
			if (response.ok) {
				const result = await response.json();
				const fullPost = result.data.post;
				formType = fullPost.type;
				formTitle = fullPost.title || '';
				formContent = fullPost.content;
				formExcerpt = fullPost.excerpt || '';
				formAuthorName = fullPost.authorName || '';
				formTagIds = fullPost.tags?.map((t: any) => t.id) || [];
				formIsPublished = fullPost.isPublished;
				formModalOpen = true;
			}
		} catch (error) {
			console.error('Error loading post:', error);
		}
	}

	function openDeleteModal(post: any) {
		deletingPost = post;
		deleteModalOpen = true;
	}

	// CRUD operations
	async function handleSubmit() {
		actionLoading = true;
		try {
			const body = {
				type: formType,
				title: formTitle || null,
				content: formContent,
				excerpt: formExcerpt || null,
				authorName: formAuthorName || null,
				tagIds: formTagIds,
				isPublished: formIsPublished
			};

			const url = editingPost
				? `/api/admin/feed/posts/${editingPost.id}`
				: '/api/admin/feed/posts';
			const method = editingPost ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (response.ok) {
				formModalOpen = false;
				await invalidateAll();
			} else {
				const error = await response.json();
				alert(error.error || 'Ошибка сохранения');
			}
		} catch (error) {
			console.error('Error saving post:', error);
		} finally {
			actionLoading = false;
		}
	}

	async function handleDelete() {
		if (!deletingPost) return;
		actionLoading = true;
		try {
			const response = await fetch(`/api/admin/feed/posts/${deletingPost.id}?hard=true`, {
				method: 'DELETE'
			});

			if (response.ok) {
				deleteModalOpen = false;
				deletingPost = null;
				await invalidateAll();
			}
		} catch (error) {
			console.error('Error deleting post:', error);
		} finally {
			actionLoading = false;
		}
	}

	async function togglePublish(post: any) {
		try {
			await fetch(`/api/admin/feed/posts/${post.id}/publish`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isPublished: !post.isPublished })
			});
			await invalidateAll();
		} catch (error) {
			console.error('Error toggling publish:', error);
		}
	}

	// Tags CRUD
	function openTagForm(tag?: any) {
		if (tag) {
			editingTag = tag;
			tagName = tag.name;
			tagSlug = tag.slug;
			tagColor = tag.color;
		} else {
			editingTag = null;
			tagName = '';
			tagSlug = '';
			tagColor = '#ff6b00';
		}
		tagFormOpen = true;
	}

	async function saveTag() {
		try {
			const body = {
				name: tagName,
				slug: tagSlug || tagName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
				color: tagColor
			};

			const url = editingTag
				? `/api/admin/feed/tags/${editingTag.id}`
				: '/api/admin/feed/tags';
			const method = editingTag ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (response.ok) {
				tagFormOpen = false;
				await invalidateAll();
			} else {
				const error = await response.json();
				alert(error.error || 'Ошибка сохранения тега');
			}
		} catch (error) {
			console.error('Error saving tag:', error);
		}
	}

	async function deleteTag(tag: any) {
		if (!confirm(`Удалить тег "${tag.name}"?`)) return;
		try {
			await fetch(`/api/admin/feed/tags/${tag.id}`, { method: 'DELETE' });
			await invalidateAll();
		} catch (error) {
			console.error('Error deleting tag:', error);
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '—';
		return new Date(dateStr).toLocaleDateString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Лента - Loyalty Admin</title>
</svelte:head>

<div class="feed-admin-page">
	<div class="page-header">
		<div>
			<!-- FIX M4: Убран emoji из заголовка -->
			<h1>Управление лентой</h1>
			<p class="text-muted">
				Всего: {data.stats.total} | Опубликовано: {data.stats.published} | Черновики: {data.stats.draft}
			</p>
		</div>

		<div class="header-actions">
			<button class="btn btn-secondary" onclick={() => (tagsModalOpen = true)}>
				Теги
			</button>
			<button class="btn btn-primary" onclick={() => openCreateModal('post')}>
				+ Новый пост
			</button>
			<button class="btn btn-outline" onclick={() => openCreateModal('article')}>
				+ Новая статья
			</button>
		</div>
	</div>

	<!-- Фильтры -->
	<div class="filters-panel">
		<div class="filters-row">
			<select class="select" bind:value={typeFilter}>
				<option value="all">Все типы</option>
				<option value="post">Посты</option>
				<option value="article">Статьи</option>
			</select>

			<select class="select" bind:value={statusFilter}>
				<option value="all">Все статусы</option>
				<option value="published">Опубликованные</option>
				<option value="draft">Черновики</option>
			</select>

			<button class="btn btn-primary" onclick={applyFilters}>Применить</button>
			<button class="btn btn-ghost" onclick={resetFilters}>Сбросить</button>
		</div>
	</div>

	<!-- Список постов -->
	<div class="posts-table">
		<table>
			<thead>
				<tr>
					<th>ID</th>
					<th>Тип</th>
					<th>Заголовок / Превью</th>
					<th>Теги</th>
					<th>Фото</th>
					<th>Статус</th>
					<th>Дата</th>
					<th>Действия</th>
				</tr>
			</thead>
			<tbody>
				{#each data.posts as post (post.id)}
					<tr>
						<td class="col-id">{post.id}</td>
						<td class="col-type">
							<span class="type-badge" class:article={post.type === 'article'}>
								{post.type === 'article' ? '📄' : '📝'}
							</span>
						</td>
						<td class="col-title">
							<div class="title-text">{post.title || post.excerpt}</div>
						</td>
						<td class="col-tags">
							{#each post.tags.slice(0, 2) as tag}
								<span class="mini-tag" style="background: {tag.color}20; color: {tag.color}">
									{tag.name}
								</span>
							{/each}
							{#if post.tags.length > 2}
								<span class="mini-tag more">+{post.tags.length - 2}</span>
							{/if}
						</td>
						<td class="col-images">
							{#if post.imagesCount > 0}
								<span class="images-count">🖼️ {post.imagesCount}</span>
							{:else}
								<span class="no-images">—</span>
							{/if}
						</td>
						<td class="col-status">
							<button
								class="status-badge"
								class:published={post.isPublished}
								onclick={() => togglePublish(post)}
								title={post.isPublished ? 'Снять с публикации' : 'Опубликовать'}
							>
								{post.isPublished ? '✅ Опубликован' : '⏸️ Черновик'}
							</button>
						</td>
						<td class="col-date">
							{formatDate(post.publishedAt || post.createdAt)}
						</td>
						<td class="col-actions">
							<button class="action-btn" onclick={() => openEditModal(post)} title="Редактировать">✏️</button>
							<button class="action-btn danger" onclick={() => openDeleteModal(post)} title="Удалить">🗑️</button>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="8" class="empty-row">
							Нет публикаций
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<!-- Modal: Create/Edit Post -->
{#if formModalOpen}
	<div class="modal-overlay" onclick={() => (formModalOpen = false)}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>{editingPost ? 'Редактировать' : 'Создать'} {formType === 'article' ? 'статью' : 'пост'}</h2>
				<button class="modal-close" onclick={() => (formModalOpen = false)}>✕</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label>Тип</label>
					<div class="radio-group">
						<label class="radio-label">
							<input type="radio" bind:group={formType} value="post" />
							📝 Пост
						</label>
						<label class="radio-label">
							<input type="radio" bind:group={formType} value="article" />
							📄 Статья
						</label>
					</div>
				</div>

				{#if formType === 'article'}
					<div class="form-group">
						<label>Заголовок *</label>
						<input type="text" class="input" bind:value={formTitle} placeholder="Заголовок статьи" />
					</div>
				{:else}
					<div class="form-group">
						<label>Заголовок (опционально)</label>
						<input type="text" class="input" bind:value={formTitle} placeholder="Заголовок поста" />
					</div>
				{/if}

				<div class="form-group">
					<label>Содержимое * (Markdown)</label>
					<textarea class="textarea" bind:value={formContent} rows="8" placeholder="Текст публикации..."></textarea>
					<small class="hint">Поддерживается Markdown: **жирный**, *курсив*, [ссылка](url), # заголовки</small>
				</div>

				{#if formType === 'article'}
					<div class="form-group">
						<label>Краткое описание (для ленты)</label>
						<textarea class="textarea" bind:value={formExcerpt} rows="2" placeholder="Краткое описание..."></textarea>
					</div>
				{/if}

				<div class="form-group">
					<label>Автор</label>
					<input type="text" class="input" bind:value={formAuthorName} placeholder="Имя автора" />
				</div>

				<div class="form-group">
					<label>Теги</label>
					<div class="tags-checkboxes">
						{#each data.tags as tag}
							<label class="checkbox-label" style="--tag-color: {tag.color}">
								<input
									type="checkbox"
									checked={formTagIds.includes(tag.id)}
									onchange={(e) => {
										if ((e.target as HTMLInputElement).checked) {
											formTagIds = [...formTagIds, tag.id];
										} else {
											formTagIds = formTagIds.filter(id => id !== tag.id);
										}
									}}
								/>
								{tag.name}
							</label>
						{/each}
					</div>
				</div>

				<div class="form-group">
					<label class="checkbox-label publish-checkbox">
						<input type="checkbox" bind:checked={formIsPublished} />
						Опубликовать сразу
					</label>
				</div>

				{#if editingPost}
					<div class="form-note">
						<strong>Изображения:</strong> Для управления изображениями используйте API напрямую
						или добавьте их после сохранения.
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button class="btn btn-ghost" onclick={() => (formModalOpen = false)}>Отмена</button>
				<button class="btn btn-primary" onclick={handleSubmit} disabled={actionLoading || !formContent}>
					{actionLoading ? 'Сохранение...' : 'Сохранить'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: Delete Confirmation -->
{#if deleteModalOpen}
	<div class="modal-overlay" onclick={() => (deleteModalOpen = false)}>
		<div class="modal modal-sm" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Удалить публикацию?</h2>
				<button class="modal-close" onclick={() => (deleteModalOpen = false)}>✕</button>
			</div>
			<div class="modal-body">
				<p>Вы уверены, что хотите удалить "{deletingPost?.title || deletingPost?.excerpt}"?</p>
				<p class="warning">Это действие нельзя отменить.</p>
			</div>
			<div class="modal-footer">
				<button class="btn btn-ghost" onclick={() => (deleteModalOpen = false)}>Отмена</button>
				<button class="btn btn-danger" onclick={handleDelete} disabled={actionLoading}>
					{actionLoading ? 'Удаление...' : 'Удалить'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: Tags Management -->
{#if tagsModalOpen}
	<div class="modal-overlay" onclick={() => (tagsModalOpen = false)}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Управление тегами</h2>
				<button class="modal-close" onclick={() => (tagsModalOpen = false)}>✕</button>
			</div>

			<div class="modal-body">
				<button class="btn btn-primary btn-sm" onclick={() => openTagForm()}>+ Добавить тег</button>

				<div class="tags-list">
					{#each data.tags as tag}
						<div class="tag-item">
							<span class="tag-preview" style="background: {tag.color}20; color: {tag.color}">
								{tag.name}
							</span>
							<span class="tag-slug">{tag.slug}</span>
							<div class="tag-actions">
								<button class="action-btn" onclick={() => openTagForm(tag)}>✏️</button>
								<button class="action-btn danger" onclick={() => deleteTag(tag)}>🗑️</button>
							</div>
						</div>
					{:else}
						<p class="no-tags">Нет тегов</p>
					{/each}
				</div>

				{#if tagFormOpen}
					<div class="tag-form">
						<h4>{editingTag ? 'Редактировать' : 'Новый'} тег</h4>
						<div class="form-row">
							<input type="text" class="input" bind:value={tagName} placeholder="Название" />
							<input type="text" class="input" bind:value={tagSlug} placeholder="slug (латиница)" />
							<input type="color" class="color-input" bind:value={tagColor} />
						</div>
						<div class="form-actions">
							<button class="btn btn-ghost btn-sm" onclick={() => (tagFormOpen = false)}>Отмена</button>
							<button class="btn btn-primary btn-sm" onclick={saveTag}>Сохранить</button>
						</div>
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button class="btn btn-ghost" onclick={() => (tagsModalOpen = false)}>Закрыть</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.feed-admin-page {
		max-width: 1400px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 1.75rem;
		font-weight: 700;
		color: #111827;
	}

	.text-muted {
		color: #6b7280;
		margin: 0;
		font-size: 0.875rem;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	/* Buttons */
	.btn {
		padding: 0.625rem 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid transparent;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.btn-primary:hover {
		filter: brightness(1.1);
	}

	.btn-secondary {
		background: #e5e7eb;
		color: #374151;
	}

	.btn-secondary:hover {
		background: #d1d5db;
	}

	.btn-outline {
		background: white;
		color: #667eea;
		border-color: #667eea;
	}

	.btn-outline:hover {
		background: #667eea;
		color: white;
	}

	.btn-ghost {
		background: transparent;
		color: #6b7280;
	}

	.btn-ghost:hover {
		background: #f3f4f6;
	}

	.btn-danger {
		background: #ef4444;
		color: white;
	}

	.btn-danger:hover {
		background: #dc2626;
	}

	.btn-sm {
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Filters */
	.filters-panel {
		background: white;
		padding: 1rem;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.filters-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.select {
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		background: white;
	}

	/* Table */
	.posts-table {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th, td {
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 1px solid #e5e7eb;
	}

	th {
		background: #f9fafb;
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
	}

	td {
		font-size: 0.875rem;
	}

	.col-id {
		width: 50px;
		color: #9ca3af;
	}

	.col-type {
		width: 50px;
	}

	.type-badge {
		font-size: 1.25rem;
	}

	.col-title {
		max-width: 300px;
	}

	.title-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.col-tags {
		width: 150px;
	}

	.mini-tag {
		display: inline-block;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.6875rem;
		font-weight: 500;
		margin-right: 0.25rem;
	}

	.mini-tag.more {
		background: #e5e7eb;
		color: #6b7280;
	}

	.col-images {
		width: 80px;
	}

	.images-count {
		color: #6b7280;
	}

	.no-images {
		color: #d1d5db;
	}

	.col-status {
		width: 130px;
	}

	.status-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		background: #fef3c7;
		color: #92400e;
	}

	.status-badge.published {
		background: #d1fae5;
		color: #065f46;
	}

	.status-badge:hover {
		filter: brightness(0.95);
	}

	.col-date {
		width: 130px;
		color: #6b7280;
		font-size: 0.8125rem;
	}

	.col-actions {
		width: 100px;
	}

	.action-btn {
		padding: 0.25rem 0.5rem;
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: 1rem;
		border-radius: 0.25rem;
		transition: all 0.2s;
	}

	.action-btn:hover {
		background: #f3f4f6;
	}

	.action-btn.danger:hover {
		background: #fee2e2;
	}

	.empty-row {
		text-align: center;
		color: #9ca3af;
		padding: 2rem !important;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal {
		background: white;
		border-radius: 0.75rem;
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
	}

	.modal-sm {
		max-width: 400px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		color: #9ca3af;
		padding: 0.25rem;
	}

	.modal-close:hover {
		color: #374151;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid #e5e7eb;
	}

	/* Form */
	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		font-weight: 500;
		font-size: 0.875rem;
		margin-bottom: 0.375rem;
		color: #374151;
	}

	.input, .textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.input:focus, .textarea:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.textarea {
		resize: vertical;
		font-family: inherit;
	}

	.hint {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.radio-group {
		display: flex;
		gap: 1rem;
	}

	.radio-label, .checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.tags-checkboxes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tags-checkboxes .checkbox-label {
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		background: var(--tag-color, #f3f4f6);
		opacity: 0.7;
	}

	.tags-checkboxes .checkbox-label:has(input:checked) {
		opacity: 1;
		font-weight: 500;
	}

	.publish-checkbox {
		padding: 0.5rem;
		background: #f0fdf4;
		border-radius: 0.375rem;
	}

	.form-note {
		padding: 0.75rem;
		background: #fffbeb;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		color: #92400e;
	}

	.warning {
		color: #dc2626;
		font-size: 0.875rem;
	}

	/* Tags Modal */
	.tags-list {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tag-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		background: #f9fafb;
		border-radius: 0.375rem;
	}

	.tag-preview {
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.tag-slug {
		flex: 1;
		font-size: 0.75rem;
		color: #9ca3af;
		font-family: monospace;
	}

	.tag-actions {
		display: flex;
		gap: 0.25rem;
	}

	.no-tags {
		color: #9ca3af;
		text-align: center;
		padding: 1rem;
	}

	.tag-form {
		margin-top: 1rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 0.5rem;
	}

	.tag-form h4 {
		margin: 0 0 0.75rem 0;
		font-size: 0.875rem;
	}

	.form-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.form-row .input {
		flex: 1;
	}

	.color-input {
		width: 40px;
		height: 36px;
		padding: 0;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		cursor: pointer;
	}

	.form-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
		}

		.posts-table {
			overflow-x: auto;
		}

		table {
			min-width: 700px;
		}
	}
</style>
