<script lang="ts">
  import { page } from '$app/stores';
  import { sidebarMenuItems } from '$lib/stores/customization';
</script>

<aside class="sidebar">
  <div class="sidebar-header">
    <h2 class="sidebar-title">Меню</h2>
  </div>

  <nav class="sidebar-nav">
    {#each $sidebarMenuItems as item}
      {#if item.isExternal}
        <a
          href={item.href}
          class="sidebar-item"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="sidebar-icon">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {:else}
        <a
          href={item.href}
          class="sidebar-item"
          class:active={$page.url.pathname === item.href}
        >
          <span class="sidebar-icon">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {/if}
    {/each}
  </nav>
</aside>

<style>
  .sidebar {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 240px;
    height: 100vh;
    background: var(--bg-white);
    border-right: 1px solid var(--border-color);
    padding-top: env(safe-area-inset-top);
    flex-direction: column;
    z-index: 90;
  }

  @media (min-width: 1024px) {
    .sidebar {
      display: flex;
    }
  }

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .sidebar-title {
    font-size: 20px;
    font-weight: bold;
    color: var(--text-primary);
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
    flex-shrink: 0;
  }
</style>
