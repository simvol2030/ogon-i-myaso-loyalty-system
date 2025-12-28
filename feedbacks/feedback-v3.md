# Feedback v3 - Flash Screens: Динамическая пагинация на Frontend

**Дата:** 2025-12-28
**Branch to create:** `claude/flash-dynamic-pagination`
**Базовая ветка:** `main`

---

## КРИТИЧЕСКИ ВАЖНО

> **Scope изменений: ТОЛЬКО flash-компоненты!**
>
> - НЕ трогать основные компоненты приложения (`/src/lib/components/` кроме `/flash/`)
> - НЕ менять основные layouts (`+layout.svelte` в корне routes)
> - НЕ менять логику каталога, корзины, авторизации
> - Все изменения изолированы в `/flash/` директориях

---

## Описание проблемы

### Текущее поведение (БАГ)

1. Backend отдаёт слайды с фиксированным количеством товаров (до 12 на слайд)
2. Frontend показывает товары в CSS Grid с `overflow: hidden`
3. **Проблема:** Если viewport вмещает меньше товаров чем отдал backend, лишние товары **обрезаются и не показываются**

### Пример проблемы

```
Backend отдаёт: "САЛАТЫ • СУПЫ" → 11 товаров
Viewport: 3 колонки × 2 ряда = 6 товаров
Результат: показано 6, ПОТЕРЯНО 5 товаров!
```

### Ожидаемое поведение

```
Backend отдаёт: "САЛАТЫ • СУПЫ" → 11 товаров
Viewport: 3 колонки × 2 ряда = 6 товаров
Frontend создаёт:
  - Слайд 1: "САЛАТЫ • СУПЫ" → 6 товаров
  - Слайд 2: "САЛАТЫ • СУПЫ" → 5 товаров
Результат: ВСЕ 11 товаров показаны на 2 слайдах
```

---

## Решение: Динамическая пагинация на Frontend

### Концепция

Frontend сам определяет сколько товаров помещается на экран и **перебивает слайды от backend на "виртуальные" слайды**.

### Алгоритм

```typescript
// 1. Определить capacity (сколько товаров помещается)
const cols = calculateColumns(viewportWidth);  // 3-8 колонок
const rows = 2;  // Фиксировано
const capacity = cols * rows;  // 6-16 товаров

// 2. Перебить слайды от backend
function createVirtualSlides(backendSlides: Slide[], capacity: number): Slide[] {
  const virtualSlides: Slide[] = [];

  for (const slide of backendSlides) {
    if (slide.type === 'sets') {
      // Сеты не трогаем - у них своя логика (3 на слайд)
      virtualSlides.push(slide);
      continue;
    }

    // Products: разбиваем на виртуальные слайды по capacity
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
```

### Определение количества колонок

```typescript
function calculateColumns(viewportWidth: number): number {
  // Минимальная ширина карточки ~160px + gap
  const cardMinWidth = 160;
  const gap = 16;
  const padding = 40; // 20px с каждой стороны

  const availableWidth = viewportWidth - padding;
  const cols = Math.floor(availableWidth / (cardMinWidth + gap));

  // Ограничиваем: минимум 3, максимум 8
  return Math.max(3, Math.min(8, cols));
}
```

---

## Файлы для изменения

### Frontend (ИЗМЕНИТЬ)

| Файл | Изменение |
|------|-----------|
| `src/lib/components/flash/FlashContainer.svelte` | Добавить логику виртуальных слайдов |

### Frontend (НЕ ТРОГАТЬ)

| Файл | Причина |
|------|---------|
| `SlideProducts.svelte` | Только отображение, без логики |
| `SlideSets.svelte` | Без изменений |
| `ProductCard.svelte` | Без изменений |
| `types.ts` | Без изменений |

### Backend (НЕ ТРОГАТЬ)

Backend продолжает работать как раньше. Вся логика пагинации на frontend.

---

## Детальная реализация

### FlashContainer.svelte - ИЗМЕНИТЬ

```svelte
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

  // Расчёт capacity
  function calculateCapacity(width: number): number {
    const cardMinWidth = 160;
    const gap = 16;
    const padding = 40;
    const availableWidth = width - padding;
    const cols = Math.max(3, Math.min(8, Math.floor(availableWidth / (cardMinWidth + gap))));
    const rows = 2;
    return cols * rows;
  }

  // Создание виртуальных слайдов
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
    if (currentIndex >= slides.length) {
      currentIndex = 0;
    }
  });

  onMount(() => {
    // Слушать resize
    function handleResize() {
      viewportWidth = window.innerWidth;
    }
    window.addEventListener('resize', handleResize);

    // Автопереключение
    if (slides.length > 1) {
      intervalId = setInterval(() => {
        currentIndex = (currentIndex + 1) % slides.length;
      }, config.interval);
    }

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
    };
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });
</script>

<!-- Остальная разметка без изменений -->
```

---

## Тест-кейсы

### Тест 1: Узкий экран (768px)
- **Capacity:** 3 cols × 2 rows = 6
- **Backend "САЛАТЫ • СУПЫ":** 11 товаров
- **Ожидание:** 2 виртуальных слайда (6 + 5)

### Тест 2: Средний экран (1280px)
- **Capacity:** 6 cols × 2 rows = 12
- **Backend "САЛАТЫ • СУПЫ":** 11 товаров
- **Ожидание:** 1 слайд (все 11 помещаются)

### Тест 3: Сеты (любой экран)
- **Backend "СЕТЫ":** 3 товара
- **Ожидание:** 1 слайд, без изменений (сеты не разбиваются)

### Тест 4: Resize во время просмотра
- Изменить размер окна
- **Ожидание:** Слайды перестроятся, индекс сбросится если нужно

---

## Чеклист для Developer

- [ ] Добавить `viewportWidth` state в FlashContainer
- [ ] Добавить функцию `calculateCapacity()`
- [ ] Добавить функцию `createVirtualSlides()`
- [ ] Заменить `slides` на `$derived` виртуальные слайды
- [ ] Добавить `resize` listener
- [ ] Добавить `$effect` для сброса индекса
- [ ] НЕ трогать SlideProducts, SlideSets, ProductCard
- [ ] НЕ трогать backend
- [ ] Проверить flash-1 (сеты + шашлыки)
- [ ] Проверить flash-2 (все категории)
- [ ] Проверить на разных viewport sizes

---

## Ожидаемый результат

После реализации:
1. **ВСЕ товары показываются** — никакие не теряются
2. **Адаптивно к любому экрану** — автоматически больше/меньше слайдов
3. **Сеты без изменений** — по 3 на слайд как раньше
4. **Автопереключение работает** — с учётом виртуальных слайдов

---

*Версия: 3.0*
*Предыдущая версия: feedback-v2.md (реализована, но создала этот баг)*
