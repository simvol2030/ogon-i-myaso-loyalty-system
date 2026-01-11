# Ogon i Myaso Loyalty System — Codebase Context

**URL:** https://ogon-i-myaso.klik1.ru
**Тип:** Telegram Mini App система лояльности для ресторана "Огонь и Мясо"
**Workflow Developer:** см. `CLAUDE.web.md` (в этой директории)
**Workflow CLI:** см. `../CLAUDE.local.md` (в parent директории)

---

## Структура проекта

```
loyalty-system/
├── frontend-sveltekit/     # SvelteKit 2.x + Svelte 5
│   ├── src/routes/         # Страницы
│   └── src/lib/            # Компоненты, stores
├── backend-expressjs/      # Express.js REST API
│   ├── src/routes/         # API endpoints
│   └── src/services/       # Бизнес-логика
├── telegram-bot/           # Grammy bot
│   └── src/                # Bot handlers
├── data/
│   ├── db/sqlite/          # SQLite БД
│   ├── logs/               # Логи приложения
│   └── media/              # Загруженные файлы
├── project-doc/            # Документация сессий
├── feedbacks/              # Feedback для Developer
└── .claude/                # Hooks для уведомлений
```

---

## Tech Stack

| Компонент | Технологии |
|-----------|------------|
| **Frontend** | SvelteKit 2.x, Svelte 5, TypeScript, Telegram WebApp SDK |
| **Backend** | Express.js, Drizzle ORM, SQLite, JWT |
| **Bot** | Grammy |
| **DevOps** | PM2, Nginx, SSH-MCP, GitHub MCP |

---

## База данных

| Таблица | Описание |
|---------|----------|
| `users` | Пользователи системы |
| `products` | Товары/блюда меню |
| `categories` | Категории товаров |
| `orders` | Заказы |
| `transactions` | Транзакции баллов |
| `stores` | Точки продаж |
| `promotions` | Акции |
| `stories` | Истории |

---

## .gitignore (важное)

```gitignore
# Uploads
backend-expressjs/uploads/
!backend-expressjs/uploads/.gitkeep

# Data
data/db/sqlite/*.db
data/logs/
data/media/

# Build
node_modules/
dist/
build/
.svelte-kit/

# Media
*.jpg
*.jpeg
*.png
*.webp
*.gif
*.mp4
```

---

## API Endpoints (основные)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/login` | Авторизация |
| POST | `/api/auth/telegram` | Telegram auth |
| GET | `/api/products` | Список товаров |
| GET | `/api/categories` | Категории |
| POST | `/api/orders` | Создать заказ |
| GET | `/api/user/balance` | Баланс баллов |
| POST | `/api/transactions` | Начисление/списание |

---

## Telegram Bot

**Bot:** @Ogon_i_Mayso_bot
**Token:** `8090127980:AAHpXs2CNT8LGG6y4liD7Dlkarnyhn4m_kE`
**Orders Group ID:** `-1002614350260`

**Команды:**
- `/start` — Регистрация в системе лояльности
- `/balance` — Проверить баланс
- `/help` — Помощь

---

## Доступы

**Admin Panel:** https://ogon-i-myaso.klik1.ru/login
- Email: `admin@ogon-i-myaso.ru`
- Password: `OgonMyaso2026!`

**Database:** SQLite → `/opt/websites/ogon-i-myaso.klik1.ru/data/db/sqlite/app.db`

---

## НЕ ПУТАТЬ

| Этот проект | Другой проект |
|-------------|---------------|
| ogon-i-myaso.klik1.ru | granat.klik1.ru |
| `ogon-i-myaso-loyalty-system` | `granat-loyalty-system` |
| `ogon-*` PM2 | `granat-*` PM2 |

---

*Версия: 1.0 | 2026-01-11*
*Based on granat-loyalty-system*
