<script lang="ts">
	import { onMount } from 'svelte';

	type Rating = 'Отлично' | 'Хорошо' | 'Удовлетворительно' | 'Неудовлетворительно';
	type Cause = 'Обслуживание' | 'Качество продуктов' | 'Цены' | 'Другое';
	type SlideState = 'rating' | 'feedback-form' | 'thank-you';

	// State
	let currentSlide = $state<SlideState>('rating');
	let selectedRating = $state<Rating | null>(null);
	let selectedCause = $state<Cause | null>(null);
	let wantToLeavePhone = $state(false);
	let phone = $state('');
	let feedback = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state('');
	let isRedirecting = $state(false);

	// Яндекс.Карты URL для положительных оценок
	const YANDEX_REVIEW_URL = 'https://yandex.ru/profile/18349245777/?add-review=true';

	// Маска для телефона
	function formatPhone(value: string): string {
		// Убираем все кроме цифр
		const digits = value.replace(/\D/g, '');

		// Форматируем в +7 (XXX) XXX-XX-XX
		if (digits.length === 0) return '';
		if (digits.length <= 1) return `+7`;
		if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
		if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
		if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
		return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
	}

	function handlePhoneInput(event: Event) {
		const input = event.target as HTMLInputElement;
		const cursorPosition = input.selectionStart || 0;
		const oldValue = phone;
		const newValue = formatPhone(input.value);

		phone = newValue;

		// Восстанавливаем позицию курсора
		setTimeout(() => {
			if (newValue.length < oldValue.length) {
				input.setSelectionRange(cursorPosition, cursorPosition);
			}
		}, 0);
	}

	async function handleRating(rating: Rating) {
		selectedRating = rating;

		if (rating === 'Неудовлетворительно') {
			// Показываем форму для негативной оценки
			currentSlide = 'feedback-form';
		} else {
			// Для положительных оценок: отправляем в API и редиректим на Яндекс
			isRedirecting = true;

			try {
				// Отправляем оценку для статистики и уведомления в Telegram
				await fetch('/api/ratings', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						rating,
						timestamp: new Date().toISOString()
					})
				});
			} catch (error) {
				console.error('Error sending positive rating:', error);
			}

			// Редирект на Яндекс.Карты
			window.location.href = YANDEX_REVIEW_URL;
		}
	}

	function handleCauseSelect(cause: Cause) {
		selectedCause = cause;
	}

	function goBack() {
		currentSlide = 'rating';
		selectedRating = null;
		selectedCause = null;
		wantToLeavePhone = false;
		phone = '';
		feedback = '';
		errorMessage = '';
	}

	async function submitFeedback() {
		errorMessage = '';

		// Валидация телефона только если пользователь хочет его оставить
		if (wantToLeavePhone && phone) {
			const phoneRegex = /^\+7\s?\(\d{3}\)\s?\d{3}-\d{2}-\d{2}$/;
			if (!phoneRegex.test(phone)) {
				errorMessage = 'Укажите корректный номер телефона (+7 (XXX) XXX-XX-XX)';
				return;
			}
		}

		isSubmitting = true;

		try {
			console.log('Отправка негативной оценки:', {
				rating: selectedRating,
				phone: wantToLeavePhone ? phone : undefined,
				cause: selectedCause,
				feedback,
				timestamp: new Date().toISOString()
			});

			const response = await fetch('/api/ratings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					rating: selectedRating,
					phone: (wantToLeavePhone && phone) ? phone : undefined,
					cause: selectedCause || undefined,
					feedback: feedback || undefined,
					timestamp: new Date().toISOString()
				})
			});

			console.log('Response status:', response.status);
			const data = await response.json();
			console.log('Response data:', data);

			if (!response.ok) {
				console.error('Ошибка сервера:', data);
				errorMessage = data.error || 'Произошла ошибка при отправке';
				isSubmitting = false;
				return;
			}

			// Переход к финальному слайду
			console.log('Успешно отправлено, переход к благодарности');
			currentSlide = 'thank-you';
		} catch (error) {
			console.error('Error submitting feedback:', error);
			errorMessage = `Не удалось отправить отзыв: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`;
			isSubmitting = false;
		} finally {
			if (currentSlide !== 'thank-you') {
				isSubmitting = false;
			}
		}
	}
</script>

<div class="reputation-widget">
	<!-- Slide 1: Выбор оценки -->
	{#if currentSlide === 'rating'}
		<div class="slide slide-rating">
			{#if isRedirecting}
				<h2>Перенаправление...</h2>
				<div class="redirecting-message">
					<div class="spinner"></div>
					<p>Открываем Яндекс.Карты для вашего отзыва...</p>
				</div>
			{:else}
				<h2>Пожалуйста, оцените нас:</h2>
				<div class="buttons-row">
					<button class="rating-button" onclick={() => handleRating('Отлично')}>
						<span class="rating-emoji">😊</span>
						<span>Отлично</span>
					</button>
					<button class="rating-button" onclick={() => handleRating('Хорошо')}>
						<span class="rating-emoji">🙂</span>
						<span>Хорошо</span>
					</button>
				</div>
				<div class="buttons-row">
					<button class="rating-button" onclick={() => handleRating('Удовлетворительно')}>
						<span class="rating-emoji">😐</span>
						<span>Удовлетворительно</span>
					</button>
					<button class="rating-button" onclick={() => handleRating('Неудовлетворительно')}>
						<span class="rating-emoji">☹️</span>
						<span>Неудовлетворительно</span>
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Slide 2: Форма обратной связи для негативной оценки -->
	{#if currentSlide === 'feedback-form'}
		<div class="slide slide-feedback">
			<h2>Что послужило причиной низкой оценки?</h2>

			<p class="optional-label">Выберите причину (необязательно):</p>
			<div class="buttons-row">
				<button
					class="cause-button {selectedCause === 'Обслуживание' ? 'selected' : ''}"
					onclick={() => handleCauseSelect('Обслуживание')}
				>
					Обслуживание
				</button>
				<button
					class="cause-button {selectedCause === 'Качество продуктов' ? 'selected' : ''}"
					onclick={() => handleCauseSelect('Качество продуктов')}
				>
					Качество продуктов
				</button>
			</div>
			<div class="buttons-row">
				<button
					class="cause-button {selectedCause === 'Цены' ? 'selected' : ''}"
					onclick={() => handleCauseSelect('Цены')}
				>
					Цены
				</button>
				<button
					class="cause-button {selectedCause === 'Другое' ? 'selected' : ''}"
					onclick={() => handleCauseSelect('Другое')}
				>
					Другое
				</button>
			</div>

			<div class="form-group">
				<label for="feedback">Оставьте ваш отзыв</label>
				<textarea
					id="feedback"
					bind:value={feedback}
					placeholder="Расскажите, что вам не понравилось..."
					rows="4"
				></textarea>
			</div>

			<div class="form-group checkbox-group">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={wantToLeavePhone} />
					<span>Оставить телефон для обратной связи</span>
				</label>
			</div>

			{#if wantToLeavePhone}
				<div class="form-group phone-field">
					<label for="phone">Телефон <span class="optional-hint">(необязательно)</span></label>
					<input
						id="phone"
						type="tel"
						bind:value={phone}
						oninput={handlePhoneInput}
						placeholder="+7 (___) ___-__-__"
						class="phone-input"
						maxlength="18"
					/>
				</div>
			{/if}

			{#if errorMessage}
				<div class="error-message">{errorMessage}</div>
			{/if}

			<div class="buttons-row">
				<button class="action-button back-button" onclick={goBack} disabled={isSubmitting}>
					Назад
				</button>
				<button class="action-button submit-button" onclick={submitFeedback} disabled={isSubmitting}>
					{isSubmitting ? 'Отправка...' : 'Отправить'}
				</button>
			</div>
		</div>
	{/if}

	<!-- Slide 3: Благодарность за обратную связь -->
	{#if currentSlide === 'thank-you'}
		<div class="slide slide-thanks">
			<p class="thanks-text">
				Нам очень жаль, что мы не смогли оправдать Ваши ожидания.
			</p>
			<p class="thanks-subtext">
				По данному случаю будет произведено разбирательство.
			</p>
			<div class="thanks-icon">😔</div>
		</div>
	{/if}
</div>

<style>
	.reputation-widget {
		max-width: 600px;
		margin: 0 auto;
		background-color: var(--color-card-bg, #1a1a1a);
		border-radius: var(--radius-lg, 12px);
		padding: var(--spacing-xl, 32px);
		box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.3));
	}

	.slide h2 {
		text-align: center;
		color: var(--color-text-primary, #ffffff);
		background: linear-gradient(135deg, var(--color-primary, #dc143c) 0%, var(--color-primary-dark, #a00) 100%);
		padding: var(--spacing-md, 16px);
		border-radius: var(--radius-md, 8px);
		margin-bottom: var(--spacing-lg, 24px);
		font-size: 20px;
		font-weight: 600;
	}

	.buttons-row {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing-md, 16px);
		margin-bottom: var(--spacing-md, 16px);
	}

	/* Redirecting state */
	.redirecting-message {
		text-align: center;
		padding: var(--spacing-xl, 32px);
	}

	.redirecting-message p {
		color: var(--color-text-primary, #ffffff);
		font-size: 16px;
		margin-top: var(--spacing-md, 16px);
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid rgba(220, 20, 60, 0.2);
		border-top-color: var(--color-primary, #dc143c);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Кнопки оценки */
	.rating-button {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(220, 20, 60, 0.1) 0%, rgba(220, 20, 60, 0.05) 100%);
		border: 2px solid rgba(220, 20, 60, 0.3);
		border-radius: var(--radius-md, 8px);
		padding: var(--spacing-lg, 24px) var(--spacing-sm, 8px);
		cursor: pointer;
		transition: all var(--transition-fast, 0.2s);
		font-weight: 600;
		font-size: 18px;
		color: var(--color-text-primary, #ffffff);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.rating-button:hover {
		transform: translateY(-4px);
		background: linear-gradient(135deg, rgba(220, 20, 60, 0.2) 0%, rgba(220, 20, 60, 0.1) 100%);
		border-color: var(--color-primary, #dc143c);
		box-shadow: 0 8px 24px rgba(220, 20, 60, 0.3);
	}

	.rating-button:active {
		transform: translateY(-2px);
	}

	.rating-emoji {
		font-size: 45px;
		margin-bottom: var(--spacing-sm, 8px);
	}

	/* Кнопки причин */
	.optional-label {
		color: var(--color-text-secondary, #b0b0b0);
		font-size: 14px;
		margin-bottom: var(--spacing-sm, 8px);
		text-align: center;
	}

	.cause-button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.08);
		border: 2px solid rgba(220, 20, 60, 0.4);
		border-radius: var(--radius-md, 8px);
		padding: var(--spacing-md, 16px);
		cursor: pointer;
		transition: all var(--transition-fast, 0.2s);
		font-weight: 700;
		font-size: 16px;
		color: var(--color-text-primary, #ffffff);
		min-height: 60px;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.cause-button:hover {
		background: rgba(220, 20, 60, 0.2);
		border-color: var(--color-primary, #dc143c);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(220, 20, 60, 0.3);
	}

	.cause-button.selected {
		background: linear-gradient(135deg, var(--color-primary, #dc143c) 0%, var(--color-primary-dark, #a00) 100%);
		border-color: var(--color-primary, #dc143c);
		color: #ffffff;
		box-shadow: 0 4px 16px rgba(220, 20, 60, 0.5);
		text-shadow: none;
		transform: translateY(-2px);
	}

	/* Форма */
	.form-group {
		margin-bottom: var(--spacing-lg, 24px);
	}

	.form-group label {
		display: block;
		margin-bottom: var(--spacing-sm, 8px);
		color: var(--color-text-primary, #ffffff);
		font-weight: 600;
		font-size: 14px;
	}

	.optional-hint {
		color: var(--color-text-secondary, #b0b0b0);
		font-weight: 400;
		font-size: 12px;
	}

	/* Checkbox group */
	.checkbox-group {
		margin-top: var(--spacing-md, 16px);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm, 12px);
		cursor: pointer;
		padding: var(--spacing-md, 16px);
		background: rgba(255, 255, 255, 0.05);
		border: 2px solid rgba(220, 20, 60, 0.3);
		border-radius: var(--radius-md, 8px);
		transition: all var(--transition-fast, 0.2s);
	}

	.checkbox-label:hover {
		background: rgba(220, 20, 60, 0.1);
		border-color: var(--color-primary, #dc143c);
	}

	.checkbox-label input[type="checkbox"] {
		width: 20px;
		height: 20px;
		accent-color: var(--color-primary, #dc143c);
		cursor: pointer;
	}

	.checkbox-label span {
		color: var(--color-text-primary, #ffffff);
		font-size: 14px;
	}

	/* Phone field animation */
	.phone-field {
		animation: slideDown 0.3s ease;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.phone-input,
	textarea {
		width: 100%;
		padding: var(--spacing-md, 16px);
		background-color: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(220, 20, 60, 0.4);
		border-radius: var(--radius-md, 8px);
		color: var(--color-text-primary, #ffffff);
		font-size: 16px;
		transition: all var(--transition-fast, 0.2s);
		box-sizing: border-box;
	}

	.phone-input::placeholder,
	textarea::placeholder {
		color: rgba(255, 255, 255, 0.5);
		font-style: italic;
	}

	.phone-input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--color-primary, #dc143c);
		background-color: rgba(220, 20, 60, 0.1);
		box-shadow: 0 0 0 3px rgba(220, 20, 60, 0.1);
	}

	textarea {
		resize: vertical;
		font-family: inherit;
		min-height: 100px;
	}

	/* Кнопки действий */
	.action-button {
		flex: 1;
		padding: var(--spacing-md, 16px) var(--spacing-lg, 24px);
		border-radius: var(--radius-md, 8px);
		font-weight: 700;
		font-size: 16px;
		cursor: pointer;
		transition: all var(--transition-fast, 0.2s);
		border: none;
	}

	.back-button {
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
		border: 2px solid rgba(255, 255, 255, 0.2);
		color: var(--color-text-primary, #ffffff);
	}

	.back-button:hover:not(:disabled) {
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.submit-button {
		background: linear-gradient(135deg, var(--color-primary, #dc143c) 0%, var(--color-primary-dark, #a00) 100%);
		color: #ffffff;
		box-shadow: 0 4px 16px rgba(220, 20, 60, 0.3);
	}

	.submit-button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 24px rgba(220, 20, 60, 0.5);
	}

	.action-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Сообщение об ошибке */
	.error-message {
		background-color: rgba(220, 20, 60, 0.1);
		border: 2px solid var(--color-accent-red, #dc143c);
		border-radius: var(--radius-md, 8px);
		padding: var(--spacing-md, 16px);
		margin-bottom: var(--spacing-lg, 24px);
		color: var(--color-accent-red, #dc143c);
		font-weight: 600;
		text-align: center;
	}

	/* Финальный слайд */
	.slide-thanks {
		text-align: center;
	}

	.thanks-text {
		font-size: 18px;
		font-weight: 600;
		color: var(--color-text-primary, #ffffff);
		margin-bottom: var(--spacing-md, 16px);
		line-height: 1.6;
	}

	.thanks-subtext {
		font-size: 16px;
		color: var(--color-text-secondary, #b0b0b0);
		margin-bottom: var(--spacing-xl, 32px);
		line-height: 1.5;
	}

	.thanks-icon {
		font-size: 80px;
		margin-top: var(--spacing-xl, 32px);
	}

	/* Адаптивность */
	@media (max-width: 768px) {
		.reputation-widget {
			padding: var(--spacing-lg, 24px);
		}

		.slide h2 {
			font-size: 18px;
			padding: var(--spacing-sm, 12px);
		}

		.rating-button {
			font-size: 16px;
			padding: var(--spacing-md, 16px) var(--spacing-xs, 4px);
		}

		.rating-emoji {
			font-size: 40px;
		}

		.cause-button {
			font-size: 14px;
			padding: var(--spacing-sm, 12px);
			min-height: 50px;
		}
	}

	@media (max-width: 480px) {
		.buttons-row {
			flex-direction: column;
			gap: var(--spacing-sm, 12px);
		}

		.rating-button,
		.cause-button {
			width: 100%;
		}
	}
</style>
