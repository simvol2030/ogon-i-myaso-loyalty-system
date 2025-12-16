<script lang="ts">
	import type { Promotion, PromotionFormData } from '$lib/types/admin';
	import { Modal, Button, Input, Textarea } from '$lib/components/ui';
	import { promotionsAPI } from '$lib/api/admin/promotions';
	import { campaignsAPI } from '$lib/api/admin/campaigns';

	interface Props {
		isOpen: boolean;
		editingPromotion?: Promotion | null;
		onClose: () => void;
		onSuccess?: () => void;
	}

	let { isOpen, editingPromotion = null, onClose, onSuccess }: Props = $props();

	// Form state (Sprint 2 refactored)
	let formData = $state<PromotionFormData>({
		title: '',
		description: '',
		image: null, // HIGH FIX #2 (Cycle 2): Nullable to match type
		deadline: '',
		isActive: true,
		showOnHome: false
	});

	// Broadcast state
	let sendBroadcast = $state(false);
	let broadcastMessage = $state('');
	let audienceCount = $state<number | null>(null);
	let loadingAudience = $state(false);
	let broadcastSending = $state(false);
	let broadcastResult = $state<{ success: boolean; sent: number; failed: number; message: string } | null>(null);
	let savedPromotionId = $state<number | null>(null);

	let imagePreview = $state<string | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Reset form when modal opens/closes or editingPromotion changes
	$effect(() => {
		if (isOpen && editingPromotion) {
			formData = {
				title: editingPromotion.title,
				description: editingPromotion.description,
				image: editingPromotion.image, // Now correctly typed as string | null
				deadline: editingPromotion.deadline,
				isActive: editingPromotion.isActive,
				showOnHome: editingPromotion.showOnHome
			};
			imagePreview = editingPromotion.image; // Also string | null
			savedPromotionId = editingPromotion.id;
			// Reset broadcast for editing (don't auto-send for existing)
			sendBroadcast = false;
			broadcastMessage = '';
			broadcastResult = null;
		} else if (isOpen && !editingPromotion) {
			formData = {
				title: '',
				description: '',
				image: null, // HIGH FIX #2 (Cycle 2): Use null instead of empty string
				deadline: '',
				isActive: true,
				showOnHome: false
			};
			imagePreview = null;
			savedPromotionId = null;
			// Reset broadcast
			sendBroadcast = false;
			broadcastMessage = '';
			broadcastResult = null;
		}
	});

	// Load audience count when broadcast is enabled
	$effect(() => {
		if (sendBroadcast && audienceCount === null) {
			loadAudienceCount();
		}
	});

	// Auto-generate broadcast message from title/description
	$effect(() => {
		if (sendBroadcast && !broadcastMessage && formData.title) {
			broadcastMessage = `🎉 ${formData.title}\n\n${formData.description || ''}\n\n⏰ Срок: ${formData.deadline || 'Успейте воспользоваться!'}`;
		}
	});

	const loadAudienceCount = async () => {
		loadingAudience = true;
		try {
			const result = await campaignsAPI.previewAudience('all');
			audienceCount = result.count;
		} catch (err) {
			console.error('Error loading audience count:', err);
			audienceCount = 0;
		} finally {
			loadingAudience = false;
		}
	};

	const isFormValid = $derived(() => {
		if (!formData.title || formData.title.length < 3) return false;
		if (!formData.description || formData.description.length < 10) return false;
		// FIX #2: Image is optional - can be empty or valid URL
		if (formData.image && formData.image.length > 0 && formData.image.length < 3) return false;
		// H-002 FIX: Accept text deadline (e.g. "30 ноября", "Постоянная акция")
		if (!formData.deadline || formData.deadline.length < 3) return false;

		return true;
	});

	// Can send broadcast: either have message or can auto-generate from title
	const canSendBroadcast = $derived(() => {
		if (broadcastSending) return false;
		if (!savedPromotionId) return false;
		// Can send if we have message OR if we have title to generate message
		if (!broadcastMessage && !formData.title) return false;
		return true;
	});

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

			const response = await fetch('/api/admin/promotions/upload', {
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
			formData.image = null;
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
			let savedPromotion: Promotion;

			if (editingPromotion) {
				savedPromotion = await promotionsAPI.update(editingPromotion.id, formData);
			} else {
				savedPromotion = await promotionsAPI.create(formData);
			}

			// Save the promotion ID for broadcast
			savedPromotionId = savedPromotion.id;

			onSuccess?.();

			// If broadcast is enabled, don't close modal - let user send broadcast
			if (!sendBroadcast) {
				onClose();
			}
		} catch (err: any) {
			error = err.message || 'Ошибка при сохранении акции';
		} finally {
			loading = false;
		}
	};

	const handleSendBroadcast = async () => {
		if (!savedPromotionId) {
			error = 'Сначала сохраните акцию';
			return;
		}

		// Auto-generate message if empty
		let messageToSend = broadcastMessage;
		if (!messageToSend && formData.title) {
			messageToSend = `🎉 ${formData.title}\n\n${formData.description || ''}\n\n⏰ Срок: ${formData.deadline || 'Успейте воспользоваться!'}`;
			broadcastMessage = messageToSend;
		}

		if (!messageToSend) {
			error = 'Заполните текст рассылки';
			return;
		}

		broadcastSending = true;
		broadcastResult = null;
		error = null;

		try {
			// Create campaign with promotion link
			const campaign = await campaignsAPI.create({
				title: `Рассылка: ${formData.title}`,
				messageText: messageToSend,
				messageImage: formData.image || undefined,
				buttonText: 'Подробнее',
				buttonUrl: `/offers`, // Link to offers page (promotions page in TWA)
				targetType: 'all',
				triggerType: 'manual'
			});

			// Send immediately and get result
			const result = await campaignsAPI.send(campaign.id);

			broadcastResult = {
				success: true,
				sent: result.sent || audienceCount || 0,
				failed: result.failed || 0,
				message: `Рассылка успешно отправлена!`
			};
		} catch (broadcastErr: any) {
			console.error('Broadcast error:', broadcastErr);
			broadcastResult = {
				success: false,
				sent: 0,
				failed: audienceCount || 0,
				message: broadcastErr.message || 'Ошибка при отправке рассылки'
			};
		} finally {
			broadcastSending = false;
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

<Modal
	{isOpen}
	onClose={onClose}
	title={editingPromotion ? 'Редактировать акцию' : 'Создать акцию'}
	size="lg"
>
	<form onsubmit={handleSubmit} onkeydown={handleKeyDown}>
		<!-- Заголовок -->
		<Input
			label="Заголовок"
			placeholder="Например: Двойные баллы по выходным"
			bind:value={formData.title}
			minLength={3}
			maxLength={100}
			required
		/>

		<!-- Описание -->
		<Textarea
			label="Описание акции"
			placeholder="Полное описание акции с деталями"
			bind:value={formData.description}
			minLength={10}
			maxLength={1000}
			rows={5}
			required
		/>

		<!-- Изображение -->
		<div class="image-section">
			<label class="section-label">Изображение баннера *</label>

			<div class="image-upload-area">
				<!-- Image URL Input -->
				<Input
					label="URL изображения"
					placeholder="https://example.com/image.jpg"
					value={formData.image ?? undefined}
					onInput={handleImageUrlChange}
					maxLength={500}
				/>

				<!-- OR -->
				<div class="divider">
					<span>или</span>
				</div>

				<!-- File Upload -->
				<div class="file-upload-box">
					<label for="image-upload" class="file-upload-label">
						<span class="upload-icon">📁</span>
						<span>Загрузить файл</span>
						<span class="upload-hint">PNG, JPG, GIF до 5 МБ</span>
					</label>
					<input
						type="file"
						id="image-upload"
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

		<!-- Дедлайн (Text) - H-002 FIX: Changed from date to text for flexibility -->
		<div class="form-group">
			<label for="deadline-date">Срок действия *</label>
			<input
				type="text"
				id="deadline-date"
				bind:value={formData.deadline}
				class="date-input"
				placeholder="Например: 30 ноября, До конца месяца, Постоянная акция"
				required
			/>
			<small>Укажите срок действия акции в свободном формате</small>
		</div>

		<!-- Галочки -->
		<div class="checkboxes-section">
			<div class="checkbox-row">
				<label>
					<input type="checkbox" bind:checked={formData.isActive} />
					<span>✓ Акция активна (отображается в приложении)</span>
				</label>
			</div>

			<div class="checkbox-row">
				<label>
					<input type="checkbox" bind:checked={formData.showOnHome} />
					<span>✓ Показывать на главной странице TWA</span>
				</label>
			</div>
		</div>

		<!-- Broadcast Section (for both new and existing promotions) -->
		<div class="broadcast-section">
				<div class="broadcast-header">
					<label class="broadcast-toggle">
						<input type="checkbox" bind:checked={sendBroadcast} />
						<span>📣 Отправить рассылку об этой акции</span>
					</label>
					{#if sendBroadcast}
						<span class="audience-badge">
							{#if loadingAudience}
								⏳ Загрузка...
							{:else if audienceCount !== null}
								👥 {audienceCount.toLocaleString('ru-RU')} получателей
							{/if}
						</span>
					{/if}
				</div>

				{#if sendBroadcast}
					<div class="broadcast-content">
						<Textarea
							label="Текст рассылки"
							placeholder="Текст сообщения для рассылки в Telegram"
							bind:value={broadcastMessage}
							rows={6}
						/>
						<small class="broadcast-hint">
							💡 Текст сгенерирован автоматически на основе данных акции. Вы можете его отредактировать.
						</small>

						{#if formData.image}
							<div class="broadcast-preview">
								<span class="preview-label">🖼️ Изображение акции будет приложено к рассылке</span>
							</div>
						{/if}

						<!-- Send Broadcast Button -->
						<div class="broadcast-actions">
							{#if !broadcastResult?.success}
								<button
									type="button"
									class="send-broadcast-btn"
									onclick={handleSendBroadcast}
									disabled={!canSendBroadcast()}
								>
									{#if broadcastSending}
										<span class="spinner"></span>
										Отправка...
									{:else if !savedPromotionId}
										Сначала сохраните акцию
									{:else}
										📣 Отправить рассылку
									{/if}
								</button>
							{/if}

							{#if !savedPromotionId && !editingPromotion}
								<small class="broadcast-save-hint">⚠️ Сначала сохраните акцию, затем отправьте рассылку</small>
							{/if}
						</div>

						<!-- Broadcast Result Log -->
						{#if broadcastResult}
							<div class="broadcast-result" class:success={broadcastResult.success} class:error={!broadcastResult.success}>
								<div class="result-header">
									{#if broadcastResult.success}
										✅ {broadcastResult.message}
									{:else}
										❌ {broadcastResult.message}
									{/if}
								</div>
								<div class="result-stats">
									<span class="stat">
										<span class="stat-value">{broadcastResult.sent}</span>
										<span class="stat-label">отправлено</span>
									</span>
									{#if broadcastResult.failed > 0}
										<span class="stat error">
											<span class="stat-value">{broadcastResult.failed}</span>
											<span class="stat-label">ошибок</span>
										</span>
									{/if}
								</div>
								{#if broadcastResult.success}
									<button type="button" class="close-modal-btn" onclick={onClose}>
										Закрыть
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>

		<!-- Error -->
		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		<!-- Actions -->
		<div class="modal-actions">
			<Button variant="ghost" onclick={onClose} disabled={loading}>Отмена</Button>
			<Button type="submit" variant="primary" disabled={!isFormValid() || loading} {loading}>
				{editingPromotion ? 'Сохранить' : 'Создать'}
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

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
	}

	.date-input {
		width: 100%;
		padding: 0.625rem 0.875rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		transition: border-color 0.2s;
	}

	.date-input:focus {
		outline: none;
		border-color: #10b981;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
	}

	.form-group small {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #6b7280;
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

	/* Broadcast Section */
	.broadcast-section {
		background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
		border: 1px solid #bae6fd;
		border-radius: 0.75rem;
		padding: 1.25rem;
	}

	.broadcast-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.broadcast-toggle {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: #0369a1;
		cursor: pointer;
	}

	.broadcast-toggle input[type='checkbox'] {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
		accent-color: #0284c7;
	}

	.audience-badge {
		background: #0284c7;
		color: white;
		padding: 0.375rem 0.875rem;
		border-radius: 9999px;
		font-size: 0.8rem;
		font-weight: 500;
	}

	.broadcast-content {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #bae6fd;
	}

	.broadcast-hint {
		display: block;
		margin-top: 0.5rem;
		color: #0369a1;
		font-size: 0.8rem;
	}

	.broadcast-preview {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: white;
		border-radius: 0.5rem;
		border: 1px dashed #bae6fd;
	}

	.preview-label {
		color: #0369a1;
		font-size: 0.875rem;
	}

	/* Broadcast Actions */
	.broadcast-actions {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.send-broadcast-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.send-broadcast-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(3, 105, 161, 0.3);
	}

	.send-broadcast-btn:disabled {
		background: #9ca3af;
		cursor: not-allowed;
		opacity: 0.7;
	}

	.broadcast-save-hint {
		display: block;
		color: #b45309;
		font-size: 0.8rem;
		text-align: center;
	}

	/* Broadcast Result */
	.broadcast-result {
		margin-top: 1rem;
		padding: 1rem;
		border-radius: 0.5rem;
		border: 1px solid;
	}

	.broadcast-result.success {
		background: #ecfdf5;
		border-color: #10b981;
	}

	.broadcast-result.error {
		background: #fef2f2;
		border-color: #ef4444;
	}

	.result-header {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
	}

	.broadcast-result.success .result-header {
		color: #059669;
	}

	.broadcast-result.error .result-header {
		color: #dc2626;
	}

	.result-stats {
		display: flex;
		gap: 1.5rem;
		margin-bottom: 1rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #059669;
	}

	.stat.error .stat-value {
		color: #dc2626;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #6b7280;
		text-transform: uppercase;
	}

	.close-modal-btn {
		width: 100%;
		padding: 0.75rem 1rem;
		background: #10b981;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.close-modal-btn:hover {
		background: #059669;
	}

	/* Spinner */
	.spinner {
		width: 1rem;
		height: 1rem;
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
</style>
