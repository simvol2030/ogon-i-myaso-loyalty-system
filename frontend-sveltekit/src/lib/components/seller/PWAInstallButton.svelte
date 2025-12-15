<!--
  PWA Install Button Component
  - Floating button для установки PWA
  - Автоматически показывается когда приложение можно установить
  - Скрывается после установки
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// Props
	let { variant = 'floating' } = $props<{
		variant?: 'floating' | 'inline';
	}>();

	// State
	let deferredPrompt: any = $state(null);
	let showButton = $state(false);
	let isInstalling = $state(false);
	let isIOS = $state(false);
	let showIOSInstructions = $state(false);

	onMount(() => {
		if (!browser) return;

		// Проверяем, уже установлено ли приложение
		const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
		console.log('[PWA Button] Standalone mode:', isStandalone);

		if (isStandalone) {
			console.log('[PWA Button] App already installed, hiding button');
			showButton = false;
			return;
		}

		// Определяем iOS
		const userAgent = window.navigator.userAgent.toLowerCase();
		isIOS = /iphone|ipad|ipod/.test(userAgent);
		console.log('[PWA Button] Is iOS:', isIOS);

		// Для iOS показываем кнопку сразу (у них нет beforeinstallprompt)
		if (isIOS) {
			console.log('[PWA Button] Showing button for iOS');
			showButton = true;
			return;
		}

		// Слушаем событие beforeinstallprompt
		const handleBeforeInstallPrompt = (e: Event) => {
			console.log('[PWA Button] beforeinstallprompt event fired');
			// Предотвращаем автоматическое появление браузерного промпта
			e.preventDefault();
			deferredPrompt = e;
			showButton = true;
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

		// Слушаем событие установки
		window.addEventListener('appinstalled', () => {
			console.log('[PWA Button] App installed');
			deferredPrompt = null;
			showButton = false;
		});

		// Показываем кнопку через 3 секунды если событие не сработало (fallback)
		const fallbackTimer = setTimeout(() => {
			if (!deferredPrompt && !showButton && !isStandalone) {
				console.log('[PWA Button] Fallback: showing button after timeout');
				showButton = true;
			}
		}, 3000);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			clearTimeout(fallbackTimer);
		};
	});

	async function handleInstallClick() {
		// Для iOS показываем инструкцию
		if (isIOS) {
			showIOSInstructions = true;
			return;
		}

		// Для Android/Desktop - используем deferredPrompt
		if (!deferredPrompt) {
			console.log('[PWA Button] No deferred prompt available');
			// Показываем инструкцию как fallback
			showIOSInstructions = true;
			return;
		}

		isInstalling = true;

		try {
			console.log('[PWA Button] Showing install prompt');
			// Показываем native install prompt
			deferredPrompt.prompt();

			// Ждем выбора пользователя
			const { outcome } = await deferredPrompt.userChoice;

			if (outcome === 'accepted') {
				console.log('[PWA Button] Install accepted');
			} else {
				console.log('[PWA Button] Install declined');
			}

			// Очищаем промпт
			deferredPrompt = null;
			showButton = false;
		} catch (err) {
			console.error('[PWA Button] Install error:', err);
		} finally {
			isInstalling = false;
		}
	}
</script>

{#if showButton}
	{#if variant === 'floating'}
		<button class="pwa-install-floating" onclick={handleInstallClick} disabled={isInstalling}>
			<span class="icon">📱</span>
			<span class="text">{isInstalling ? 'Установка...' : 'Установить приложение'}</span>
		</button>
	{:else}
		<button class="pwa-install-inline" onclick={handleInstallClick} disabled={isInstalling}>
			<span class="icon">📱</span>
			<span class="text">{isInstalling ? 'Установка...' : 'Установить как приложение'}</span>
		</button>
	{/if}
{/if}

<!-- iOS Install Instructions Modal -->
{#if showIOSInstructions}
	<div class="modal-overlay" onclick={() => showIOSInstructions = false}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<h3>Установка на iOS</h3>
			<ol class="ios-instructions">
				<li>Нажмите кнопку "Поделиться" <span class="share-icon">⎙</span> внизу экрана</li>
				<li>Прокрутите вниз и выберите "На экран «Домой»"</li>
				<li>Нажмите "Добавить"</li>
			</ol>
			<button class="close-btn" onclick={() => showIOSInstructions = false}>
				Понятно
			</button>
		</div>
	</div>
{/if}

<style>
	.pwa-install-floating {
		position: fixed;
		bottom: 24px;
		right: 24px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 20px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 50px;
		box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
		cursor: pointer;
		font-size: 15px;
		font-weight: 600;
		transition: all 0.3s ease;
		z-index: 1000;
		animation: slideInUp 0.4s ease;
	}

	.pwa-install-floating:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
	}

	.pwa-install-floating:active {
		transform: translateY(0);
	}

	.pwa-install-floating:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.pwa-install-inline {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 24px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 12px;
		box-shadow: 0 2px 12px rgba(102, 126, 234, 0.3);
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: all 0.2s ease;
		width: 100%;
	}

	.pwa-install-inline:hover {
		box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
	}

	.pwa-install-inline:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.icon {
		font-size: 20px;
		line-height: 1;
	}

	.text {
		line-height: 1;
	}

	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Адаптация для мобильных */
	@media (max-width: 640px) {
		.pwa-install-floating {
			bottom: 16px;
			right: 16px;
			padding: 12px 16px;
			font-size: 14px;
		}

		.icon {
			font-size: 18px;
		}
	}

	/* iOS Instructions Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		padding: 20px;
		animation: fadeIn 0.2s ease;
	}

	.modal-content {
		background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
		border-radius: 16px;
		padding: 24px;
		max-width: 400px;
		width: 100%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		animation: slideUp 0.3s ease;
	}

	.modal-content h3 {
		margin: 0 0 16px 0;
		color: #f8fafc;
		font-size: 20px;
		font-weight: 700;
	}

	.ios-instructions {
		list-style: decimal;
		padding-left: 24px;
		margin: 0 0 20px 0;
		color: #cbd5e1;
		line-height: 1.8;
	}

	.ios-instructions li {
		margin-bottom: 8px;
	}

	.share-icon {
		display: inline-block;
		font-size: 18px;
		vertical-align: middle;
		margin: 0 4px;
	}

	.close-btn {
		width: 100%;
		padding: 12px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 12px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
	}

	.close-btn:active {
		transform: translateY(0);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
