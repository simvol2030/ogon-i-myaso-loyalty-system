<script lang="ts">
	import type { LayoutData } from './$types';
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import CsrfToken from '$lib/components/CsrfToken.svelte';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Не показываем layout на странице логина
	const isLoginPage = $derived($page.url.pathname === '/login');

	// Мобильное меню
	let mobileMenuOpen = $state(false);

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

{#if isLoginPage}
	{@render children()}
{:else}
	<div class="admin-layout">
		<!-- Mobile Header -->
		<header class="mobile-header">
			<button class="menu-button" onclick={toggleMobileMenu} aria-label="Toggle menu">
				{#if mobileMenuOpen}
					<span class="icon">✕</span>
				{:else}
					<span class="icon">☰</span>
				{/if}
			</button>
			<h1>Admin Panel</h1>
			<div class="user-badge">{data.user?.name?.charAt(0) || 'A'}</div>
		</header>

		<!-- Sidebar with mobile overlay -->
		{#if mobileMenuOpen}
			<div class="sidebar-overlay" onclick={closeMobileMenu}></div>
		{/if}

		<aside class="sidebar" class:mobile-open={mobileMenuOpen}>
			<div class="sidebar-header">
				<h2>Admin Panel</h2>
				<p class="user-role">{data.user?.role}</p>
			</div>

			<nav class="sidebar-nav">
				<a href="/dashboard" class:active={$page.url.pathname === '/dashboard'} onclick={closeMobileMenu}>
					<span class="icon">📊</span>
					<span>Dashboard</span>
				</a>
				<a href="/users" class:active={$page.url.pathname.startsWith('/users')} onclick={closeMobileMenu}>
					<span class="icon">👥</span>
					<span>Users</span>
				</a>
				<a href="/posts" class:active={$page.url.pathname.startsWith('/posts')} onclick={closeMobileMenu}>
					<span class="icon">📝</span>
					<span>Posts</span>
				</a>
				{#if data.user?.role === 'super-admin'}
					<a href="/settings" class:active={$page.url.pathname === '/settings'} onclick={closeMobileMenu}>
						<span class="icon">⚙️</span>
						<span>Settings</span>
					</a>
				{/if}
			</nav>

			<div class="sidebar-footer">
				<div class="user-info">
					<p class="user-name">{data.user?.name}</p>
					<p class="user-email">{data.user?.email}</p>
				</div>
				<form method="POST" action="/logout" use:enhance={() => {
					return async ({ update }) => {
						// Не используем update(), просто перезагружаем страницу
						// Это позволит серверу обработать redirect
						window.location.href = '/login';
					};
				}}>
					<CsrfToken />
					<button type="submit" class="btn-logout">Logout</button>
				</form>
			</div>
		</aside>

		<main class="main-content">
			{@render children()}
		</main>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}

	.admin-layout {
		display: flex;
		min-height: 100vh;
		background-color: #f9fafb;
	}

	/* Mobile Header */
	.mobile-header {
		display: none;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		position: sticky;
		top: 0;
		z-index: 100;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.mobile-header h1 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.menu-button {
		background: none;
		border: none;
		color: white;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.menu-button .icon {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.user-badge {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 0.875rem;
	}

	/* Sidebar Overlay for mobile */
	.sidebar-overlay {
		display: none;
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 998;
	}

	.sidebar {
		width: 260px;
		background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
		color: white;
		display: flex;
		flex-direction: column;
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
		z-index: 999;
	}

	.sidebar-header {
		padding: 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.sidebar-header h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.user-role {
		font-size: 0.75rem;
		color: #9ca3af;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.sidebar-nav {
		flex: 1;
		padding: 1rem;
		overflow-y: auto;
	}

	.sidebar-nav a {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		color: #d1d5db;
		text-decoration: none;
		border-radius: 0.5rem;
		transition: all 0.2s;
		margin-bottom: 0.25rem;
	}

	.sidebar-nav a:hover {
		background-color: rgba(255, 255, 255, 0.1);
		color: white;
	}

	.sidebar-nav a.active {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.sidebar-nav .icon {
		font-size: 1.25rem;
	}

	.sidebar-footer {
		padding: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.user-info {
		margin-bottom: 1rem;
	}

	.user-name {
		margin: 0 0 0.25rem 0;
		font-weight: 600;
		font-size: 0.875rem;
	}

	.user-email {
		margin: 0;
		font-size: 0.75rem;
		color: #9ca3af;
		word-break: break-all;
	}

	.btn-logout {
		width: 100%;
		padding: 0.625rem;
		background-color: rgba(239, 68, 68, 0.1);
		color: #fca5a5;
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 0.375rem;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.btn-logout:hover {
		background-color: rgba(239, 68, 68, 0.2);
		color: #f87171;
	}

	.main-content {
		flex: 1;
		padding: 2rem;
		overflow-y: auto;
	}

	/* Mobile Styles */
	@media (max-width: 768px) {
		.mobile-header {
			display: flex;
		}

		.sidebar {
			position: fixed;
			left: 0;
			top: 0;
			bottom: 0;
			transform: translateX(-100%);
			transition: transform 0.3s ease;
		}

		.sidebar.mobile-open {
			transform: translateX(0);
		}

		.sidebar-overlay {
			display: block;
		}

		.main-content {
			padding: 1rem;
			width: 100%;
		}

		.admin-layout {
			flex-direction: column;
		}
	}

	/* Tablet Styles */
	@media (max-width: 1024px) and (min-width: 769px) {
		.sidebar {
			width: 220px;
		}

		.main-content {
			padding: 1.5rem;
		}
	}

	/* Small mobile */
	@media (max-width: 480px) {
		.main-content {
			padding: 0.75rem;
		}

		.sidebar {
			width: 280px;
			max-width: 85vw;
		}
	}
</style>
