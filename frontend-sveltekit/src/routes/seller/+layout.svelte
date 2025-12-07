<!--
  Seller PWA Layout
  - Изолированный layout без главного header/footer приложения
  - PWA-оптимизированный для мобильных устройств
  - Standalone режим
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { children } = $props();

	// Состояние авторизации
	let isAuthenticated = $state(false);
	let sellerName = $state('');
	let isLoading = $state(true);

	onMount(async () => {
		// Проверяем авторизацию
		const token = localStorage.getItem('seller_token');

		if (!token) {
			isLoading = false;
			// Если не на странице логина - редирект
			if (!page.url.pathname.includes('/seller/login')) {
				goto('/seller/login');
			}
			return;
		}

		try {
			const response = await fetch('/api/seller/me', {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				isAuthenticated = true;
				sellerName = data.seller.name;
			} else {
				// Невалидный токен - удаляем
				localStorage.removeItem('seller_token');
				localStorage.removeItem('seller_name');
				localStorage.removeItem('seller_id');
				if (!page.url.pathname.includes('/seller/login')) {
					goto('/seller/login');
				}
			}
		} catch (error) {
			console.error('Auth check error:', error);
			localStorage.removeItem('seller_token');
			localStorage.removeItem('seller_name');
			localStorage.removeItem('seller_id');
			if (!page.url.pathname.includes('/seller/login')) {
				goto('/seller/login');
			}
		} finally {
			isLoading = false;
		}
	});

	function handleLogout() {
		localStorage.removeItem('seller_token');
		localStorage.removeItem('seller_name');
		localStorage.removeItem('seller_id');
		isAuthenticated = false;
		sellerName = '';
		goto('/seller/login');
	}
</script>

<svelte:head>
	<title>Продавец</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
	<meta name="theme-color" content="#0f172a" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="Продавец" />
	<link rel="manifest" href="/manifest-seller.json" />
	<link rel="apple-touch-icon" href="/icons/seller-192.svg" />
</svelte:head>

<div class="seller-app">
	{#if isLoading}
		<div class="loading-screen">
			<div class="spinner"></div>
			<p>Загрузка...</p>
		</div>
	{:else}
		{#if isAuthenticated && !page.url.pathname.includes('/seller/login')}
			<header class="seller-header">
				<div class="seller-info">
					<span class="seller-icon">👤</span>
					<span class="seller-name">{sellerName}</span>
				</div>
				<button class="logout-btn" onclick={handleLogout}>
					Выйти
				</button>
			</header>
		{/if}

		<main class="seller-content">
			{@render children()}
		</main>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
		background-color: #0f172a;
		color: #f8fafc;
		min-height: 100vh;
		min-height: 100dvh;
	}

	.seller-app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
	}

	.loading-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		min-height: 100dvh;
		gap: 16px;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid rgba(16, 185, 129, 0.2);
		border-top-color: #10b981;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-screen p {
		color: #94a3b8;
		font-size: 16px;
	}

	.seller-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: rgba(30, 41, 59, 0.8);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.seller-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.seller-icon {
		font-size: 20px;
	}

	.seller-name {
		font-weight: 600;
		font-size: 16px;
		color: #f8fafc;
	}

	.logout-btn {
		padding: 8px 16px;
		background: transparent;
		border: 1px solid rgba(239, 68, 68, 0.5);
		color: #ef4444;
		border-radius: 8px;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.logout-btn:hover {
		background: rgba(239, 68, 68, 0.1);
		border-color: #ef4444;
	}

	.logout-btn:active {
		transform: scale(0.95);
	}

	.seller-content {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
