<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Slide, FlashConfig } from './types';
	import SlideProducts from './SlideProducts.svelte';
	import SlideSets from './SlideSets.svelte';
	import SlideCombo from './SlideCombo.svelte';
	import SlideIndicator from './SlideIndicator.svelte';

	let { slides, config }: { slides: Slide[]; config: FlashConfig } = $props();

	let currentIndex = $state(0);
	let intervalId: ReturnType<typeof setInterval>;

	// Текущий слайд
	const currentSlide = $derived(slides[currentIndex]);

	// Автопереключение слайдов
	onMount(() => {
		if (slides.length > 1) {
			intervalId = setInterval(() => {
				currentIndex = (currentIndex + 1) % slides.length;
			}, config.interval);
		}

		// Keyboard navigation для тестирования
		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'ArrowRight') {
				currentIndex = (currentIndex + 1) % slides.length;
			} else if (e.key === 'ArrowLeft') {
				currentIndex = (currentIndex - 1 + slides.length) % slides.length;
			}
		}
		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
	});
</script>

<div class="flash-container">
	<!-- Header с названием категории и индикатором -->
	<header class="flash-header">
		<h1 class="category-title">{currentSlide?.category || ''}</h1>
		<SlideIndicator total={slides.length} current={currentIndex} />
	</header>

	<!-- Слайды -->
	<div class="slides-wrapper">
		{#each slides as slide, i (i)}
			<div class="slide" class:active={i === currentIndex}>
				{#if slide.type === 'products'}
					<SlideProducts {slide} />
				{:else if slide.type === 'sets'}
					<SlideSets {slide} />
				{:else if slide.type === 'combo'}
					<SlideCombo {slide} />
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.flash-container {
		width: 100vw;
		height: 100vh;
		background: var(--bg-primary, #1E1E1E);
		overflow: hidden;
		position: relative;
		display: flex;
		flex-direction: column;

		/* CSS Variables - Telegram Dark Theme */
		--bg-primary: #1E1E1E;
		--bg-card: #2A2A2A;
		--text-primary: #FFFFFF;
		--text-secondary: #8E8E93;
		--accent: #64B5F6;
		--price: #4CAF50;
	}

	.flash-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 40px;
		background: rgba(0, 0, 0, 0.3);
		flex-shrink: 0;
	}

	.category-title {
		font-size: 32px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.slides-wrapper {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.slide {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 0.5s ease-in-out;
		pointer-events: none;
	}

	.slide.active {
		opacity: 1;
		pointer-events: auto;
	}
</style>
