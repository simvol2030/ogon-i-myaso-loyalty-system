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

	onMount(() => {
		if (!browser) return;

		// Проверяем, уже установлено ли приложение
		const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
		if (isStandalone) {
			showButton = false;
			return;
		}

		// Слушаем событие beforeinstallprompt
		const handleBeforeInstallPrompt = (e: Event) => {
			// Предотвращаем автоматическое появление браузерного промпта
			e.preventDefault();
			deferredPrompt = e;
			showButton = true;
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

		// Слушаем событие установки
		window.addEventListener('appinstalled', () => {
			deferredPrompt = null;
			showButton = false;
		});

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		};
	});

	async function handleInstallClick() {
		if (!deferredPrompt) return;

		isInstalling = true;

		try {
			// Показываем native install prompt
			deferredPrompt.prompt();

			// Ждем выбора пользователя
			const { outcome } = await deferredPrompt.userChoice;

			if (outcome === 'accepted') {
				console.log('PWA установлено');
			} else {
				console.log('PWA установка отклонена');
			}

			// Очищаем промпт
			deferredPrompt = null;
			showButton = false;
		} catch (err) {
			console.error('PWA install error:', err);
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
</style>
