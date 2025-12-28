<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Slide, FlashConfig } from './types';
	import SlideProducts from './SlideProducts.svelte';
	import SlideSets from './SlideSets.svelte';
	import SlideIndicator from './SlideIndicator.svelte';

	// Расширенный тип слайда с virtualId
	interface VirtualSlide extends Slide {
		virtualId: string;
	}

	let { slides: backendSlides, config }: { slides: Slide[]; config: FlashConfig } = $props();

	let currentIndex = $state(0);
	let viewportWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1920);
	
	// Интервал хранится вне реактивности чтобы избежать циклов
	let intervalId: ReturnType<typeof setInterval> | null = null;

	// Расчёт capacity (сколько товаров помещается на экран)
	function calculateCapacity(width: number): number {
		// TV 1920px: 10 колонок × 2 ряда = 20 товаров
		if (width >= 1920) return 20;
		// Desktop 1400px: 8 колонок × 2 ряда = 16 товаров
		if (width >= 1400) return 16;
		// Smaller screens: динамический расчёт
		const cardMinWidth = 160;
		const gap = 16;
		const padding = 40;
		const availableWidth = width - padding;
		const cols = Math.max(3, Math.min(8, Math.floor(availableWidth / (cardMinWidth + gap))));
		return cols * 2;
	}

	// Создание виртуальных слайдов с уникальными ID
	function createVirtualSlides(backendSlides: Slide[], capacity: number): VirtualSlide[] {
		const virtualSlides: VirtualSlide[] = [];

		for (const slide of backendSlides) {
			if (slide.type === 'sets') {
				virtualSlides.push({
					...slide,
					virtualId: `sets-${slide.title}-${slide.items.map(i => i.id).join(',')}`
				});
				continue;
			}

			const items = slide.items;
			for (let i = 0; i < items.length; i += capacity) {
				const sliceItems = items.slice(i, i + capacity);
				virtualSlides.push({
					...slide,
					items: sliceItems,
					virtualId: `products-${slide.title}-${i}-${sliceItems.map(item => item.id).join(',')}`
				});
			}
		}

		return virtualSlides;
	}

	// Реактивные виртуальные слайды
	const capacity = $derived(calculateCapacity(viewportWidth));
	const slides = $derived(createVirtualSlides(backendSlides, capacity));

	// Безопасный индекс
	const safeIndex = $derived(
		slides.length === 0 ? 0 : Math.min(currentIndex, slides.length - 1)
	);

	// Текущий слайд
	const currentSlide = $derived(slides[safeIndex]);

	// Сброс индекса при изменении количества слайдов
	$effect(() => {
		const len = slides.length;
		if (currentIndex >= len && len > 0) {
			currentIndex = 0;
		}
	});

	// Функция запуска интервала
	function startInterval() {
		stopInterval();
		if (slides.length > 1) {
			intervalId = setInterval(() => {
				currentIndex = (currentIndex + 1) % slides.length;
			}, config.interval);
		}
	}

	// Функция остановки интервала
	function stopInterval() {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	onMount(() => {
		// Запустить автопереключение
		startInterval();

		// Слушать resize
		function handleResize() {
			viewportWidth = window.innerWidth;
			// Перезапустить интервал при resize
			startInterval();
		}
		window.addEventListener('resize', handleResize);

		// Keyboard navigation
		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'ArrowRight') {
				currentIndex = (currentIndex + 1) % slides.length;
			} else if (e.key === 'ArrowLeft') {
				currentIndex = (currentIndex - 1 + slides.length) % slides.length;
			}
		}
		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('keydown', handleKeydown);
			stopInterval();
		};
	});

	onDestroy(() => {
		stopInterval();
	});
</script>

<div class="flash-container">
	<header class="flash-header">
		<h1 class="category-title">{currentSlide?.title || ''}</h1>
		<SlideIndicator total={slides.length} current={safeIndex} />
	</header>

	<div class="slides-wrapper">
		{#each slides as slide (slide.virtualId)}
			<div class="slide" class:active={slide.virtualId === currentSlide?.virtualId}>
				{#if slide.type === 'products'}
					<SlideProducts {slide} />
				{:else if slide.type === 'sets'}
					<SlideSets {slide} />
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
