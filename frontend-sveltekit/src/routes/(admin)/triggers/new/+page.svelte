<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Button, Input, Select } from '$lib/components/ui';
	import { triggersAPI, type EventTypeInfo } from '$lib/api/admin/triggers';

	// Event types
	let eventTypes = $state<EventTypeInfo[]>([]);
	let loading = $state(false);
	let loadingData = $state(true);

	// Form state
	let name = $state('');
	let description = $state('');
	let eventType = $state('inactive_days');
	let eventConfig = $state<Record<string, any>>({});
	let messageTemplate = $state('');
	let imageUrl = $state('');
	let buttonText = $state('');
	let buttonUrl = $state('');
	let isActive = $state(true);
	let autoSend = $state(false);

	// Edit mode
	let editId = $state<number | null>(null);

	onMount(async () => {
		try {
			// Load event types
			eventTypes = await triggersAPI.getEventTypes();

			// Check for edit mode
			const urlEditId = $page.url.searchParams.get('edit');
			if (urlEditId) {
				editId = parseInt(urlEditId);
				const trigger = await triggersAPI.getById(editId);

				name = trigger.name;
				description = trigger.description || '';
				eventType = trigger.eventType;
				eventConfig = trigger.eventConfig || {};
				messageTemplate = trigger.messageTemplate;
				imageUrl = trigger.imageUrl || '';
				buttonText = trigger.buttonText || '';
				buttonUrl = trigger.buttonUrl || '';
				isActive = trigger.isActive;
				autoSend = trigger.autoSend;
			}
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loadingData = false;
		}
	});

	// Get current event type info
	const currentEventType = $derived(eventTypes.find(e => e.type === eventType));

	// Validation
	const isValid = $derived(name.trim().length > 0 && messageTemplate.trim().length > 0);

	// Personalization hint
	const insertVariable = (variable: string) => {
		messageTemplate += `{${variable}}`;
	};

	// Submit
	const submit = async () => {
		loading = true;
		try {
			const triggerData = {
				name,
				description: description || null,
				eventType,
				eventConfig: Object.keys(eventConfig).length > 0 ? eventConfig : null,
				messageTemplate,
				imageUrl: imageUrl || null,
				buttonText: buttonText || null,
				buttonUrl: buttonUrl || null,
				isActive,
				autoSend
			};

			if (editId) {
				await triggersAPI.update(editId, triggerData);
			} else {
				await triggersAPI.create(triggerData);
			}

			goto('/triggers');
		} catch (error) {
			console.error('Error saving trigger:', error);
			alert('Ошибка при сохранении триггера');
		} finally {
			loading = false;
		}
	};
</script>

<svelte:head>
	<title>{editId ? 'Редактирование' : 'Новый'} триггер - Loyalty Admin</title>
</svelte:head>

<div class="trigger-form-page">
	<div class="page-header">
		<Button variant="ghost" onclick={() => goto('/triggers')}>← К триггерам</Button>
		<h1>{editId ? 'Редактирование триггера' : 'Новый триггер'}</h1>
	</div>

	{#if loadingData}
		<div class="loading">Загрузка...</div>
	{:else}
		<div class="form-card">
			<!-- Basic info -->
			<section class="form-section">
				<h2>Основная информация</h2>

				<div class="form-group">
					<label for="name">Название триггера *</label>
					<Input id="name" bind:value={name} placeholder="Например: Реактивация неактивных" />
				</div>

				<div class="form-group">
					<label for="description">Описание</label>
					<Input id="description" bind:value={description} placeholder="Краткое описание для админки" />
				</div>
			</section>

			<!-- Event type -->
			<section class="form-section">
				<h2>Тип события</h2>

				<div class="form-group">
					<label for="eventType">Когда срабатывает *</label>
					<Select
						bind:value={eventType}
						options={eventTypes.map(e => ({ value: e.type, label: e.name }))}
					/>
					{#if currentEventType}
						<p class="field-hint">{currentEventType.description}</p>
					{/if}
				</div>

				<!-- Event config fields -->
				{#if currentEventType?.configFields.includes('days')}
					<div class="form-group">
						<label for="days">Количество дней</label>
						<Input type="number" id="days" bind:value={eventConfig.days} placeholder="30" />
					</div>
				{/if}

				{#if currentEventType?.configFields.includes('min_balance')}
					<div class="form-group">
						<label for="min_balance">Минимальный баланс</label>
						<Input type="number" id="min_balance" bind:value={eventConfig.min_balance} placeholder="1000" />
					</div>
				{/if}

				{#if currentEventType?.configFields.includes('max_balance')}
					<div class="form-group">
						<label for="max_balance">Максимальный баланс</label>
						<Input type="number" id="max_balance" bind:value={eventConfig.max_balance} placeholder="100" />
					</div>
				{/if}

				{#if currentEventType?.configFields.includes('count')}
					<div class="form-group">
						<label for="count">Количество покупок</label>
						<Input type="number" id="count" bind:value={eventConfig.count} placeholder="10" />
					</div>
				{/if}

				{#if currentEventType?.configFields.includes('years')}
					<div class="form-group">
						<label for="years">Количество лет</label>
						<Input type="number" id="years" bind:value={eventConfig.years} placeholder="1" />
					</div>
				{/if}

				{#if currentEventType?.configFields.includes('days_before')}
					<div class="form-group">
						<label for="days_before">За сколько дней до</label>
						<Input type="number" id="days_before" bind:value={eventConfig.days_before} placeholder="0" />
					</div>
				{/if}
			</section>

			<!-- Message -->
			<section class="form-section">
				<h2>Сообщение</h2>

				<div class="form-group">
					<label for="message">Шаблон сообщения *</label>
					<div class="variables-hint">
						Переменные:
						<button type="button" onclick={() => insertVariable('first_name')}>&#123;first_name&#125;</button>
						<button type="button" onclick={() => insertVariable('balance')}>&#123;balance&#125;</button>
						<button type="button" onclick={() => insertVariable('card_number')}>&#123;card_number&#125;</button>
					</div>
					<textarea
						id="message"
						bind:value={messageTemplate}
						placeholder="Привет, &#123;first_name&#125;! Мы заметили, что вы давно не заходили..."
						rows="5"
					></textarea>
				</div>

				<div class="form-group">
					<label for="imageUrl">URL изображения</label>
					<Input id="imageUrl" bind:value={imageUrl} placeholder="/api/uploads/campaigns/image.webp" />
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
			</section>

			<!-- Settings -->
			<section class="form-section">
				<h2>Настройки</h2>

				<div class="form-group">
					<label class="checkbox-option">
						<input type="checkbox" bind:checked={isActive} />
						<span>Триггер активен</span>
					</label>
					<p class="field-hint">Неактивные триггеры не срабатывают</p>
				</div>

				<div class="form-group">
					<label class="checkbox-option">
						<input type="checkbox" bind:checked={autoSend} />
						<span>Автоматическая отправка</span>
					</label>
					<p class="field-hint">При срабатывании автоматически создаёт и отправляет кампанию</p>
				</div>
			</section>

			<!-- Actions -->
			<div class="form-actions">
				<Button variant="ghost" onclick={() => goto('/triggers')}>Отмена</Button>
				<Button variant="primary" onclick={submit} disabled={!isValid || loading}>
					{loading ? 'Сохранение...' : editId ? 'Сохранить' : 'Создать триггер'}
				</Button>
			</div>
		</div>
	{/if}
</div>

<style>
	.trigger-form-page {
		max-width: 700px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 1rem 0 0 0;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.loading {
		text-align: center;
		padding: 4rem;
		color: #6b7280;
	}

	.form-card {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		padding: 2rem;
	}

	.form-section {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.form-section:last-of-type {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.form-section h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
	}

	.form-group {
		margin-bottom: 1.25rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #374151;
	}

	.field-hint {
		margin: 0.25rem 0 0 0;
		font-size: 0.875rem;
		color: #6b7280;
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

	.checkbox-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.checkbox-option input {
		width: 1rem;
		height: 1rem;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e5e7eb;
	}

	@media (max-width: 768px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
