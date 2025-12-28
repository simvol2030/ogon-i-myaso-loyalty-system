<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Slide, FlashConfig } from './types';
	import SlideProducts from './SlideProducts.svelte';
	import SlideSets from './SlideSets.svelte';
	import SlideIndicator from './SlideIndicator.svelte';

	let { slides: backendSlides, config }: { slides: Slide[]; config: FlashConfig } = $props();

	let currentIndex = $state(0);
	let intervalId: ReturnType<typeof setInterval>;
	let viewportWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1920);

	// Расчёт capacity (сколько товаров помещается на экран)
	function calculateCapacity(width: number): number {
		const cardMinWidth = 160;
		const gap = 16;
		const padding = 40; // 20px с каждой стороны
		const availableWidth = width - padding;
		const cols = Math.max(3, Math.min(8, Math.floor(availableWidth / (cardMinWidth + gap))));
		const rows = 2; // Фиксировано 2 ряда
		return cols * rows;
	}

	// Создание виртуальных слайдов на основе capacity
	function createVirtualSlides(backendSlides: Slide[], capacity: number): Slide[] {
		const virtualSlides: Slide[] = [];

		for (const slide of backendSlides) {
			if (slide.type === 'sets') {
				// Сеты: оставляем как есть (3 на слайд с backend)
				virtualSlides.push(slide);
				continue;
			}

			// Products: разбиваем по capacity
			const items = slide.items;
			for (let i = 0; i < items.length; i += capacity) {
				virtualSlides.push({
					...slide,
					items: items.slice(i, i + capacity)
				});
			}
		}

		return virtualSlides;
	}

	// Реактивные виртуальные слайды
	const capacity = $derived(calculateCapacity(viewportWidth));
	const slides = $derived(createVirtualSlides(backendSlides, capacity));

	// Текущий слайд
	const currentSlide = $derived(slides[currentIndex]);

	// При изменении количества слайдов - сбросить индекс если вышли за пределы
	$effect(() => {
		if (currentIndex >= slides.length && slides.length > 0) {
			currentIndex = 0;
		}
	});

	// Автопереключение с учётом динамического количества слайдов
	$effect(() => {
		// Очищаем предыдущий интервал
		if (intervalId) {
			clearInterval(intervalId);
		}

		// Создаём новый интервал если слайдов больше 1
		if (slides.length > 1) {
			intervalId = setInterval(() => {
				currentIndex = (currentIndex + 1) % slides.length;
			}, config.interval);
		}
	});

	onMount(() => {
		// Слушать resize
		function handleResize() {
			viewportWidth = window.innerWidth;
		}
		window.addEventListener('resize', handleResize);

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
			window.removeEventListener('resize', handleResize);
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
	<!-- Header с названием группы и индикатором -->
	<header class="flash-header">
		<h1 class="category-title">{currentSlide?.title || ''}</h1>
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
