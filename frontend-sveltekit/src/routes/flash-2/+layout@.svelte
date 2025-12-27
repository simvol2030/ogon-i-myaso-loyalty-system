<script lang="ts">
	/**
	 * Standalone Layout for Flash Screen 2 (TV Menu)
	 *
	 * This layout overrides the main application layout to create
	 * a fullscreen interface for TV display.
	 *
	 * Features:
	 * - No Header/Footer from main app
	 * - Full viewport usage (landscape 16:9)
	 * - Dark theme optimized for TV
	 * - No scrolling
	 */

	let { children } = $props();
</script>

{@render children()}

<style>
	:global(html) {
		margin: 0;
		padding: 0;
		height: 100vh;
		width: 100vw;
		overflow: hidden;
		background-color: #1E1E1E;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
		background-color: #1E1E1E;
		color: #FFFFFF;
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(#svelte) {
		height: 100vh;
		width: 100vw;
		overflow: hidden;
	}
</style>
