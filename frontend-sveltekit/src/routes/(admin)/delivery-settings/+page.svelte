<script lang="ts">
	import { onMount } from 'svelte';
	import { freeDeliverySettingsAPI, type FreeDeliverySettings } from '$lib/api/admin/free-delivery-settings';

	// State
	let loading = $state(true);
	let saving = $state(false);
	let settings = $state<FreeDeliverySettings | null>(null);
	let error = $state('');
	let success = $state('');

	// Form state
	let isEnabled = $state(true);
	let defaultThreshold = $state('3000');
	let widgetEnabled = $state(true);
	let widgetTitle = $state('Бесплатная доставка');
	let widgetText = $state('При заказе от {threshold}₽ доставка бесплатная в выбранные населённые пункты');
	let widgetIcon = $state('🚚');
	let toastEnabled = $state(true);
	let toastText = $state('Добавьте ещё на {remaining}₽ — доставка может быть бесплатной!');
	let toastShowThreshold = $state('500');

	// Load settings
	async function loadSettings() {
		loading = true;
		error = '';

		try {
			settings = await freeDeliverySettingsAPI.get();

			// Populate form
			isEnabled = settings.is_enabled;
			defaultThreshold = settings.default_threshold.toString();
			widgetEnabled = settings.widget_enabled;
			widgetTitle = settings.widget_title;
			widgetText = settings.widget_text;
			widgetIcon = settings.widget_icon;
			toastEnabled = settings.toast_enabled;
			toastText = settings.toast_text;
			toastShowThreshold = settings.toast_show_threshold.toString();
		} catch (e: any) {
			error = e.message || 'Failed to load settings';
		} finally {
			loading = false;
		}
	}

	// Save settings
	async function handleSave() {
		saving = true;
		error = '';
		success = '';

		try {
			const data = {
				is_enabled: isEnabled,
				default_threshold: parseInt(defaultThreshold) || 3000,
				widget_enabled: widgetEnabled,
				widget_title: widgetTitle.trim(),
				widget_text: widgetText,
				widget_icon: widgetIcon,
				toast_enabled: toastEnabled,
				toast_text: toastText,
				toast_show_threshold: parseInt(toastShowThreshold) || 500
			};

			await freeDeliverySettingsAPI.update(data);
			success = 'Настройки сохранены успешно';
			await loadSettings();
			setTimeout(() => success = '', 3000);
		} catch (e: any) {
			error = e.message || 'Failed to save settings';
		} finally {
			saving = false;
		}
	}

	// Preview text with placeholder replacement
	const widgetPreview = $derived(
		widgetText.replace('{threshold}', parseInt(defaultThreshold).toLocaleString('ru-RU'))
	);
	const toastPreview = $derived(
		toastText.replace('{remaining}', parseInt(toastShowThreshold).toLocaleString('ru-RU'))
	);

	onMount(() => {
		loadSettings();
	});
</script>

<svelte:head>
	<title>Настройки бесплатной доставки</title>
</svelte:head>

<div class="page-container">
	<header class="page-header">
		<h1>Настройки бесплатной доставки</h1>
	</header>

	{#if error}
		<div class="alert alert-error">{error}</div>
	{/if}

	{#if success}
		<div class="alert alert-success">{success}</div>
	{/if}

	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Загрузка...</p>
		</div>
	{:else}
		<form onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
			<!-- Global Settings -->
			<section class="settings-section">
				<h2>Глобальные настройки</h2>

				<div class="form-group checkbox-group">
					<label>
						<input type="checkbox" bind:checked={isEnabled} />
						Модуль бесплатной доставки включен
					</label>
					<small>Когда выключен, бесплатная доставка не применяется ни к одной локации</small>
				</div>

				<div class="form-group">
					<label for="defaultThreshold">Порог по умолчанию (₽)</label>
					<input
						type="number"
						id="defaultThreshold"
						bind:value={defaultThreshold}
						placeholder="3000"
						min="0"
						step="100"
					/>
					<small>Используется в виджете для отображения общего порога</small>
				</div>
			</section>

			<!-- Widget Settings -->
			<section class="settings-section">
				<h2>Виджет на главной странице</h2>

				<div class="form-group checkbox-group">
					<label>
						<input type="checkbox" bind:checked={widgetEnabled} />
						Показывать виджет на главной
					</label>
				</div>

				{#if widgetEnabled}
					<div class="widget-settings">
						<div class="form-group">
							<label for="widgetTitle">Заголовок</label>
							<input
								type="text"
								id="widgetTitle"
								bind:value={widgetTitle}
								placeholder="Бесплатная доставка"
							/>
						</div>

						<div class="form-group">
							<label for="widgetText">Текст</label>
							<textarea
								id="widgetText"
								bind:value={widgetText}
								placeholder="При заказе от {threshold}₽ доставка бесплатная"
								rows="2"
							></textarea>
							<small>Используйте <code>{'{threshold}'}</code> для подстановки порога</small>
						</div>

						<div class="form-group">
							<label for="widgetIcon">Иконка (эмодзи)</label>
							<input
								type="text"
								id="widgetIcon"
								bind:value={widgetIcon}
								placeholder="🚚"
								maxlength="4"
								class="icon-input"
							/>
						</div>

						<!-- Preview -->
						<div class="preview-box">
							<h4>Предпросмотр виджета:</h4>
							<div class="widget-preview">
								<span class="preview-icon">{widgetIcon}</span>
								<div class="preview-content">
									<strong>{widgetTitle}</strong>
									<p>{widgetPreview}</p>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</section>

			<!-- Toast Settings -->
			<section class="settings-section">
				<h2>Toast-уведомление при добавлении в корзину</h2>

				<div class="form-group checkbox-group">
					<label>
						<input type="checkbox" bind:checked={toastEnabled} />
						Показывать toast при добавлении товара
					</label>
				</div>

				{#if toastEnabled}
					<div class="toast-settings">
						<div class="form-group">
							<label for="toastText">Текст уведомления</label>
							<textarea
								id="toastText"
								bind:value={toastText}
								placeholder="Добавьте ещё на {remaining}₽..."
								rows="2"
							></textarea>
							<small>Используйте <code>{'{remaining}'}</code> для подстановки оставшейся суммы</small>
						</div>

						<div class="form-group">
							<label for="toastShowThreshold">Показывать когда осталось ≤ (₽)</label>
							<input
								type="number"
								id="toastShowThreshold"
								bind:value={toastShowThreshold}
								placeholder="500"
								min="0"
								step="100"
							/>
							<small>Toast появляется когда до порога остаётся меньше указанной суммы</small>
						</div>

						<!-- Preview -->
						<div class="preview-box toast-preview-box">
							<h4>Предпросмотр toast:</h4>
							<div class="toast-preview">
								{toastPreview}
							</div>
						</div>
					</div>
				{/if}
			</section>

			<!-- Locations with Threshold -->
			{#if settings?.locations_with_threshold && settings.locations_with_threshold.length > 0}
				<section class="settings-section">
					<h2>Локации с бесплатной доставкой</h2>
					<p class="section-description">
						Эти локации участвуют в акции. Редактировать можно на странице
						<a href="/delivery-locations">Локации доставки</a>.
					</p>

					<div class="locations-list">
						{#each settings.locations_with_threshold as location}
							<div class="location-item" class:disabled={!location.is_enabled}>
								<span class="location-name">{location.name}</span>
								<span class="location-threshold">
									🚚 от {location.free_delivery_threshold?.toLocaleString('ru-RU')} ₽
								</span>
								{#if !location.is_enabled}
									<span class="disabled-badge">Отключена</span>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			{:else}
				<section class="settings-section">
					<h2>Локации с бесплатной доставкой</h2>
					<div class="empty-locations">
						<p>Нет локаций с настроенным порогом бесплатной доставки.</p>
						<a href="/delivery-locations" class="btn btn-secondary">
							Настроить локации
						</a>
					</div>
				</section>
			{/if}

			<!-- Save Button -->
			<div class="form-actions">
				<button type="submit" class="btn btn-primary" disabled={saving}>
					{saving ? 'Сохранение...' : 'Сохранить настройки'}
				</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.page-container {
		padding: 24px;
		max-width: 800px;
		margin: 0 auto;
	}

	.page-header {
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

	.loading {
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

	.settings-section {
		background: var(--card-bg, var(--bg-white));
		border-radius: 12px;
		padding: 24px;
		margin-bottom: 24px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.settings-section h2 {
		font-size: 18px;
		font-weight: 600;
		margin: 0 0 16px 0;
		color: var(--text-primary);
	}

	.section-description {
		font-size: 14px;
		color: var(--text-secondary);
		margin-bottom: 16px;
	}

	.section-description a {
		color: var(--primary-orange);
		text-decoration: none;
	}

	.section-description a:hover {
		text-decoration: underline;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-group label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.form-group input[type="text"],
	.form-group input[type="number"],
	.form-group textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		font-size: 14px;
		box-sizing: border-box;
		transition: all 0.2s ease;
	}

	.form-group input:focus,
	.form-group textarea:focus {
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

	.form-group small code {
		background: var(--bg-tertiary, #f1f5f9);
		padding: 2px 6px;
		border-radius: 4px;
		font-family: monospace;
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

	.icon-input {
		width: 80px !important;
		font-size: 24px !important;
		text-align: center;
	}

	.widget-settings,
	.toast-settings {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border-color);
		animation: slideDown 0.2s ease;
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.preview-box {
		background: var(--bg-light, #f8fafc);
		border-radius: 12px;
		padding: 16px;
		margin-top: 16px;
	}

	.preview-box h4 {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		margin: 0 0 12px 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.widget-preview {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		background: linear-gradient(135deg, #fef3c7, #fde68a);
		padding: 16px;
		border-radius: 12px;
	}

	.preview-icon {
		font-size: 32px;
		flex-shrink: 0;
	}

	.preview-content strong {
		display: block;
		font-size: 16px;
		color: #92400e;
		margin-bottom: 4px;
	}

	.preview-content p {
		font-size: 14px;
		color: #92400e;
		margin: 0;
		opacity: 0.9;
	}

	.toast-preview-box {
		background: #fef3c7;
	}

	.toast-preview {
		background: #fbbf24;
		color: #78350f;
		padding: 12px 16px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 500;
	}

	.locations-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.location-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: var(--bg-light, #f8fafc);
		border-radius: 8px;
	}

	.location-item.disabled {
		opacity: 0.5;
	}

	.location-name {
		flex: 1;
		font-weight: 500;
		color: var(--text-primary);
	}

	.location-threshold {
		font-size: 13px;
		color: #92400e;
		background: #fef3c7;
		padding: 4px 10px;
		border-radius: 12px;
	}

	.disabled-badge {
		font-size: 11px;
		color: #6b7280;
		background: #e5e7eb;
		padding: 2px 8px;
		border-radius: 8px;
	}

	.empty-locations {
		text-align: center;
		padding: 24px;
		background: var(--bg-light, #f8fafc);
		border-radius: 8px;
	}

	.empty-locations p {
		color: var(--text-secondary);
		margin: 0 0 16px 0;
	}

	.form-actions {
		padding-top: 24px;
	}

	.btn {
		padding: 12px 24px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 600;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		text-decoration: none;
		display: inline-block;
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

	.btn-secondary:hover {
		background: var(--border-color);
	}
</style>
