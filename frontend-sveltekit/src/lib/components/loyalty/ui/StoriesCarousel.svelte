<script lang="ts">
	import { onMount } from 'svelte';
	import type { StoriesData, StoryHighlight, StoriesSettings } from '$lib/api/stories';
	import { fetchStories } from '$lib/api/stories';
	import StoryViewer from './StoryViewer.svelte';
	import { storiesSettings } from '$lib/stores/customization';

	// Props
	let { userId = null }: { userId?: number | null } = $props();

	// State
	let storiesData = $state<StoriesData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Viewer state
	let viewerOpen = $state(false);
	let activeHighlightIndex = $state(0);

	// Computed
	let settings = $derived(storiesData?.settings);
	let highlights = $derived(storiesData?.highlights || []);
	let hasStories = $derived(storiesData?.enabled && highlights.length > 0);

	// Reactive border color - always use customization store (populated from SSR or API)
	let borderColor = $derived($storiesSettings.borderColor);

	// Load stories on mount
	onMount(async () => {
		try {
			storiesData = await fetchStories();
		} catch (err) {
			console.error('Failed to load stories:', err);
			error = err instanceof Error ? err.message : 'Failed to load stories';
		} finally {
			loading = false;
		}
	});

	function openStory(index: number) {
		activeHighlightIndex = index;
		viewerOpen = true;
		document.body.style.overflow = 'hidden';
	}

	function closeViewer() {
		viewerOpen = false;
		document.body.style.overflow = '';
	}

	function goToNextHighlight() {
		if (activeHighlightIndex < highlights.length - 1) {
			activeHighlightIndex++;
		} else {
			closeViewer();
		}
	}

	function goToPrevHighlight() {
		if (activeHighlightIndex > 0) {
			activeHighlightIndex--;
		}
	}

	function goToHighlight(index: number) {
		if (index >= 0 && index < highlights.length) {
			activeHighlightIndex = index;
		}
	}

	// Compute gradient style - now uses reactive borderColor
	function getBorderStyle(settings: StoriesSettings | null, color: string): string {
		if (!settings) return '';
		if (settings.borderWidth === 0) return 'border: none;';

		if (settings.borderGradient) {
			return `background: linear-gradient(${settings.borderGradient.angle}deg, ${settings.borderGradient.colors.join(', ')});`;
		}

		return `background: ${color};`;
	}
</script>

{#if hasStories && settings}
	<div class="stories-carousel" style="--highlight-size: {settings.highlightSize}px; --title-color-light: {$storiesSettings.titleColorLight}; --title-color-dark: {$storiesSettings.titleColorDark}">
		<div class="stories-scroll">
			{#each highlights as highlight, index}
				<button
					class="story-highlight"
					class:circle={settings.shape === 'circle'}
					class:square={settings.shape === 'square'}
					onclick={() => openStory(index)}
				>
					<div
						class="highlight-border"
						style="{getBorderStyle(settings, borderColor)} --border-width: {settings.borderWidth}px;"
					>
						<div class="highlight-inner">
							{#if highlight.coverImage}
								<img src={highlight.coverImage} alt={highlight.title} />
							{:else if highlight.items.length > 0 && highlight.items[0].type === 'photo'}
								<img src={highlight.items[0].mediaUrl} alt={highlight.title} />
							{:else}
								<div class="placeholder">📷</div>
							{/if}
						</div>
					</div>

					{#if settings.showTitle}
						<span
							class="highlight-title"
							class:inside={settings.titlePosition === 'inside'}
						>
							{highlight.title}
						</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	{#if viewerOpen}
		<StoryViewer
			{highlights}
			{activeHighlightIndex}
			{userId}
			onClose={closeViewer}
			onNext={goToNextHighlight}
			onPrev={goToPrevHighlight}
			onGoTo={goToHighlight}
		/>
	{/if}
{:else if loading}
	<div class="stories-carousel loading">
		<div class="stories-scroll">
			{#each [1, 2, 3, 4] as _}
				<div class="story-highlight skeleton">
					<div class="highlight-border">
						<div class="highlight-inner"></div>
					</div>
					<span class="highlight-title skeleton-text"></span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.stories-carousel {
		padding: 0.75rem 0;
		margin-bottom: 0.5rem;
	}

	.stories-scroll {
		display: flex;
		gap: 0.75rem;
		overflow-x: auto;
		padding: 0.25rem 1rem;
		scroll-snap-type: x mandatory;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.stories-scroll::-webkit-scrollbar {
		display: none;
	}

	.story-highlight {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		scroll-snap-align: start;
		position: relative;
		-webkit-tap-highlight-color: transparent;
	}

	.story-highlight:focus {
		outline: none;
	}

	.story-highlight:active .highlight-border {
		transform: scale(0.95);
	}

	.highlight-border {
		width: var(--highlight-size);
		height: var(--highlight-size);
		padding: var(--border-width);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.15s ease;
	}

	.story-highlight.circle .highlight-border {
		border-radius: 50%;
	}

	.story-highlight.square .highlight-border {
		border-radius: 20%;
	}

	.highlight-inner {
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #f3f4f6;
	}

	.story-highlight.circle .highlight-inner {
		border-radius: 50%;
	}

	.story-highlight.square .highlight-inner {
		border-radius: 16%;
	}

	.highlight-inner img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.highlight-inner .placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: calc(var(--highlight-size) * 0.35);
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
	}

	.highlight-title {
		font-size: 0.6875rem;
		color: var(--title-color-light, #374151);
		text-align: center;
		max-width: var(--highlight-size);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.2;
	}

	/* Dark theme support for title color */
	:global([data-theme="dark"]) .highlight-title {
		color: var(--title-color-dark, #ffffff);
	}

	.highlight-title.inside {
		position: absolute;
		bottom: calc(var(--highlight-size) * 0.12);
		left: 50%;
		transform: translateX(-50%);
		color: white;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
		font-weight: 500;
		max-width: calc(var(--highlight-size) * 0.85);
	}

	/* Skeleton loading */
	.stories-carousel.loading {
		opacity: 0.6;
	}

	.story-highlight.skeleton {
		cursor: default;
	}

	.story-highlight.skeleton .highlight-border {
		background: #e5e7eb;
		padding: 3px;
		border-radius: 50%;
		width: 80px;
		height: 80px;
	}

	.story-highlight.skeleton .highlight-inner {
		background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 50%;
	}

	.skeleton-text {
		width: 50px;
		height: 12px;
		background: #e5e7eb;
		border-radius: 4px;
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}
</style>
