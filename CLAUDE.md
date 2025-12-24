# Granat Loyalty System

**URL:** https://granat.klik1.ru
**Тип:** Telegram Mini App система лояльности
**Workflow:** см. `CLAUDE.local.md`

---

## Пути проекта

| Среда | Путь |
|-------|------|
| **WSL** | `/home/solo18/dev/granat/project/loyalty-system` |
| **Windows** | `C:\dev\granat\project\loyalty-system` |
| **GitHub** | https://github.com/simvol2030/granat-loyalty-system |
| **GitHub ветка** | `main` (единственная) |
| **Сервер** | `/opt/websites/granat.klik1.ru` |

---

## PM2 (Production)

| Процесс | Порт |
|---------|------|
| `granat-frontend-dev` | 3013 |
| `granat-backend-dev` | 3012 |

```bash
source ~/.nvm/nvm.sh && pm2 restart granat-frontend-dev granat-backend-dev
```

---

## Доступы

**Admin Panel:** https://granat.klik1.ru/login
- Email: `admin@example.com`
- Password: `Admin123!@#$`

**Telegram Bot:** @granat_loyalty_bot
- Token: `8274694924:AAHkHtEQPbqadquZ_yN9FxYJqsCXmGmgrCE`
- Группа заказов: `-1003676119639`

**Database:** SQLite → `/opt/websites/granat.klik1.ru/data/db/sqlite/app.db`

---

## Структура

```
loyalty-system/
├── frontend-sveltekit/   # SvelteKit 2.x + Svelte 5
├── backend-expressjs/    # Express.js REST API
├── telegram-bot/         # grammy bot
└── data/db/sqlite/       # SQLite DB
```

---

## Tech Stack

- **Frontend:** SvelteKit 2.x, Svelte 5, TypeScript, Telegram WebApp SDK
- **Backend:** Express.js, Drizzle ORM, SQLite, JWT
- **Bot:** grammy
- **DevOps:** PM2, Nginx, SSH-MCP, GitHub MCP

---

## Deploy

```bash
# На сервере (через SSH MCP)
cd /opt/websites/granat.klik1.ru && git pull origin main
cd backend-expressjs && npm install && npm run build
cd ../frontend-sveltekit && npm install && npm run build
source ~/.nvm/nvm.sh && pm2 restart granat-frontend-dev granat-backend-dev
```

---

## Uploads (в .gitignore)

Путь: `/opt/websites/granat.klik1.ru/backend-expressjs/uploads/`
Бэкап: `uploads-backup-20251224.tar.gz` (12 MB)

Директории: branding, products, stories, promotions, stores, campaigns, categories, feed, welcome-messages

---

## НЕ ПУТАТЬ с другим проектом на сервере

| | Этот проект | Другой проект |
|-|-------------|---------------|
| **URL** | granat.klik1.ru | sl-dev.bot-3.ru |
| **Сервер** | `/opt/websites/granat.klik1.ru` | `/opt/websites/sl-dev.bot-3.ru` |
| **GitHub** | `granat-loyalty-system` | `loyalty-system-universal` |
| **PM2** | `granat-*` | `sl-*` |
