<script lang="ts">
	import { onMount } from 'svelte';

	type Rating = 'Отлично' | 'Хорошо' | 'Удовлетворительно' | 'Неудовлетворительно';
	type Cause = 'Обслуживание' | 'Качество продуктов' | 'Цены' | 'Другое';
	type SlideState = 'rating' | 'copy-link' | 'feedback-form' | 'thank-you';

	// State
	let currentSlide = $state<SlideState>('rating');
	let selectedRating = $state<Rating | null>(null);
	let selectedCause = $state<Cause | null>(null);
	let phone = $state('');
	let feedback = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state('');
	let linkCopied = $state(false);

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
			// Для положительных оценок отправляем в фоне для статистики
			try {
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

			// Показываем инструкцию с копированием ссылки
			currentSlide = 'copy-link';
		}
	}

	async function copyLinkToClipboard() {
		try {
			await navigator.clipboard.writeText(YANDEX_REVIEW_URL);
			linkCopied = true;

			// Сбрасываем индикатор через 3 секунды
			setTimeout(() => {
				linkCopied = false;
			}, 3000);
		} catch (error) {
			console.error('Failed to copy link:', error);
			alert('Не удалось скопировать ссылку. Пожалуйста, скопируйте вручную.');
		}
	}

	function handleCauseSelect(cause: Cause) {
		selectedCause = cause;
	}

	function goBack() {
		currentSlide = 'rating';
		selectedRating = null;
		selectedCause = null;
		phone = '';
		feedback = '';
		errorMessage = '';
		linkCopied = false;
	}

	async function submitFeedback() {
		errorMessage = '';

		// Валидация телефона
		const phoneRegex = /^\+7\s?\(\d{3}\)\s?\d{3}-\d{2}-\d{2}$/;
		if (!phone || !phoneRegex.test(phone)) {
			errorMessage = 'Укажите корректный номер телефона (+7 (XXX) XXX-XX-XX)';
			return;
		}

		isSubmitting = true;

		try {
			console.log('Отправка негативной оценки:', {
				rating: selectedRating,
				phone,
				cause: selectedCause,
				feedback,
				timestamp: new Date().toISOString()
			});

			const response = await fetch('/api/ratings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					rating: selectedRating,
					phone,
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
		</div>
	{/if}

	<!-- Slide 2: Инструкция с копированием ссылки (для положительных оценок) -->
	{#if currentSlide === 'copy-link'}
		<div class="slide slide-copy-link">
			<h2>📝 Спасибо за положительную оценку!</h2>

			<div class="instructions">
				<p><strong>Чтобы оставить отзыв на Яндекс.Картах:</strong></p>
				<ol>
					<li>Нажмите кнопку <strong>"Копировать ссылку"</strong> ниже</li>
					<li>Закройте Telegram</li>
					<li>Откройте браузер на телефоне (Chrome/Safari)</li>
					<li>Вставьте скопированную ссылку в адресную строку</li>
					<li>Оставьте отзыв на Яндекс.Картах</li>
				</ol>
				<p class="help-text">Ваш отзыв поможет нам стать лучше! ❤️</p>
			</div>

			<button
				class="copy-button {linkCopied ? 'copied' : ''}"
				onclick={copyLinkToClipboard}
				disabled={linkCopied}
			>
				{linkCopied ? '✅ Ссылка скопирована!' : '📋 Копировать ссылку'}
			</button>

			<div class="link-fallback">
				<p class="fallback-text">Или скопируйте ссылку вручную:</p>
				<div class="link-box" onclick={(e) => {
					const selection = window.getSelection();
					const range = document.createRange();
					range.selectNodeContents(e.currentTarget);
					selection?.removeAllRanges();
					selection?.addRange(range);
				}}>
					{YANDEX_REVIEW_URL}
				</div>
			</div>

			<button class="action-button back-button" onclick={goBack}>
				Назад
			</button>
		</div>
	{/if}

	<!-- Slide 3: Форма обратной связи для негативной оценки -->
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
				<label for="phone">Телефон <span class="required">*</span></label>
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

			<div class="form-group">
				<label for="feedback">Оставьте ваш отзыв</label>
				<textarea
					id="feedback"
					bind:value={feedback}
					placeholder="Расскажите, что вам не понравилось..."
					rows="4"
				></textarea>
			</div>

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

	<!-- Slide 4: Благодарность за обратную связь -->
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

	/* Инструкция с копированием */
	.slide-copy-link {
		text-align: center;
	}

	.instructions {
		margin-bottom: var(--spacing-xl, 32px);
		text-align: left;
	}

	.instructions p {
		color: var(--color-text-primary, #ffffff);
		margin-bottom: var(--spacing-md, 16px);
		font-size: 16px;
	}

	.instructions ol {
		color: var(--color-text-primary, #ffffff);
		padding-left: var(--spacing-lg, 24px);
		margin-bottom: var(--spacing-md, 16px);
	}

	.instructions li {
		margin-bottom: var(--spacing-sm, 8px);
		line-height: 1.5;
	}

	.help-text {
		text-align: center;
		font-weight: 600;
		color: var(--color-primary, #dc143c);
	}

	.copy-button {
		width: 100%;
		padding: var(--spacing-lg, 24px);
		background: linear-gradient(135deg, var(--color-primary, #dc143c) 0%, var(--color-primary-dark, #a00) 100%);
		color: #ffffff;
		border: none;
		border-radius: var(--radius-md, 8px);
		font-size: 18px;
		font-weight: 700;
		cursor: pointer;
		transition: all var(--transition-fast, 0.2s);
		box-shadow: 0 4px 16px rgba(220, 20, 60, 0.3);
		margin-bottom: var(--spacing-lg, 24px);
	}

	.copy-button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 24px rgba(220, 20, 60, 0.5);
	}

	.copy-button.copied {
		background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%);
	}

	.copy-button:disabled {
		cursor: not-allowed;
	}

	.link-fallback {
		margin-bottom: var(--spacing-xl, 32px);
	}

	.fallback-text {
		color: var(--color-text-secondary, #b0b0b0);
		font-size: 14px;
		margin-bottom: var(--spacing-sm, 8px);
		text-align: center;
	}

	.link-box {
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(220, 20, 60, 0.4);
		border-radius: var(--radius-md, 8px);
		padding: var(--spacing-md, 16px);
		color: var(--color-text-primary, #ffffff);
		font-size: 14px;
		word-break: break-all;
		cursor: text;
		user-select: all;
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

	.required {
		color: var(--color-accent-red, #dc143c);
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
