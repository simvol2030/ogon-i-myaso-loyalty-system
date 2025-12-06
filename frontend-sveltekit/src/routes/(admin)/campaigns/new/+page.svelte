<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, Input, Select } from '$lib/components/ui';
	import { campaignsAPI, type SegmentFilters } from '$lib/api/admin/campaigns';

	// Form state
	let step = $state(1);
	let loading = $state(false);
	let audienceCount = $state(0);
	let loadingAudience = $state(false);

	// Campaign data
	let title = $state('');
	let messageText = $state('');
	let messageImage = $state<string | null>(null);
	let buttonText = $state('');
	let buttonUrl = $state('');

	// Targeting
	let targetType = $state<'all' | 'segment'>('all');
	let filters = $state<SegmentFilters>({});

	// Trigger
	let triggerType = $state<'manual' | 'scheduled'>('manual');
	let scheduledAt = $state('');

	// Image upload
	let imageFile = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let uploadingImage = $state(false);

	// Validation
	const isStep1Valid = $derived(title.trim().length > 0 && messageText.trim().length > 0);
	const isStep2Valid = $derived(targetType === 'all' || Object.keys(filters).length > 0);
	const isStep3Valid = $derived(triggerType === 'manual' || scheduledAt.length > 0);

	// Handle image selection
	const handleImageSelect = (event: Event) => {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (file) {
			imageFile = file;
			imagePreview = URL.createObjectURL(file);
		}
	};

	// Upload image
	const uploadImage = async () => {
		if (!imageFile) return;

		uploadingImage = true;
		try {
			const result = await campaignsAPI.uploadImage(imageFile);
			messageImage = result.url;
		} catch (error) {
			console.error('Error uploading image:', error);
			alert('Ошибка при загрузке изображения');
		} finally {
			uploadingImage = false;
		}
	};

	// Remove image
	const removeImage = () => {
		imageFile = null;
		imagePreview = null;
		messageImage = null;
	};

	// Preview audience
	const previewAudience = async () => {
		loadingAudience = true;
		try {
			const result = await campaignsAPI.previewAudience(targetType, targetType === 'segment' ? filters : undefined);
			audienceCount = result.count;
		} catch (error) {
			console.error('Error previewing audience:', error);
		} finally {
			loadingAudience = false;
		}
	};

	// Next step
	const nextStep = async () => {
		if (step === 1 && imageFile && !messageImage) {
			await uploadImage();
		}

		if (step === 2) {
			await previewAudience();
		}

		step++;
	};

	// Previous step
	const prevStep = () => {
		step--;
	};

	// Submit
	const submit = async () => {
		loading = true;
		try {
			const campaignData = {
				title,
				messageText,
				messageImage,
				buttonText: buttonText || null,
				buttonUrl: buttonUrl || null,
				targetType,
				targetFilters: targetType === 'segment' ? filters : null,
				triggerType,
				scheduledAt: triggerType === 'scheduled' ? scheduledAt : null
			};

			await campaignsAPI.create(campaignData);
			goto('/campaigns');
		} catch (error) {
			console.error('Error creating campaign:', error);
			alert('Ошибка при создании рассылки');
		} finally {
			loading = false;
		}
	};

	// Personalization hint
	const insertVariable = (variable: string) => {
		messageText += `{${variable}}`;
	};
</script>

<svelte:head>
	<title>Новая рассылка - Loyalty Admin</title>
</svelte:head>

<div class="new-campaign-page">
	<div class="page-header">
		<Button variant="ghost" onclick={() => goto('/campaigns')}>← Назад</Button>
		<h1>Новая рассылка</h1>
	</div>

	<div class="wizard">
		<!-- Steps indicator -->
		<div class="steps-indicator">
			<div class="step-item" class:active={step >= 1} class:completed={step > 1}>
				<span class="step-number">1</span>
				<span class="step-label">Сообщение</span>
			</div>
			<div class="step-connector" class:active={step > 1}></div>
			<div class="step-item" class:active={step >= 2} class:completed={step > 2}>
				<span class="step-number">2</span>
				<span class="step-label">Аудитория</span>
			</div>
			<div class="step-connector" class:active={step > 2}></div>
			<div class="step-item" class:active={step >= 3} class:completed={step > 3}>
				<span class="step-number">3</span>
				<span class="step-label">Отправка</span>
			</div>
			<div class="step-connector" class:active={step > 3}></div>
			<div class="step-item" class:active={step >= 4}>
				<span class="step-number">4</span>
				<span class="step-label">Подтверждение</span>
			</div>
		</div>

		<!-- Step 1: Message -->
		{#if step === 1}
			<div class="step-content">
				<h2>Шаг 1: Сообщение</h2>

				<div class="form-group">
					<label for="title">Название рассылки *</label>
					<Input id="title" bind:value={title} placeholder="Название для админки (не видно клиентам)" />
				</div>

				<div class="form-group">
					<label for="message">Текст сообщения *</label>
					<div class="variables-hint">
						Переменные:
						<button type="button" onclick={() => insertVariable('first_name')}>{'{first_name}'}</button>
						<button type="button" onclick={() => insertVariable('balance')}>{'{balance}'}</button>
						<button type="button" onclick={() => insertVariable('card_number')}>{'{card_number}'}</button>
					</div>
					<textarea
						id="message"
						bind:value={messageText}
						placeholder="Текст сообщения для клиентов"
						rows="5"
					></textarea>
				</div>

				<div class="form-group">
					<label>Изображение (опционально)</label>
					{#if imagePreview}
						<div class="image-preview">
							<img src={imagePreview} alt="Preview" />
							<button type="button" class="remove-image" onclick={removeImage}>✕</button>
						</div>
					{:else}
						<input type="file" accept="image/*" onchange={handleImageSelect} />
					{/if}
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="buttonText">Текст кнопки</label>
						<Input id="buttonText" bind:value={buttonText} placeholder="Открыть" />
					</div>
					<div class="form-group">
						<label for="buttonUrl">URL кнопки</label>
						<Input id="buttonUrl" bind:value={buttonUrl} placeholder="https://..." />
					</div>
				</div>
			</div>
		{/if}

		<!-- Step 2: Audience -->
		{#if step === 2}
			<div class="step-content">
				<h2>Шаг 2: Аудитория</h2>

				<div class="form-group">
					<label>Кому отправить?</label>
					<div class="radio-group">
						<label class="radio-option">
							<input type="radio" bind:group={targetType} value="all" />
							<span>Всем клиентам</span>
						</label>
						<label class="radio-option">
							<input type="radio" bind:group={targetType} value="segment" />
							<span>По фильтрам</span>
						</label>
					</div>
				</div>

				{#if targetType === 'segment'}
					<div class="filters-section">
						<h3>Фильтры</h3>

						<div class="form-row">
							<div class="form-group">
								<label>Мин. баланс</label>
								<Input type="number" bind:value={filters.balance_min} placeholder="0" />
							</div>
							<div class="form-group">
								<label>Макс. баланс</label>
								<Input type="number" bind:value={filters.balance_max} placeholder="10000" />
							</div>
						</div>

						<div class="form-row">
							<div class="form-group">
								<label>Неактивны дней</label>
								<Input type="number" bind:value={filters.inactive_days} placeholder="30" />
							</div>
							<div class="form-group">
								<label>Мин. покупок</label>
								<Input type="number" bind:value={filters.total_purchases_min} placeholder="0" />
							</div>
						</div>

						<div class="form-group">
							<label class="checkbox-option">
								<input type="checkbox" bind:checked={filters.has_birthday} />
								<span>Только с указанным днём рождения</span>
							</label>
						</div>
					</div>
				{/if}

				<div class="audience-preview">
					<Button variant="ghost" onclick={previewAudience} disabled={loadingAudience}>
						{loadingAudience ? 'Загрузка...' : 'Проверить количество'}
					</Button>
					{#if audienceCount > 0}
						<span class="audience-count">Получателей: {audienceCount}</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Step 3: Trigger -->
		{#if step === 3}
			<div class="step-content">
				<h2>Шаг 3: Когда отправить?</h2>

				<div class="form-group">
					<div class="radio-group">
						<label class="radio-option">
							<input type="radio" bind:group={triggerType} value="manual" />
							<span>Сохранить как черновик (отправить вручную)</span>
						</label>
						<label class="radio-option">
							<input type="radio" bind:group={triggerType} value="scheduled" />
							<span>Запланировать отправку</span>
						</label>
					</div>
				</div>

				{#if triggerType === 'scheduled'}
					<div class="form-group">
						<label for="scheduledAt">Дата и время отправки</label>
						<input
							type="datetime-local"
							id="scheduledAt"
							bind:value={scheduledAt}
							min={new Date().toISOString().slice(0, 16)}
						/>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Step 4: Confirmation -->
		{#if step === 4}
			<div class="step-content">
				<h2>Шаг 4: Подтверждение</h2>

				<div class="summary">
					<div class="summary-item">
						<span class="summary-label">Название:</span>
						<span class="summary-value">{title}</span>
					</div>

					<div class="summary-item">
						<span class="summary-label">Текст:</span>
						<span class="summary-value">{messageText.slice(0, 100)}...</span>
					</div>

					{#if messageImage}
						<div class="summary-item">
							<span class="summary-label">Изображение:</span>
							<span class="summary-value">Да</span>
						</div>
					{/if}

					<div class="summary-item">
						<span class="summary-label">Аудитория:</span>
						<span class="summary-value">
							{targetType === 'all' ? 'Все клиенты' : 'По фильтрам'} ({audienceCount} получателей)
						</span>
					</div>

					<div class="summary-item">
						<span class="summary-label">Отправка:</span>
						<span class="summary-value">
							{triggerType === 'manual' ? 'Вручную (черновик)' : `Запланировано на ${scheduledAt}`}
						</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Navigation -->
		<div class="wizard-navigation">
			{#if step > 1}
				<Button variant="ghost" onclick={prevStep}>← Назад</Button>
			{/if}

			<div class="spacer"></div>

			{#if step < 4}
				<Button
					variant="primary"
					onclick={nextStep}
					disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid) || uploadingImage}
				>
					{uploadingImage ? 'Загрузка...' : 'Далее →'}
				</Button>
			{:else}
				<Button variant="primary" onclick={submit} disabled={loading}>
					{loading ? 'Создание...' : 'Создать рассылку'}
				</Button>
			{/if}
		</div>
	</div>
</div>

<style>
	.new-campaign-page {
		max-width: 800px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.wizard {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		padding: 2rem;
	}

	.steps-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 2rem;
	}

	.step-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.step-number {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: #e5e7eb;
		color: #6b7280;
		font-weight: 600;
		font-size: 0.875rem;
	}

	.step-item.active .step-number {
		background: #3b82f6;
		color: white;
	}

	.step-item.completed .step-number {
		background: #10b981;
		color: white;
	}

	.step-label {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.step-item.active .step-label {
		color: #3b82f6;
		font-weight: 500;
	}

	.step-connector {
		width: 3rem;
		height: 2px;
		background: #e5e7eb;
		margin: 0 0.5rem;
		margin-bottom: 1.5rem;
	}

	.step-connector.active {
		background: #10b981;
	}

	.step-content h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #374151;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 1rem;
		resize: vertical;
		font-family: inherit;
	}

	textarea:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.variables-hint {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.variables-hint button {
		padding: 0.25rem 0.5rem;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.variables-hint button:hover {
		background: #e5e7eb;
	}

	.image-preview {
		position: relative;
		display: inline-block;
	}

	.image-preview img {
		max-width: 200px;
		max-height: 150px;
		border-radius: 0.5rem;
	}

	.remove-image {
		position: absolute;
		top: -0.5rem;
		right: -0.5rem;
		width: 1.5rem;
		height: 1.5rem;
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		font-size: 0.75rem;
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.radio-option, .checkbox-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.radio-option input, .checkbox-option input {
		width: 1rem;
		height: 1rem;
	}

	.filters-section {
		background: #f9fafb;
		padding: 1rem;
		border-radius: 0.5rem;
		margin-top: 1rem;
	}

	.filters-section h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.audience-preview {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
	}

	.audience-count {
		font-weight: 600;
		color: #10b981;
	}

	input[type="datetime-local"] {
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 1rem;
	}

	.summary {
		background: #f9fafb;
		padding: 1.5rem;
		border-radius: 0.5rem;
	}

	.summary-item {
		display: flex;
		padding: 0.75rem 0;
		border-bottom: 1px solid #e5e7eb;
	}

	.summary-item:last-child {
		border-bottom: none;
	}

	.summary-label {
		width: 120px;
		font-weight: 500;
		color: #6b7280;
	}

	.summary-value {
		flex: 1;
		color: #111827;
	}

	.wizard-navigation {
		display: flex;
		align-items: center;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e5e7eb;
	}

	.spacer {
		flex: 1;
	}

	@media (max-width: 768px) {
		.steps-indicator {
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.step-connector {
			display: none;
		}

		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
