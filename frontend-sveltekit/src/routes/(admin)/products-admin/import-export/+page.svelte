<script lang="ts">
	import { productsAPI, type ImportResult, type ZipUploadResult, type ExportOptions } from '$lib/api/admin/products';
	import type { ProductCategory } from '$lib/types/admin';

	// Active tab
	let activeTab = $state<'export' | 'import'>('export');

	// Categories for filter
	let categories: ProductCategory[] = $state([]);
	let categoriesLoading = $state(true);

	// Export state
	let exportMode: 'first10' | 'active' | 'all' = $state('all');
	let exportFormat: 'csv' | 'json' = $state('csv');
	let selectedCategoryIds: number[] = $state([]);

	// Import state - Step tracking
	let currentStep = $state<1 | 2>(1);

	// Step 1: ZIP with images
	let zipFile: File | null = $state(null);
	let zipUploading = $state(false);
	let zipResult: ZipUploadResult | null = $state(null);
	let zipError = $state('');
	let zipDragOver = $state(false);

	// Step 2: CSV/JSON import
	let importFile: File | null = $state(null);
	let mode: 'create_only' | 'update_only' | 'create_or_update' = $state('create_or_update');
	let defaultCategory = $state('');
	let isLoading = $state(false);
	let result: ImportResult | null = $state(null);
	let error = $state('');
	let dragOver = $state(false);

	// Load categories on mount
	$effect(() => {
		loadCategories();
	});

	async function loadCategories() {
		try {
			categories = await productsAPI.getCategories();
		} catch (err) {
			console.error('Failed to load categories:', err);
		} finally {
			categoriesLoading = false;
		}
	}

	// Export handlers
	function toggleCategory(categoryId: number) {
		if (selectedCategoryIds.includes(categoryId)) {
			selectedCategoryIds = selectedCategoryIds.filter(id => id !== categoryId);
		} else {
			selectedCategoryIds = [...selectedCategoryIds, categoryId];
		}
	}

	function handleExport() {
		const options: ExportOptions = {
			format: exportFormat,
			mode: exportMode,
			categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined
		};
		const url = productsAPI.getExportUrl(options);
		window.open(url, '_blank');
	}

	// Step 1: ZIP handlers
	function handleZipSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			zipFile = input.files[0];
			zipResult = null;
			zipError = '';
		}
	}

	function handleZipDrop(event: DragEvent) {
		event.preventDefault();
		zipDragOver = false;

		if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
			const droppedFile = event.dataTransfer.files[0];
			const ext = droppedFile.name.split('.').pop()?.toLowerCase();

			if (ext === 'zip') {
				zipFile = droppedFile;
				zipResult = null;
				zipError = '';
			} else {
				zipError = 'Поддерживаются только ZIP архивы';
			}
		}
	}

	async function handleZipUpload() {
		if (!zipFile) return;

		zipUploading = true;
		zipError = '';

		try {
			zipResult = await productsAPI.uploadImagesZip(zipFile);
		} catch (err: any) {
			zipError = err.message || 'Ошибка загрузки архива';
		} finally {
			zipUploading = false;
		}
	}

	function clearZipFile() {
		zipFile = null;
		zipResult = null;
		zipError = '';
	}

	function skipZipStep() {
		currentStep = 2;
	}

	function goToStep2() {
		currentStep = 2;
	}

	function goBackToStep1() {
		currentStep = 1;
	}

	// Step 2: CSV/JSON handlers
	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			importFile = input.files[0];
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
				importFile = droppedFile;
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
		if (!importFile) return;

		isLoading = true;
		error = '';
		result = null;

		try {
			result = await productsAPI.importProducts(importFile, {
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
		importFile = null;
		result = null;
		error = '';
	}

	function downloadTemplate(format: 'csv' | 'json') {
		window.open(productsAPI.getTemplateUrl(format), '_blank');
	}

	function resetAll() {
		currentStep = 1;
		zipFile = null;
		zipResult = null;
		zipError = '';
		importFile = null;
		result = null;
		error = '';
	}
</script>

<svelte:head>
	<title>Импорт/Экспорт товаров | Админ</title>
</svelte:head>

<div class="page-container">
	<header class="page-header">
		<div class="header-left">
			<a href="/products-admin" class="back-btn">
				<span class="icon">&larr;</span>
			</a>
			<h1>Импорт/Экспорт товаров</h1>
		</div>
	</header>

	<!-- Tabs -->
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'export'}
			onclick={() => activeTab = 'export'}
		>
			<span class="tab-icon">📤</span>
			<span>Экспорт</span>
		</button>
		<button
			class="tab"
			class:active={activeTab === 'import'}
			onclick={() => activeTab = 'import'}
		>
			<span class="tab-icon">📥</span>
			<span>Импорт</span>
		</button>
	</div>

	<!-- EXPORT TAB -->
	{#if activeTab === 'export'}
		<div class="tab-content">
			<section class="export-section">
				<h2>Выберите что экспортировать</h2>

				<div class="export-modes">
					<label class="radio-option">
						<input type="radio" bind:group={exportMode} value="first10" />
						<span class="radio-label">
							<span class="radio-title">Первые 10 товаров</span>
							<span class="radio-desc">Для проверки структуры файла</span>
						</span>
					</label>
					<label class="radio-option">
						<input type="radio" bind:group={exportMode} value="active" />
						<span class="radio-label">
							<span class="radio-title">Только активные товары</span>
							<span class="radio-desc">Товары со статусом "Активен"</span>
						</span>
					</label>
					<label class="radio-option">
						<input type="radio" bind:group={exportMode} value="all" />
						<span class="radio-label">
							<span class="radio-title">Все товары</span>
							<span class="radio-desc">Включая неактивные и удалённые</span>
						</span>
					</label>
				</div>
			</section>

			<section class="export-section">
				<h2>Фильтр по категориям</h2>
				<p class="hint">Оставьте пустым для экспорта всех категорий</p>

				{#if categoriesLoading}
					<div class="loading-placeholder">Загрузка категорий...</div>
				{:else if categories.length === 0}
					<div class="empty-placeholder">Категории не найдены</div>
				{:else}
					<div class="categories-list">
						{#each categories as category (category.id)}
							<label class="checkbox-option">
								<input
									type="checkbox"
									checked={selectedCategoryIds.includes(category.id)}
									onchange={() => toggleCategory(category.id)}
								/>
								<span class="checkbox-label">
									{category.name}
									<span class="category-count">({category.count || 0})</span>
								</span>
							</label>
						{/each}
					</div>
				{/if}
			</section>

			<section class="export-section">
				<h2>Формат файла</h2>
				<div class="format-options">
					<label class="radio-option inline">
						<input type="radio" bind:group={exportFormat} value="csv" />
						<span class="radio-label">CSV (Excel)</span>
					</label>
					<label class="radio-option inline">
						<input type="radio" bind:group={exportFormat} value="json" />
						<span class="radio-label">JSON</span>
					</label>
				</div>
			</section>

			<div class="export-actions">
				<button class="btn-export" onclick={handleExport}>
					<span class="btn-icon">📥</span>
					Скачать экспорт
				</button>
			</div>

			<div class="export-info">
				<h3>Формат экспорта</h3>
				<ul>
					<li><strong>Изображения:</strong> Упрощённые пути (<code>image.webp</code>) или <code>[no_image]</code></li>
					<li><strong>Вариации:</strong> Формат <code>название:цена|название:цена:старая_цена</code></li>
					<li><strong>Категории:</strong> Иерархия через <code>&gt;</code> (например: <code>Еда &gt; Пицца</code>)</li>
				</ul>
			</div>
		</div>
	{/if}

	<!-- IMPORT TAB -->
	{#if activeTab === 'import'}
		<div class="tab-content">
			<!-- Step indicator -->
			<div class="steps-indicator">
				<div class="step" class:active={currentStep === 1} class:completed={currentStep === 2 || zipResult}>
					<span class="step-number">{zipResult ? '✓' : '1'}</span>
					<span class="step-label">Изображения (ZIP)</span>
				</div>
				<div class="step-line"></div>
				<div class="step" class:active={currentStep === 2}>
					<span class="step-number">2</span>
					<span class="step-label">Импорт товаров</span>
				</div>
			</div>

			<!-- STEP 1: ZIP Upload -->
			{#if currentStep === 1}
				<section class="upload-section">
					<h2>Шаг 1: Загрузка изображений</h2>
					<p class="hint">
						Загрузите ZIP архив с изображениями товаров. Имена файлов должны соответствовать артикулам (SKU) товаров.
						<br>Например: <code>PRD001.jpg</code>, <code>PRD002.png</code>
					</p>

					<div
						class="drop-zone"
						class:drag-over={zipDragOver}
						class:has-file={zipFile}
						ondrop={handleZipDrop}
						ondragover={(e) => { e.preventDefault(); zipDragOver = true; }}
						ondragleave={() => zipDragOver = false}
					>
						{#if zipFile}
							<div class="file-info">
								<span class="file-icon">📦</span>
								<span class="file-name">{zipFile.name}</span>
								<span class="file-size">({(zipFile.size / 1024 / 1024).toFixed(2)} MB)</span>
								<button class="clear-btn" onclick={clearZipFile}>✕</button>
							</div>
						{:else}
							<div class="drop-content">
								<span class="upload-icon">📦</span>
								<p>Перетащите ZIP архив сюда или</p>
								<label class="file-input-label">
									<span>выберите файл</span>
									<input
										type="file"
										accept=".zip"
										onchange={handleZipSelect}
										style="display: none;"
									/>
								</label>
								<p class="formats">Формат: ZIP (до 50 MB)</p>
							</div>
						{/if}
					</div>

					{#if zipFile && !zipResult}
						<button
							class="upload-btn"
							onclick={handleZipUpload}
							disabled={zipUploading}
						>
							{#if zipUploading}
								<span class="spinner"></span>
								Загрузка изображений...
							{:else}
								Загрузить изображения
							{/if}
						</button>
					{/if}

					{#if zipError}
						<div class="error-message">
							<span class="icon">⚠️</span>
							{zipError}
						</div>
					{/if}

					{#if zipResult}
						<div class="zip-result">
							<h3>Изображения загружены</h3>
							<div class="zip-stats">
								<div class="stat success">
									<span class="stat-value">{zipResult.processed}</span>
									<span class="stat-label">Обработано</span>
								</div>
								{#if zipResult.errors.length > 0}
									<div class="stat warning">
										<span class="stat-value">{zipResult.errors.length}</span>
										<span class="stat-label">Ошибок</span>
									</div>
								{/if}
							</div>
							{#if zipResult.images.length > 0}
								<details class="images-list">
									<summary>Список изображений ({zipResult.images.length})</summary>
									<ul>
										{#each zipResult.images as img}
											<li><code>{img.filename}</code> → {img.url}</li>
										{/each}
									</ul>
								</details>
							{/if}
							<button class="btn-primary" onclick={goToStep2}>
								Продолжить к импорту →
							</button>
						</div>
					{/if}

					<div class="step-actions">
						<button class="btn-skip" onclick={skipZipStep}>
							Пропустить (без изображений) →
						</button>
					</div>
				</section>
			{/if}

			<!-- STEP 2: CSV/JSON Import -->
			{#if currentStep === 2}
				<button class="back-link" onclick={goBackToStep1}>
					← Назад к изображениям
				</button>

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
					<h2>Шаг 2: Загрузка файла импорта</h2>

					{#if zipResult}
						<div class="info-banner">
							<span class="icon">✅</span>
							Изображения загружены ({zipResult.processed} шт.). При импорте они будут автоматически привязаны к товарам по SKU.
						</div>
					{/if}

					<div
						class="drop-zone"
						class:drag-over={dragOver}
						class:has-file={importFile}
						ondrop={handleDrop}
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
					>
						{#if importFile}
							<div class="file-info">
								<span class="file-icon">📁</span>
								<span class="file-name">{importFile.name}</span>
								<span class="file-size">({(importFile.size / 1024).toFixed(1)} KB)</span>
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
						disabled={!importFile || isLoading}
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
							<button class="btn-secondary" onclick={resetAll}>Загрузить ещё</button>
						</div>
					</section>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.page-container {
		padding: 1rem;
		max-width: 800px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
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

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		background: white;
		padding: 0.5rem;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border: none;
		background: transparent;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 500;
		color: #666;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tab.active {
		background: var(--color-primary, #3b82f6);
		color: white;
	}

	.tab:not(.active):hover {
		background: #f0f0f0;
	}

	.tab-icon {
		font-size: 1.125rem;
	}

	.tab-content {
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Export Section */
	.export-section {
		background: white;
		border-radius: 12px;
		padding: 1rem;
		margin-bottom: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.export-modes {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.radio-option {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
		background: #f9fafb;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.radio-option:hover {
		background: #f0f0f0;
	}

	.radio-option input[type="radio"] {
		margin-top: 2px;
	}

	.radio-option.inline {
		display: inline-flex;
		padding: 0.5rem 1rem;
		margin-right: 0.5rem;
	}

	.radio-label {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.radio-option.inline .radio-label {
		flex-direction: row;
	}

	.radio-title {
		font-weight: 500;
	}

	.radio-desc {
		font-size: 0.75rem;
		color: #666;
	}

	.categories-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		max-height: 200px;
		overflow-y: auto;
		padding: 0.5rem;
		background: #f9fafb;
		border-radius: 8px;
	}

	.checkbox-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.checkbox-option:hover {
		border-color: var(--color-primary, #3b82f6);
	}

	.checkbox-option:has(input:checked) {
		background: #eff6ff;
		border-color: var(--color-primary, #3b82f6);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.category-count {
		color: #999;
		font-size: 0.75rem;
	}

	.format-options {
		display: flex;
		gap: 0.5rem;
	}

	.export-actions {
		margin-bottom: 1rem;
	}

	.btn-export {
		width: 100%;
		padding: 1rem;
		background: #22c55e;
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
		transition: background 0.2s;
	}

	.btn-export:hover {
		background: #16a34a;
	}

	.btn-icon {
		font-size: 1.25rem;
	}

	.export-info {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 12px;
		padding: 1rem;
	}

	.export-info h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		color: #166534;
	}

	.export-info ul {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.8125rem;
		color: #166534;
	}

	.export-info li {
		margin-bottom: 0.25rem;
	}

	.export-info code {
		background: rgba(255, 255, 255, 0.5);
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
		font-size: 0.75rem;
	}

	.loading-placeholder,
	.empty-placeholder {
		padding: 1rem;
		text-align: center;
		color: #666;
		font-size: 0.875rem;
	}

	.hint {
		color: #666;
		font-size: 0.875rem;
		margin: 0 0 0.75rem 0;
		line-height: 1.5;
	}

	/* Import Section Styles (copied from original) */
	.steps-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.step {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-size: 0.875rem;
		color: #999;
		transition: all 0.2s;
	}

	.step.active {
		background: #e8f4fd;
		color: #3b82f6;
		font-weight: 500;
	}

	.step.completed {
		color: #22c55e;
	}

	.step-number {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: currentColor;
		color: white;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.step.active .step-number {
		background: #3b82f6;
	}

	.step.completed .step-number {
		background: #22c55e;
	}

	.step-line {
		width: 40px;
		height: 2px;
		background: #e0e0e0;
	}

	section {
		background: white;
		border-radius: 12px;
		padding: 1rem;
		margin-bottom: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.hint code {
		background: #f5f5f5;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-size: 0.8125rem;
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

	.upload-btn {
		width: 100%;
		padding: 0.875rem;
		margin-top: 1rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 10px;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.upload-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.step-actions {
		margin-top: 1rem;
		text-align: center;
	}

	.btn-skip {
		background: none;
		border: none;
		color: #666;
		font-size: 0.875rem;
		cursor: pointer;
		text-decoration: underline;
	}

	.btn-skip:hover {
		color: #333;
	}

	.back-link {
		display: inline-block;
		margin-bottom: 1rem;
		color: #3b82f6;
		font-size: 0.875rem;
		cursor: pointer;
		background: none;
		border: none;
	}

	.info-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: #ecfdf5;
		border: 1px solid #bbf7d0;
		border-radius: 8px;
		font-size: 0.875rem;
		color: #166534;
		margin-bottom: 1rem;
	}

	.zip-result {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 10px;
		padding: 1rem;
		margin-top: 1rem;
	}

	.zip-result h3 {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		color: #166534;
	}

	.zip-stats {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.images-list {
		margin-bottom: 1rem;
		font-size: 0.8125rem;
	}

	.images-list summary {
		cursor: pointer;
		color: #166534;
	}

	.images-list ul {
		max-height: 150px;
		overflow-y: auto;
		margin: 0.5rem 0;
		padding-left: 1.25rem;
	}

	.images-list li {
		margin-bottom: 0.25rem;
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

	@media (max-width: 480px) {
		.results-stats {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
