<script lang="ts">
  import { page } from '$app/stores';
  import { bottomNavItems, getIconPath } from '$lib/stores/customization';

  function isActive(href: string): boolean {
    if (href === '/') {
      return $page.url.pathname === '/';
    }
    return $page.url.pathname.startsWith(href);
  }
</script>

<nav class="bottom-nav">
  <div class="nav-container">
    {#each $bottomNavItems as item}
      <a
        href={item.href}
        class="nav-item"
        class:active={isActive(item.href)}
        aria-label={item.label}
      >
        <svg class="nav-icon" fill="currentColor" viewBox="0 0 24 24">
          <path d={getIconPath(item.icon)} />
        </svg>
        <span class="nav-label">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-white);
    border-top: 1px solid var(--border-color);
    padding: 8px 4px;
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
    box-shadow: 0 -10px 30px -10px rgba(0, 0, 0, 0.1);
    z-index: 50;
  }

  .nav-container {
    display: flex;
    justify-content: space-around;
    align-items: center;
    gap: 4px;
    max-width: 480px;
    margin: 0 auto;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 12px;
    border-radius: 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    color: var(--text-secondary);
    text-decoration: none;
    min-width: 0;
    flex: 1;
    position: relative;
  }

  .nav-item:hover {
    color: #4b5563;
  }

  .nav-item.active {
    color: var(--primary-orange);
    background: color-mix(in srgb, var(--primary-orange) 10%, transparent);
    box-shadow: 0 10px 15px -3px color-mix(in srgb, var(--primary-orange) 15%, transparent);
    transform: scale(1.05);
  }

  .nav-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .nav-label {
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
