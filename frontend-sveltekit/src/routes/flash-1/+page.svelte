<script lang="ts">
	import FlashContainer from '$lib/components/flash/FlashContainer.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Меню - Мангал | Гранат</title>
	<meta name="robots" content="noindex, nofollow" />
	<style>
		/* Landscape lock and fullscreen */
		html, body {
			margin: 0;
			padding: 0;
			overflow: hidden;
			background: #1E1E1E;
		}
	</style>
</svelte:head>

{#if data.slides.length > 0}
	<FlashContainer slides={data.slides} config={data.config} />
{:else}
	<div class="empty-state">
		<h1>Загрузка меню...</h1>
		<p>Нет данных для отображения</p>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background: #1E1E1E;
	}

	.empty-state {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #1E1E1E;
		color: #FFFFFF;
	}

	.empty-state h1 {
		font-size: 32px;
		margin: 0 0 16px 0;
	}

	.empty-state p {
		font-size: 18px;
		color: #8E8E93;
		margin: 0;
	}
</style>
