<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { API_BASE_URL } from '$lib/config';

	let { data }: { data: PageData } = $props();

	// Form state with default values
	let message_text = $state('');
	let message_image = $state('');
	let button_text = $state('');
	let button_url = $state('{WEB_APP_URL}');
	let delay_seconds = $state(1);
	let order_number = $state(data.nextOrder);
	let is_active = $state(true);

	// UI state
	let isSaving = $state(false);
	let errorMessage = $state('');

	// Upload state
	let uploading = $state(false);
	let uploadProgress = $state(0);
	let uploadComplete = $state(false);
	let useUrlInput = $state(false); // Toggle between upload and URL input

	// Upload image with progress tracking
	function uploadImage(file: File): Promise<{ url: string }> {
		return new Promise((resolve, reject) => {
			const formData = new FormData();
			formData.append('file', file);

			const xhr = new XMLHttpRequest();

			// Track upload progress
			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable) {
					const percent = Math.round((event.loaded / event.total) * 100);
					uploadProgress = percent;
				}
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					try {
						const response = JSON.parse(xhr.responseText);
						if (response.success && response.data) {
							resolve(response.data);
						} else {
							reject(new Error(response.error || 'Ошибка загрузки'));
						}
					} catch {
						reject(new Error('Ошибка парсинга ответа сервера'));
					}
				} else {
					try {
						const errorData = JSON.parse(xhr.responseText);
						reject(new Error(errorData.error || `Ошибка загрузки: ${xhr.status}`));
					} catch {
						reject(new Error(`Ошибка загрузки: ${xhr.status}`));
					}
				}
			};

			xhr.onerror = () => {
				reject(new Error('Ошибка сети при загрузке файла'));
			};

			xhr.ontimeout = () => {
				reject(new Error('Превышено время ожидания загрузки'));
			};

			xhr.open('POST', `${API_BASE_URL}/admin/welcome-messages/upload`);
			xhr.withCredentials = true;
			xhr.timeout = 120000; // 2 minutes timeout
			xhr.send(formData);
		});
	}

	// Handle file selection
	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		if (!allowedTypes.includes(file.type)) {
			errorMessage = 'Неподдерживаемый формат. Разрешены: JPEG, PNG, WebP, GIF';
			input.value = '';
			return;
		}

		// Validate file size (10MB max)
		if (file.size > 10 * 1024 * 1024) {
			errorMessage = 'Файл слишком большой. Максимум 10 МБ';
			input.value = '';
			return;
		}

		uploading = true;
		uploadProgress = 0;
		uploadComplete = false;
		errorMessage = '';

		try {
			const result = await uploadImage(file);
			message_image = result.url;

			// Show success state briefly
			uploadComplete = true;
			setTimeout(() => {
				uploadComplete = false;
			}, 2000);
		} catch (err: any) {
			errorMessage = err.message || 'Ошибка загрузки изображения';
		} finally {
			uploading = false;
			uploadProgress = 0;
			input.value = '';
		}
	}

	// Remove image
	function removeImage() {
		message_image = '';
	}

	// Create message
	const createMessage = async () => {
		// Validation
		if (!message_text.trim()) {
			errorMessage = 'Текст сообщения обязателен';
			return;
		}

		if (delay_seconds < 0) {
			errorMessage = 'Задержка не может быть отрицательной';
			return;
		}

		if (order_number < 1) {
			errorMessage = 'Порядковый номер должен быть больше 0';
			return;
		}

		isSaving = true;
		errorMessage = '';

		try {
			const response = await fetch(`${API_BASE_URL}/admin/welcome-messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					message_text: message_text.trim(),
					message_image: message_image.trim() || null,
					button_text: button_text.trim() || null,
					button_url: button_url.trim() || null,
					delay_seconds,
					order_number,
					is_active
				})
			});

			const json = await response.json();

			if (!json.success) {
				errorMessage = json.error || 'Ошибка при создании';
				return;
			}

			// Redirect to list page
			goto('/campaigns/welcome');
		} catch (error) {
			console.error('Error creating message:', error);
			errorMessage = 'Ошибка при создании сообщения';
		} finally {
			isSaving = false;
		}
	};

	// Get full image URL for preview
	function getImageUrl(url: string): string {
		if (!url) return '';
		if (url.startsWith('http://') || url.startsWith('https://')) {
			return url;
		}
		// For local uploads, construct full URL
		return url;
	}
</script>

<div class="page-container">
	<div class="page-header">
		<div>
			<h1>Новое приветственное сообщение</h1>
			<p class="page-description">Создание нового сообщения для команды /start</p>
		</div>
		<button class="btn btn-secondary" onclick={() => goto('/campaigns/welcome')}>
			← Назад к списку
		</button>
	</div>

	{#if errorMessage}
		<div class="alert alert-error">
			{errorMessage}
		</div>
	{/if}

	<div class="form-card">
		<form onsubmit={(e) => { e.preventDefault(); createMessage(); }}>
			<div class="form-group">
				<label for="message_text">Текст сообщения *</label>
				<textarea
					id="message_text"
					bind:value={message_text}
					rows="6"
					placeholder="Введите текст приветственного сообщения"
					required
				></textarea>
				<div class="form-hint">Используйте переменные: &#123;first_name&#125;, &#123;last_name&#125;, &#123;username&#125;</div>
			</div>

			<div class="form-group">
				<div class="image-label-row">
					<label>Изображение</label>
					<button
						type="button"
						class="toggle-url-btn"
						onclick={() => useUrlInput = !useUrlInput}
					>
						{useUrlInput ? 'Загрузить файл' : 'Указать URL'}
					</button>
				</div>

				{#if useUrlInput}
					<!-- URL Input mode -->
					<input
						type="url"
						bind:value={message_image}
						placeholder="https://example.com/image.jpg"
					/>
					<div class="form-hint">Введите прямую ссылку на изображение</div>
				{:else}
					<!-- Upload mode -->
					{#if message_image}
						<!-- Image Preview -->
						<div class="image-preview">
							<img src={getImageUrl(message_image)} alt="Превью" />
							<div class="image-preview-overlay">
								<button type="button" class="remove-image-btn" onclick={removeImage}>
									Удалить
								</button>
							</div>
						</div>
					{:else}
						<!-- Upload Area -->
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
								<span class="upload-icon">📷</span>
								<span>Нажмите для загрузки изображения</span>
								<span class="upload-hint">JPEG, PNG, WebP, GIF (до 10 МБ)</span>
							{/if}
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp,image/gif"
								onchange={handleFileUpload}
								hidden
								disabled={uploading}
							/>
						</label>
					{/if}
				{/if}
			</div>

			<div class="form-row">
				<div class="form-group">
					<label for="button_text">Текст кнопки</label>
					<input
						type="text"
						id="button_text"
						bind:value={button_text}
						placeholder="Мурзи-коины"
					/>
				</div>

				<div class="form-group">
					<label for="button_url">URL кнопки</label>
					<input
						type="text"
						id="button_url"
						bind:value={button_url}
						placeholder="&#123;WEB_APP_URL&#125;"
					/>
					<div class="form-hint">Используйте &#123;WEB_APP_URL&#125; для ссылки на приложение</div>
				</div>
			</div>

			<div class="form-row">
				<div class="form-group">
					<label for="order_number">Порядковый номер *</label>
					<input
						type="number"
						id="order_number"
						bind:value={order_number}
						min="1"
						required
					/>
					<div class="form-hint">Порядок отправки сообщения (текущий максимум: {data.nextOrder - 1})</div>
				</div>

				<div class="form-group">
					<label for="delay_seconds">Задержка (секунды) *</label>
					<input
						type="number"
						id="delay_seconds"
						bind:value={delay_seconds}
						min="0"
						required
					/>
					<div class="form-hint">Задержка перед отправкой (0 = без задержки)</div>
				</div>
			</div>

			<div class="form-group">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={is_active}
					/>
					<span>Сообщение активно</span>
				</label>
			</div>

			<div class="form-actions">
				<button type="submit" class="btn btn-primary" disabled={isSaving || uploading}>
					{isSaving ? 'Создание...' : 'Создать сообщение'}
				</button>
				<button
					type="button"
					class="btn btn-secondary"
					onclick={() => goto('/campaigns/welcome')}
					disabled={isSaving}
				>
					Отмена
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	.page-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 32px;
	}

	h1 {
		font-size: 28px;
		font-weight: 600;
		margin: 0 0 8px 0;
		color: #111827;
	}

	.page-description {
		color: #6b7280;
		margin: 0;
	}

	.alert {
		padding: 12px 16px;
		border-radius: 6px;
		margin-bottom: 24px;
		font-size: 14px;
	}

	.alert-error {
		background: #fee2e2;
		color: #dc2626;
		border: 1px solid #fca5a5;
	}

	.form-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 24px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		margin-bottom: 20px;
	}

	label {
		display: block;
		font-weight: 500;
		margin-bottom: 8px;
		color: #374151;
		font-size: 14px;
	}

	.image-label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.image-label-row label {
		margin-bottom: 0;
	}

	.toggle-url-btn {
		background: none;
		border: none;
		color: #3b82f6;
		font-size: 13px;
		cursor: pointer;
		padding: 4px 8px;
	}

	.toggle-url-btn:hover {
		text-decoration: underline;
	}

	input[type="text"],
	input[type="url"],
	input[type="number"],
	textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 14px;
		color: #111827;
		transition: border-color 0.2s;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	textarea {
		resize: vertical;
		font-family: inherit;
	}

	.form-hint {
		font-size: 12px;
		color: #6b7280;
		margin-top: 4px;
	}

	/* Upload Area */
	.upload-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 24px;
		border: 2px dashed #d1d5db;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		background: #f9fafb;
		gap: 8px;
	}

	.upload-area:hover:not(.uploading) {
		border-color: #3b82f6;
		background: #eff6ff;
	}

	.upload-area.uploading {
		cursor: default;
		border-color: #3b82f6;
		background: #eff6ff;
	}

	.upload-area.upload-complete {
		border-color: #10b981;
		background: #d1fae5;
	}

	.upload-icon {
		font-size: 32px;
	}

	.upload-hint {
		font-size: 12px;
		color: #9ca3af;
	}

	.upload-progress-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 100%;
		max-width: 300px;
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
		background: #3b82f6;
		border-radius: 4px;
		transition: width 0.2s;
	}

	.upload-progress-text {
		font-size: 14px;
		color: #3b82f6;
	}

	.upload-success-icon {
		font-size: 32px;
		color: #10b981;
	}

	.upload-success-text {
		color: #10b981;
		font-weight: 500;
	}

	/* Image Preview */
	.image-preview {
		position: relative;
		border-radius: 8px;
		overflow: hidden;
		max-width: 400px;
	}

	.image-preview img {
		display: block;
		width: 100%;
		height: auto;
		max-height: 300px;
		object-fit: contain;
		background: #f3f4f6;
	}

	.image-preview-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.image-preview:hover .image-preview-overlay {
		opacity: 1;
	}

	.remove-image-btn {
		background: #dc2626;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
	}

	.remove-image-btn:hover {
		background: #b91c1c;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.checkbox-label input[type="checkbox"] {
		width: auto;
		cursor: pointer;
	}

	.form-actions {
		display: flex;
		gap: 12px;
		margin-top: 24px;
		padding-top: 24px;
		border-top: 1px solid #e5e7eb;
	}

	.btn {
		padding: 10px 20px;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2563eb;
	}

	.btn-secondary {
		background: #f3f4f6;
		color: #374151;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #e5e7eb;
	}

	@media (max-width: 768px) {
		.form-row {
			grid-template-columns: 1fr;
		}

		.page-header {
			flex-direction: column;
			gap: 16px;
		}
	}
</style>
