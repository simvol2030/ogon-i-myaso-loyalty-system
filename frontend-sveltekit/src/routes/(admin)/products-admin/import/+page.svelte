<script lang="ts">
	import { productsAPI, type ImportResult } from '$lib/api/admin/products';

	let file: File | null = $state(null);
	let mode: 'create_only' | 'update_only' | 'create_or_update' = $state('create_or_update');
	let defaultCategory = $state('');
	let isLoading = $state(false);
	let result: ImportResult | null = $state(null);
	let error = $state('');
	let dragOver = $state(false);

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			file = input.files[0];
			result = null;
			error = '';
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
			const droppedFile = event.dataTransfer.files[0];
			const ext = droppedFile.name.split('.').pop()?.toLowerCase();

			if (ext === 'csv' || ext === 'json') {
				file = droppedFile;
				result = null;
				error = '';
			} else {
				error = 'Поддерживаются только CSV и JSON файлы';
			}
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	async function handleImport() {
		if (!file) return;

		isLoading = true;
		error = '';
		result = null;

		try {
			result = await productsAPI.importProducts(file, {
				mode,
				defaultCategory: defaultCategory || undefined
			});
		} catch (err: any) {
			error = err.message || 'Ошибка импорта';
		} finally {
			isLoading = false;
		}
	}

	function clearFile() {
		file = null;
		result = null;
		error = '';
	}

	function downloadTemplate(format: 'csv' | 'json') {
		window.open(productsAPI.getTemplateUrl(format), '_blank');
	}
</script>

<svelte:head>
	<title>Импорт товаров | Админ</title>
</svelte:head>

<div class="import-page">
	<header class="page-header">
		<div class="header-left">
			<a href="/products-admin" class="back-btn">
				<span class="icon">&larr;</span>
			</a>
			<h1>Импорт товаров</h1>
		</div>
	</header>

	<div class="import-content">
		<!-- Templates section -->
		<section class="templates-section">
			<h2>Шаблоны для импорта</h2>
			<p class="hint">Скачайте шаблон и заполните его вашими данными</p>
			<div class="template-buttons">
				<button class="template-btn" onclick={() => downloadTemplate('csv')}>
					<span class="icon">📄</span>
					Скачать CSV шаблон
				</button>
				<button class="template-btn" onclick={() => downloadTemplate('json')}>
					<span class="icon">📋</span>
					Скачать JSON шаблон
				</button>
			</div>
		</section>

		<!-- Upload section -->
		<section class="upload-section">
			<h2>Загрузка файла</h2>

			<div
				class="drop-zone"
				class:drag-over={dragOver}
				class:has-file={file}
				ondrop={handleDrop}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
			>
				{#if file}
					<div class="file-info">
						<span class="file-icon">📁</span>
						<span class="file-name">{file.name}</span>
						<span class="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
						<button class="clear-btn" onclick={clearFile}>✕</button>
					</div>
				{:else}
					<div class="drop-content">
						<span class="upload-icon">📤</span>
						<p>Перетащите файл сюда или</p>
						<label class="file-input-label">
							<span>выберите файл</span>
							<input
								type="file"
								accept=".csv,.json"
								onchange={handleFileSelect}
								style="display: none;"
							/>
						</label>
						<p class="formats">Форматы: CSV, JSON</p>
					</div>
				{/if}
			</div>
		</section>

		<!-- Options section -->
		<section class="options-section">
			<h2>Настройки импорта</h2>

			<div class="option-group">
				<label for="mode">Режим импорта</label>
				<select id="mode" bind:value={mode}>
					<option value="create_or_update">Создать новые и обновить существующие</option>
					<option value="create_only">Только создавать новые</option>
					<option value="update_only">Только обновлять существующие</option>
				</select>
				<p class="option-hint">
					{#if mode === 'create_or_update'}
						Товары с существующим SKU будут обновлены, новые — созданы
					{:else if mode === 'create_only'}
						Товары с существующим SKU будут пропущены
					{:else}
						Только товары с существующим SKU будут обновлены
					{/if}
				</p>
			</div>

			<div class="option-group">
				<label for="defaultCategory">Категория по умолчанию</label>
				<input
					type="text"
					id="defaultCategory"
					bind:value={defaultCategory}
					placeholder="Без категории"
				/>
				<p class="option-hint">Будет использована для товаров без указанной категории</p>
			</div>
		</section>

		<!-- Import button -->
		<div class="import-actions">
			<button
				class="import-btn"
				onclick={handleImport}
				disabled={!file || isLoading}
			>
				{#if isLoading}
					<span class="spinner"></span>
					Импорт...
				{:else}
					Начать импорт
				{/if}
			</button>
		</div>

		<!-- Error message -->
		{#if error}
			<div class="error-message">
				<span class="icon">⚠️</span>
				{error}
			</div>
		{/if}

		<!-- Results section -->
		{#if result}
			<section class="results-section">
				<h2>Результаты импорта</h2>

				<div class="results-stats">
					<div class="stat">
						<span class="stat-value">{result.total}</span>
						<span class="stat-label">Всего</span>
					</div>
					<div class="stat success">
						<span class="stat-value">{result.created}</span>
						<span class="stat-label">Создано</span>
					</div>
					<div class="stat info">
						<span class="stat-value">{result.updated}</span>
						<span class="stat-label">Обновлено</span>
					</div>
					<div class="stat warning">
						<span class="stat-value">{result.skipped}</span>
						<span class="stat-label">Пропущено</span>
					</div>
				</div>

				{#if result.errors.length > 0}
					<div class="errors-list">
						<h3>Ошибки ({result.errors.length})</h3>
						<ul>
							{#each result.errors as err}
								<li>{err}</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="results-actions">
					<a href="/products-admin" class="btn-primary">Перейти к товарам</a>
					<button class="btn-secondary" onclick={clearFile}>Загрузить ещё</button>
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.import-page {
		padding: 1rem;
		max-width: 800px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: var(--color-bg-secondary, #f5f5f5);
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		font-size: 1.25rem;
	}

	h1 {
		font-size: 1.5rem;
		margin: 0;
	}

	h2 {
		font-size: 1.125rem;
		margin: 0 0 0.75rem 0;
	}

	section {
		background: white;
		border-radius: 12px;
		padding: 1rem;
		margin-bottom: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.hint {
		color: #666;
		font-size: 0.875rem;
		margin: 0 0 1rem 0;
	}

	.template-buttons {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.template-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg-secondary, #f5f5f5);
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.template-btn:hover {
		background: #e8e8e8;
	}

	.drop-zone {
		border: 2px dashed #ccc;
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
		transition: all 0.2s;
		background: #fafafa;
	}

	.drop-zone.drag-over {
		border-color: var(--color-primary, #3b82f6);
		background: rgba(59, 130, 246, 0.05);
	}

	.drop-zone.has-file {
		border-style: solid;
		border-color: var(--color-success, #22c55e);
		background: rgba(34, 197, 94, 0.05);
	}

	.drop-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.upload-icon {
		font-size: 2rem;
	}

	.file-input-label {
		color: var(--color-primary, #3b82f6);
		cursor: pointer;
		text-decoration: underline;
	}

	.formats {
		color: #999;
		font-size: 0.75rem;
		margin: 0;
	}

	.file-info {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.file-icon {
		font-size: 1.5rem;
	}

	.file-name {
		font-weight: 500;
	}

	.file-size {
		color: #666;
		font-size: 0.875rem;
	}

	.clear-btn {
		width: 24px;
		height: 24px;
		border: none;
		background: #e0e0e0;
		border-radius: 50%;
		cursor: pointer;
		font-size: 0.75rem;
		margin-left: 0.5rem;
	}

	.option-group {
		margin-bottom: 1rem;
	}

	.option-group:last-child {
		margin-bottom: 0;
	}

	.option-group label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.option-group select,
	.option-group input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		font-size: 1rem;
	}

	.option-hint {
		color: #666;
		font-size: 0.75rem;
		margin: 0.5rem 0 0 0;
	}

	.import-actions {
		margin-bottom: 1rem;
	}

	.import-btn {
		width: 100%;
		padding: 1rem;
		background: var(--color-primary, #3b82f6);
		color: white;
		border: none;
		border-radius: 12px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.import-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		background: #fef2f2;
		border: 1px solid #fee2e2;
		border-radius: 8px;
		color: #dc2626;
		margin-bottom: 1rem;
	}

	.results-section {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
	}

	.results-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.stat {
		background: white;
		padding: 0.75rem;
		border-radius: 8px;
		text-align: center;
	}

	.stat-value {
		display: block;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #666;
	}

	.stat.success .stat-value {
		color: #22c55e;
	}

	.stat.info .stat-value {
		color: #3b82f6;
	}

	.stat.warning .stat-value {
		color: #f59e0b;
	}

	.errors-list {
		background: #fef2f2;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.errors-list h3 {
		font-size: 0.875rem;
		margin: 0 0 0.5rem 0;
		color: #dc2626;
	}

	.errors-list ul {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.75rem;
		color: #666;
		max-height: 150px;
		overflow-y: auto;
	}

	.errors-list li {
		margin-bottom: 0.25rem;
	}

	.results-actions {
		display: flex;
		gap: 0.75rem;
	}

	.btn-primary,
	.btn-secondary {
		flex: 1;
		padding: 0.75rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
	}

	.btn-primary {
		background: var(--color-primary, #3b82f6);
		color: white;
		border: none;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #e0e0e0;
	}
</style>
