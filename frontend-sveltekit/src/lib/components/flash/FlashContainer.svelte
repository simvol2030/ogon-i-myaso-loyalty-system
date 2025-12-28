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
	let intervalId: ReturnType<typeof setInterval> | null = $state(null);
	let viewportWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1920);

	// Расчёт capacity (сколько товаров помещается на экран)
	// Синхронизировано с CSS breakpoints в SlideProducts.svelte
	function calculateCapacity(width: number): number {
		// TV 1920px+: 8 колонок × 2 ряда = 16 товаров
		if (width >= 1920) return 16;
		// Большие мониторы 1400px+: 6 колонок × 2 ряда = 12 товаров
		if (width >= 1400) return 12;
		// Средние экраны: динамический расчёт
		const cardMinWidth = 160;
		const gap = 16;
		const padding = 40;
		const availableWidth = width - padding;
		const cols = Math.max(3, Math.min(6, Math.floor(availableWidth / (cardMinWidth + gap))));
		return cols * 2;
	}

	// Создание виртуальных слайдов с уникальными ID
	function createVirtualSlides(backendSlides: Slide[], capacity: number): VirtualSlide[] {
		const virtualSlides: VirtualSlide[] = [];

		for (const slide of backendSlides) {
			if (slide.type === 'sets') {
				// Сеты: оставляем как есть, генерируем уникальный ID
				virtualSlides.push({
					...slide,
					virtualId: `sets-${slide.title}-${slide.items.map(i => i.id).join(',')}`
				});
				continue;
			}

			// Products: разбиваем по capacity с уникальными ID
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

	// Безопасный индекс (защита от undefined)
	const safeIndex = $derived(
		slides.length === 0 ? 0 : Math.min(currentIndex, slides.length - 1)
	);

	// Текущий слайд (теперь безопасный)
	const currentSlide = $derived(slides[safeIndex]);

	// При изменении количества слайдов - сбросить индекс если вышли за пределы
	$effect(() => {
		if (currentIndex >= slides.length && slides.length > 0) {
			currentIndex = 0;
		}
	});

	// Автопереключение с корректным cleanup
	$effect(() => {
		const slideCount = slides.length;
		
		// Очищаем предыдущий интервал
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}

		// Создаём новый интервал если слайдов больше 1
		if (slideCount > 1) {
			const id = setInterval(() => {
				currentIndex = (currentIndex + 1) % slideCount;
			}, config.interval);
			intervalId = id;
		}

		// Cleanup при размонтировании или пересоздании эффекта
		return () => {
			if (intervalId !== null) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};
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
		if (intervalId !== null) {
			clearInterval(intervalId);
		}
	});
</script>

<div class="flash-container">
	<!-- Header с названием группы и индикатором -->
	<header class="flash-header">
		<h1 class="category-title">{currentSlide?.title || ''}</h1>
		<SlideIndicator total={slides.length} current={safeIndex} />
	</header>

	<!-- Слайды с уникальными ключами -->
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
