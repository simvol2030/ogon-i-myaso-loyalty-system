# Модуль рассылок и акций - План реализации

**Дата:** 2025-12-06
**Статус:** В разработке
**Версия:** 1.0

---

## Обзор

Модуль позволяет создавать и управлять рассылками через Telegram с гибкой сегментацией клиентов, кастомными триггерами и поддержкой изображений.

---

## 1. Изменения в БД

### 1.1 Обновление таблицы `loyalty_users`

```sql
-- Добавить поле дня рождения
ALTER TABLE loyalty_users ADD COLUMN birthday DATE;
```

### 1.2 Новые таблицы

#### `campaigns` — Рассылки/кампании

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | ID |
| title | TEXT | Название для админки |
| message_text | TEXT | Текст сообщения |
| message_image | TEXT | URL/путь изображения |
| button_text | TEXT | Текст кнопки (опционально) |
| button_url | TEXT | URL кнопки |
| offer_id | INTEGER FK | Связь с акцией (опционально) |
| target_type | TEXT | 'all' / 'segment' |
| target_filters | TEXT (JSON) | Фильтры сегментации |
| trigger_type | TEXT | 'manual' / 'scheduled' / 'event' |
| trigger_config | TEXT (JSON) | Настройки триггера |
| status | TEXT | 'draft' / 'scheduled' / 'sending' / 'completed' / 'cancelled' |
| scheduled_at | TIMESTAMP | Время отправки (для scheduled) |
| started_at | TIMESTAMP | Когда началась отправка |
| completed_at | TIMESTAMP | Когда завершилась |
| total_recipients | INTEGER | Всего получателей |
| sent_count | INTEGER | Отправлено |
| delivered_count | INTEGER | Доставлено |
| failed_count | INTEGER | Ошибки |
| created_by | INTEGER FK | Кто создал (admins) |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

#### `campaign_recipients` — Получатели

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | ID |
| campaign_id | INTEGER FK | Рассылка |
| loyalty_user_id | INTEGER FK | Клиент |
| status | TEXT | 'pending' / 'sent' / 'delivered' / 'failed' |
| sent_at | TIMESTAMP | Когда отправлено |
| error_message | TEXT | Текст ошибки |

#### `trigger_templates` — Шаблоны триггеров (кастомные)

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | ID |
| name | TEXT | Название триггера |
| description | TEXT | Описание |
| event_type | TEXT | Тип события (см. ниже) |
| event_config | TEXT (JSON) | Параметры события |
| message_template | TEXT | Шаблон сообщения |
| image_url | TEXT | Изображение по умолчанию |
| is_active | BOOLEAN | Включен/выключен |
| auto_send | BOOLEAN | Автоматическая отправка |
| created_at | TIMESTAMP | Дата создания |

#### `campaign_images` — Изображения для рассылок

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER PK | ID |
| filename | TEXT | Имя файла на сервере |
| original_name | TEXT | Оригинальное имя |
| mime_type | TEXT | Тип файла |
| size | INTEGER | Размер в байтах |
| created_at | TIMESTAMP | Дата загрузки |

---

## 2. Типы событий для триггеров

Админ может создавать триггеры на основе этих событий:

| event_type | Описание | Параметры (event_config) |
|------------|----------|--------------------------|
| `manual` | Ручной запуск | — |
| `scheduled` | По расписанию | `{ datetime: "2025-01-15T10:00:00" }` |
| `recurring` | Повторяющийся | `{ cron: "0 10 * * 1", timezone: "Europe/Moscow" }` |
| `offer_created` | Создана акция | `{ offer_id: null }` (null = любая) |
| `inactive_days` | Нет активности N дней | `{ days: 30 }` |
| `balance_reached` | Баланс достиг N | `{ min_balance: 1000 }` |
| `balance_low` | Баланс ниже N | `{ max_balance: 100 }` |
| `birthday` | День рождения | `{ days_before: 0 }` |
| `registration_anniversary` | Годовщина регистрации | `{ years: 1 }` |
| `first_purchase` | Первая покупка | — |
| `purchase_milestone` | N-ая покупка | `{ count: 10 }` |

---

## 3. Сегментация клиентов

JSON-структура для `target_filters`:

```json
{
  "store_ids": [1, 2],
  "balance_min": 100,
  "balance_max": 5000,
  "inactive_days": 30,
  "active_last_days": 7,
  "registration_after": "2024-01-01",
  "registration_before": "2024-06-01",
  "total_purchases_min": 5,
  "total_purchases_max": 100,
  "has_birthday": true,
  "birthday_month": 12,
  "is_active": true
}
```

---

## 4. Структура файлов

### 4.1 Backend (Express.js)

```
backend-expressjs/src/
├── db/
│   ├── schema.ts                    # + новые таблицы
│   └── queries/
│       ├── campaigns.ts             # CRUD campaigns
│       ├── campaignRecipients.ts    # Получатели
│       └── triggerTemplates.ts      # Шаблоны триггеров
├── routes/
│   └── admin/
│       ├── campaigns.ts             # API рассылок
│       ├── campaign-images.ts       # Загрузка изображений
│       └── triggers.ts              # API триггеров
├── services/
│   ├── campaignService.ts           # Бизнес-логика рассылок
│   ├── segmentationService.ts       # Фильтрация клиентов
│   └── telegramSender.ts            # Отправка в Telegram
└── jobs/
    ├── scheduledCampaigns.ts        # Запланированные рассылки
    ├── eventTriggers.ts             # Обработка событий
    └── birthdayTrigger.ts           # День рождения
```

### 4.2 Frontend (SvelteKit Admin)

```
frontend-sveltekit/src/routes/(admin)/
├── campaigns/
│   ├── +page.svelte                 # Список рассылок
│   ├── +page.server.ts              # Load данных
│   ├── new/
│   │   ├── +page.svelte             # Создание (wizard)
│   │   └── +page.server.ts          # Actions
│   └── [id]/
│       ├── +page.svelte             # Детали + статистика
│       ├── +page.server.ts
│       └── edit/
│           └── +page.svelte         # Редактирование
└── triggers/
    ├── +page.svelte                 # Список триггеров
    ├── +page.server.ts
    └── new/
        └── +page.svelte             # Создание триггера
```

### 4.3 Frontend (Telegram Web App) — Профиль

```
frontend-sveltekit/src/routes/
└── profile/
    ├── +page.svelte                 # + поле дня рождения
    └── +page.server.ts              # + action сохранения
```

### 4.4 Telegram Bot

```
telegram-bot/src/
├── index.ts                         # + новые endpoints
└── services/
    └── campaignSender.ts            # Отправка с rate limiting
```

---

## 5. API Endpoints

### 5.1 Campaigns

```
GET    /api/admin/campaigns                    # Список
POST   /api/admin/campaigns                    # Создать
GET    /api/admin/campaigns/:id                # Получить
PUT    /api/admin/campaigns/:id                # Обновить
DELETE /api/admin/campaigns/:id                # Удалить
POST   /api/admin/campaigns/:id/send           # Запустить
POST   /api/admin/campaigns/:id/cancel         # Отменить
GET    /api/admin/campaigns/:id/recipients     # Получатели
GET    /api/admin/campaigns/preview-audience   # Превью аудитории
```

### 5.2 Campaign Images

```
POST   /api/admin/campaign-images              # Загрузить
GET    /api/admin/campaign-images              # Список
DELETE /api/admin/campaign-images/:id          # Удалить
```

### 5.3 Triggers

```
GET    /api/admin/triggers                     # Список
POST   /api/admin/triggers                     # Создать
PUT    /api/admin/triggers/:id                 # Обновить
DELETE /api/admin/triggers/:id                 # Удалить
PUT    /api/admin/triggers/:id/toggle          # Вкл/Выкл
```

### 5.4 Profile (Web App)

```
PUT    /api/profile/birthday                   # Сохранить день рождения
```

### 5.5 Telegram Bot

```
POST   /bot/send-message                       # Отправить сообщение
POST   /bot/send-campaign                      # Отправить рассылку (batch)
```

---

## 6. UI Компоненты

### 6.1 Админка — Рассылки

- **CampaignList.svelte** — таблица с фильтрами и статусами
- **CampaignWizard.svelte** — пошаговое создание:
  - Шаг 1: Сообщение (текст + изображение + кнопка)
  - Шаг 2: Аудитория (фильтры с превью количества)
  - Шаг 3: Триггер (когда отправить)
  - Шаг 4: Превью и подтверждение
- **AudienceBuilder.svelte** — конструктор фильтров
- **MessageEditor.svelte** — редактор с превью Telegram
- **ImageUploader.svelte** — загрузка изображений
- **CampaignStats.svelte** — статистика доставки

### 6.2 Админка — Триггеры

- **TriggerList.svelte** — список с toggle вкл/выкл
- **TriggerEditor.svelte** — создание/редактирование
- **EventTypeSelector.svelte** — выбор типа события

### 6.3 Web App — Профиль

- **BirthdayInput.svelte** — ввод дня рождения (date picker)

---

## 7. Background Jobs

```typescript
// Каждую минуту — проверка scheduled рассылок
cron.schedule('* * * * *', checkScheduledCampaigns)

// Каждый час — обработка event триггеров
cron.schedule('0 * * * *', processEventTriggers)

// Ежедневно 09:00 — дни рождения
cron.schedule('0 9 * * *', processBirthdayTrigger)

// Ежедневно 10:00 — неактивные пользователи
cron.schedule('0 10 * * *', processInactivityTrigger)
```

---

## 8. План реализации по задачам

### Этап 1: База данных и модели
- [ ] Миграция: добавить birthday в loyalty_users
- [ ] Миграция: создать таблицы campaigns, campaign_recipients, trigger_templates, campaign_images
- [ ] Drizzle схема: обновить schema.ts
- [ ] Queries: campaigns.ts, campaignRecipients.ts, triggerTemplates.ts

### Этап 2: Backend API
- [ ] Routes: /api/admin/campaigns (CRUD + actions)
- [ ] Routes: /api/admin/campaign-images (upload)
- [ ] Routes: /api/admin/triggers (CRUD)
- [ ] Routes: /api/profile/birthday
- [ ] Service: campaignService.ts
- [ ] Service: segmentationService.ts

### Этап 3: Telegram Bot
- [ ] Endpoint: POST /send-message (одно сообщение)
- [ ] Endpoint: POST /send-campaign (batch с rate limiting)
- [ ] Service: campaignSender.ts с очередью

### Этап 4: Админка — Рассылки
- [ ] Страница: /campaigns (список)
- [ ] Страница: /campaigns/new (wizard создания)
- [ ] Страница: /campaigns/[id] (детали + статистика)
- [ ] Компоненты: MessageEditor, AudienceBuilder, ImageUploader

### Этап 5: Админка — Триггеры
- [ ] Страница: /triggers (список с toggle)
- [ ] Страница: /triggers/new (создание)
- [ ] Компонент: EventTypeSelector

### Этап 6: Web App — Профиль
- [ ] Компонент: BirthdayInput
- [ ] Интеграция в страницу профиля
- [ ] API сохранения

### Этап 7: Background Jobs
- [ ] Job: checkScheduledCampaigns
- [ ] Job: processEventTriggers
- [ ] Job: processBirthdayTrigger
- [ ] Интеграция в index.ts

### Этап 8: Тестирование
- [ ] Тест отправки сообщений
- [ ] Тест сегментации
- [ ] Тест триггеров
- [ ] Тест загрузки изображений

---

## 9. Персонализация сообщений

Поддержка переменных в тексте:

| Переменная | Значение |
|------------|----------|
| `{first_name}` | Имя клиента |
| `{last_name}` | Фамилия |
| `{balance}` | Текущий баланс |
| `{card_number}` | Номер карты |
| `{total_purchases}` | Всего покупок |

Пример: "Привет, {first_name}! У тебя {balance} бонусов 🎉"

---

## 10. Rate Limiting (Telegram)

- Telegram API лимит: ~30 msg/sec для ботов
- Реализация: очередь с интервалом 35ms между сообщениями
- Batch отправка: разбивка на chunks по 25 сообщений
- Retry логика: 3 попытки с exponential backoff

---

## 11. Хранение изображений

- Путь: `/backend-expressjs/uploads/campaigns/`
- Формат: `{uuid}.{ext}`
- Ресайз: max 1280x1280 (через sharp)
- Допустимые форматы: jpg, png, webp
- Макс размер: 5MB

---

## Технические заметки

1. **Транзакции БД** — использовать при создании рассылки с получателями
2. **Индексы** — добавить на status, scheduled_at, campaign_id
3. **Soft delete** — для campaigns использовать status='cancelled'
4. **Логирование** — важные операции логировать для отладки
