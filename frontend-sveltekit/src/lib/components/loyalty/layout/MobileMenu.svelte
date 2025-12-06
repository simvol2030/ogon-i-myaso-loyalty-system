<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { sidebarMenuItems } from '$lib/stores/customization';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  $effect(() => {
    if (!browser) return;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  function handleOverlayClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  }

  function handleOverlayKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClose();
    }
  }

  function handleCloseClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  }

  function handleNavClick(e: MouseEvent) {
    e.stopPropagation();
    onClose();
  }

  function handleEscapeKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleEscapeKey} />

<div
  class="sidebar-overlay"
  class:active={open}
  onclick={handleOverlayClick}
  onkeydown={handleOverlayKeydown}
  role="button"
  tabindex="-1"
  aria-label="Закрыть меню"
></div>

<aside class="sidebar" class:active={open}>
  <div class="sidebar-header">
    <h2 class="sidebar-title">Меню</h2>
    <button class="sidebar-close" onclick={handleCloseClick} aria-label="Закрыть меню">
      <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      </svg>
    </button>
  </div>

  <nav class="sidebar-nav">
    {#each $sidebarMenuItems as item}
      {#if item.isExternal}
        <a
          href={item.href}
          class="sidebar-item external"
          target="_blank"
          rel="noopener noreferrer"
          onclick={handleNavClick}
        >
          <span class="sidebar-icon">{item.icon}</span>
          <span>{item.label}</span>
          <svg class="external-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      {:else}
        <a
          href={item.href}
          class="sidebar-item"
          class:active={$page.url.pathname === item.href}
          onclick={handleNavClick}
        >
          <span class="sidebar-icon">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {/if}
    {/each}
  </nav>
</aside>

<style>
  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    z-index: 998;
  }

  .sidebar-overlay.active {
    opacity: 1;
    pointer-events: all;
  }

  .sidebar {
    position: fixed;
    top: 0;
    right: -320px;
    width: 280px;
    height: 100%;
    background: var(--bg-white);
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    z-index: 999;
    transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top);
  }

  .sidebar.active {
    right: 0;
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .sidebar-title {
    font-size: 20px;
    font-weight: bold;
    color: var(--text-primary);
  }

  .sidebar-close {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-light);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }

  .sidebar-close:hover {
    background: var(--bg-tertiary);
    transform: rotate(90deg);
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .sidebar-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border-radius: 16px;
    background: transparent;
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
    margin-bottom: 4px;
  }

  .sidebar-item:hover {
    background: var(--bg-light);
    transform: translateX(-4px);
  }

  .sidebar-item.active {
    background: color-mix(in srgb, var(--primary-orange) 10%, transparent);
    color: var(--primary-orange);
  }

  .sidebar-icon {
    font-size: 24px;
    color: var(--primary-orange);
    flex-shrink: 0;
  }

  .sidebar-item.external {
    justify-content: flex-start;
  }

  .external-icon {
    margin-left: auto;
    opacity: 0.5;
    flex-shrink: 0;
  }
</style>
