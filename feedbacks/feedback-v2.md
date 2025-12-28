# Feedback v2 - Flash Screens: Улучшение сетки и группировка категорий

**Дата:** 2025-12-27
**Branch to create:** `claude/flash-screens-v2`
**Базовая ветка:** `main` (содержит v1 реализацию)

---

## КРИТИЧЕСКИ ВАЖНО

> **Scope изменений: ТОЛЬКО flash-компоненты!**
>
> - НЕ трогать основные компоненты приложения (`/src/lib/components/` кроме `/flash/`)
> - НЕ менять основные layouts (`+layout.svelte` в корне routes)
> - НЕ менять логику каталога, корзины, авторизации
> - API endpoint `/api/flash/:screen` можно РАСШИРИТЬ, но не ломать существующий контракт
> - Все изменения изолированы в `/flash/` директориях

---

## Описание задачи

Улучшить Flash Screens (TV-меню) v1:
1. Изменить сетку товаров: 2 ряда вместо 3
2. Гибкое количество колонок (auto-fit)
3. Объединить малые категории по смыслу
4. Объединённые заголовки ("САЛАТЫ • СУПЫ")

---

## Изменения в деталях

### 1. Сетка товаров: 6×2 вместо 6×3

**Было:**
- 3 ряда × 6 колонок = 18 товаров на слайд
- Фиксированная сетка

**Стало:**
- 2 ряда × 6+ колонок = 12+ товаров на слайд
- Гибкое количество колонок через CSS Grid auto-fit

```css
/* SlideProducts.svelte - ИЗМЕНИТЬ */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  grid-template-rows: repeat(2, 1fr); /* 2 ряда вместо 3 */
  gap: 1rem;
  height: calc(100vh - 80px); /* Учесть header с заголовком */
}
```

### 2. Сеты: БЕЗ ИЗМЕНЕНИЙ

Сеты остаются 3 на слайд (крупные карточки). Не менять `SlideSets.svelte`.

### 3. Группировка категорий по смыслу

#### Flash-1 (Мангал)

```typescript
const FLASH1_GROUPS = [
  {
    id: 'sets',
    title: 'СЕТЫ',
    categoryIds: [7],      // Сеты
    layout: 'sets'         // 3 на слайд
  },
  {
    id: 'grill',
    title: 'ШАШЛЫК • КЕБАБ',
    categoryIds: [5, 6],   // Шашлык, Кебаб
    layout: 'products'     // 6×2 сетка
  }
];
```

#### Flash-2 (Остальное меню)

```typescript
const FLASH2_GROUPS = [
  {
    id: 'first-courses',
    title: 'САЛАТЫ • СУПЫ',
    categoryIds: [3, 4],   // Салаты, Супы
    layout: 'products'
  },
  {
    id: 'main-courses',
    title: 'ВТОРЫЕ БЛЮДА • ГАРНИРЫ',
    categoryIds: [8, 9],   // Вторые блюда, Гарниры
    layout: 'products'
  },
  {
    id: 'georgian',
    title: 'ХИНКАЛИ • ХАЧАПУРИ',
    categoryIds: [1, 10],  // Хинкали, Хачапури
    layout: 'products'
  },
  {
    id: 'fastfood',
    title: 'ПИЦЦА • ШАУРМА',
    categoryIds: [11, 12], // Пицца, Шаурма
    layout: 'products'
  },
  {
    id: 'bakery',
    title: 'ВЫПЕЧКА',
    categoryIds: [13],     // Выпечка
    layout: 'products'
  },
  {
    id: 'extras',
    title: 'СОУСЫ • НАПИТКИ',
    categoryIds: [2, 14],  // Соусы, Напитки
    layout: 'products'
  }
];
```

### 4. Логика генерации слайдов (Backend)

**Файл:** `backend-expressjs/src/routes/flash.ts`

```typescript
// РАСШИРИТЬ существующую логику, не ломать

interface CategoryGroup {
  id: string;
  title: string;           // "САЛАТЫ • СУПЫ"
  categoryIds: number[];
  layout: 'products' | 'sets';
}

interface Slide {
  type: 'products' | 'sets';
  title: string;           // Было: category, стало: title (объединённый)
  items: Product[];
}

function generateSlidesForGroup(group: CategoryGroup, products: Product[]): Slide[] {
  const slides: Slide[] = [];

  if (group.layout === 'sets') {
    // Сеты: по 3 на слайд (БЕЗ ИЗМЕНЕНИЙ)
    const SETS_PER_SLIDE = 3;
    for (let i = 0; i < products.length; i += SETS_PER_SLIDE) {
      slides.push({
        type: 'sets',
        title: group.title,
        items: products.slice(i, i + SETS_PER_SLIDE)
      });
    }
  } else {
    // Товары: по 12 на слайд (ИЗМЕНЕНО с 18)
    const ITEMS_PER_SLIDE = 12;
    for (let i = 0; i < products.length; i += ITEMS_PER_SLIDE) {
      slides.push({
        type: 'products',
        title: group.title,
        items: products.slice(i, i + ITEMS_PER_SLIDE)
      });
    }
  }

  return slides;
}
```

---

## Файлы для изменения

### Backend (ИЗМЕНИТЬ)

| Файл | Изменение |
|------|-----------|
| `backend-expressjs/src/routes/flash.ts` | Добавить группы категорий, изменить генерацию слайдов |

### Frontend (ИЗМЕНИТЬ)

| Файл | Изменение |
|------|-----------|
| `src/lib/components/flash/SlideProducts.svelte` | Сетка 2 ряда, auto-fit колонки |
| `src/lib/components/flash/types.ts` | Обновить интерфейс Slide (category → title) |

### Frontend (НЕ ТРОГАТЬ)

| Файл | Причина |
|------|---------|
| `src/lib/components/flash/SlideSets.svelte` | Сеты остаются 3 на слайд |
| `src/lib/components/flash/FlashContainer.svelte` | Логика переключения без изменений |
| `src/lib/components/flash/SlideIndicator.svelte` | Без изменений |
| `src/routes/+layout.svelte` | УЖЕ исправлен в v1 |

### Основное приложение (КАТЕГОРИЧЕСКИ НЕ ТРОГАТЬ)

| Директория | Причина |
|------------|---------|
| `src/lib/components/catalog/` | Основной каталог приложения |
| `src/lib/components/cart/` | Корзина |
| `src/lib/components/ui/` | UI компоненты приложения |
| `src/routes/(app)/` | Основные маршруты приложения |
| `backend-expressjs/src/routes/` (кроме flash.ts) | Основное API |

---

## Ожидаемый результат

### Flash-1 (Мангал) — 5 слайдов

| # | Заголовок | Товаров | Layout |
|---|-----------|---------|--------|
| 1 | СЕТЫ | 3 | sets (3 карточки) |
| 2 | СЕТЫ | 3 | sets |
| 3 | СЕТЫ | 3 | sets |
| 4 | ШАШЛЫК • КЕБАБ | 12 | products (6×2) |
| 5 | ШАШЛЫК • КЕБАБ | 7 | products (неполный) |

### Flash-2 (Остальное) — 6 слайдов

| # | Заголовок | Товаров | Layout |
|---|-----------|---------|--------|
| 1 | САЛАТЫ • СУПЫ | 11 | products |
| 2 | ВТОРЫЕ БЛЮДА • ГАРНИРЫ | 11 | products |
| 3 | ХИНКАЛИ • ХАЧАПУРИ | 7 | products |
| 4 | ПИЦЦА • ШАУРМА | 10 | products |
| 5 | ВЫПЕЧКА | 11 | products |
| 6 | СОУСЫ • НАПИТКИ | 11 | products |

---

## Чеклист для Developer

- [ ] Изменить `flash.ts` — добавить группы категорий
- [ ] Изменить `flash.ts` — ITEMS_PER_SLIDE = 12 (было 18)
- [ ] Изменить `SlideProducts.svelte` — CSS Grid 2 ряда + auto-fit
- [ ] Изменить `types.ts` — category → title в интерфейсе
- [ ] НЕ трогать `SlideSets.svelte`
- [ ] НЕ трогать основные компоненты приложения
- [ ] Проверить что основное приложение работает после изменений
- [ ] Проверить оба маршрута: `/flash-1` и `/flash-2`

---

## Тестирование

### Flash screens (ПРОВЕРИТЬ)
1. `/flash-1` — сеты по 3, затем шашлык+кебаб в сетке 6×2
2. `/flash-2` — 6 групп категорий, сетка 6×2
3. Автопереключение 15 сек работает
4. Заголовки отображаются корректно ("САЛАТЫ • СУПЫ")

### Основное приложение (УБЕДИТЬСЯ ЧТО НЕ СЛОМАНО)
1. Главная страница загружается
2. Каталог работает
3. Корзина работает
4. Авторизация работает

---

*Версия: 2.0*
*Предыдущая версия: feedback-v1.md (реализована)*
