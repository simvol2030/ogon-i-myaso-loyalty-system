# Проблемы при развёртывании и их решения

> **Проект:** ogon-i-myaso-loyalty-system
> **Дата:** 2026-01-11
> **Автор:** CLI Integrator

---

## Критическая проблема: 500 ошибки в админ-панели

### Симптомы
После развёртывания проекта (npm install, build, PM2 start) следующие разделы админки возвращали **500 Internal Error**:
- Клиенты (/clients)
- Акции (/promotions)
- Рассылки (/campaigns)
- Приветственные сообщения (/campaigns/welcome)
- Триггеры (/triggers)
- Товары (/products-admin)
- Категории (/categories)

### Причина
**Отсутствие `SESSION_SECRET` в переменных окружения PM2.**

В логах backend:
```
SESSION_SECRET is required for decryption
[SESSION-AUTH] Attempting decrypt with SECRET: NO
[SESSION-AUTH] Decrypt result: FAILED
```

В логах frontend:
```
WARNING: SESSION_SECRET not set in environment. Using insecure fallback!
Error: Invalid or expired session
```

### Решение
Добавить `SESSION_SECRET` в `ecosystem.config.js` для **обоих** frontend и backend:

```javascript
module.exports = {
  apps: [
    {
      name: 'ogon-frontend',
      cwd: '/opt/websites/ogon-i-myaso.klik1.ru/frontend-sveltekit',
      script: 'build/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3026',
        ORIGIN: 'https://ogon-i-myaso.klik1.ru',
        PUBLIC_BACKEND_URL: 'https://ogon-i-myaso.klik1.ru',
        SESSION_SECRET: 'YOUR_SECURE_SECRET_HERE'  // <-- КРИТИЧНО!
      }
    },
    {
      name: 'ogon-backend',
      cwd: '/opt/websites/ogon-i-myaso.klik1.ru/backend-expressjs',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3027',
        SESSION_SECRET: 'YOUR_SECURE_SECRET_HERE',  // <-- КРИТИЧНО! (тот же ключ)
        JWT_SECRET: 'YOUR_JWT_SECRET_HERE'
      }
    }
  ]
};
```

**ВАЖНО:**
1. `SESSION_SECRET` должен быть **одинаковым** для frontend и backend
2. PM2 НЕ читает `.env` файлы автоматически - переменные должны быть в `ecosystem.config.js`
3. После изменения config нужно: `pm2 delete app-name && pm2 start ecosystem.config.js`

---

## Чек-лист развёртывания нового проекта

### 1. Подготовка сервера
- [ ] Создать директорию `/opt/websites/[domain]`
- [ ] Проверить свободные порты: `ss -tlnp | grep -E ':(30[0-9]{2})'`
- [ ] Выбрать 3 свободных порта (frontend, backend, bot)

### 2. Клонирование и настройка
- [ ] `git clone [repo] .`
- [ ] Создать `.env` файлы (опционально, для локальной разработки)
- [ ] Создать `ecosystem.config.js` с **ОБЯЗАТЕЛЬНЫМИ** переменными:
  - `SESSION_SECRET` (одинаковый для frontend и backend!)
  - `JWT_SECRET`
  - `PUBLIC_BACKEND_URL`
  - `ORIGIN`
  - `PORT` для каждого сервиса

### 3. База данных
- [ ] `cd backend-expressjs && npm run db:generate && npm run db:migrate`
- [ ] Создать admin пользователя:
```bash
cd backend-expressjs
node -e "
const bcrypt = require('bcrypt');
const hash = bcrypt.hashSync('YOUR_PASSWORD', 10);
console.log(hash);
"
# Затем вставить в БД
sqlite3 ../data/db/sqlite/app.db "INSERT INTO admins (email, password, role, name) VALUES ('admin@domain.ru', 'HASH', 'super-admin', 'Admin');"
```

**ВАЖНО:** Роль должна быть `super-admin` (с дефисом), НЕ `super_admin` (с подчёркиванием)!

- [ ] Создать начальную запись в loyalty_settings:
```bash
sqlite3 ../data/db/sqlite/app.db "INSERT INTO loyalty_settings (id, earning_percent, max_discount_percent, expiry_days, welcome_bonus, birthday_bonus, min_redemption_amount, points_name, support_email, support_phone) VALUES (1, 4, 20, 45, 500, 0, 1, 'Баллы', 'info@domain.ru', '+7 (800) 000-00-00')"
```

### 4. Build
- [ ] `cd frontend-sveltekit && npm install && npm run build`
- [ ] `cd backend-expressjs && npm install && npm run build`
- [ ] `cd telegram-bot && npm install && npm run build`

### 5. PM2
- [ ] `pm2 start ecosystem.config.js`
- [ ] `pm2 save`
- [ ] Проверить логи: `pm2 logs [app-name] --lines 20`

### 6. Nginx + SSL
- [ ] Создать конфиг nginx
- [ ] `certbot --nginx -d [domain]`
- [ ] `nginx -t && systemctl reload nginx`

### 7. Проверка
- [ ] Открыть сайт в браузере
- [ ] Войти в админку
- [ ] Проверить **ВСЕ** разделы на 500 ошибки
- [ ] Проверить логи PM2 на ошибки

---

## Разделы админки и их зависимости

| Раздел | Требует auth session | API endpoint |
|--------|---------------------|--------------|
| Dashboard | Нет | `/api/stats` (публичный) |
| Клиенты | **Да** | `/api/users` |
| Акции | **Да** | `/api/promotions` |
| Рассылки | **Да** | `/api/campaigns` |
| Приветственные | **Да** | `/api/campaigns/welcome` |
| Триггеры | **Да** | `/api/triggers` |
| Лента | Нет | `/api/feed` |
| Истории | Нет | `/api/stories` |
| Товары | **Да** | `/api/products` |
| Категории | **Да** | `/api/categories` |
| Заказы | Нет* | `/api/orders` |
| Магазины | Нет | `/api/stores` |
| Продавцы | Нет | `/api/sellers` |
| Статистика | Нет | `/api/stats` |
| Настройки магазина | Нет | `/api/shop-settings` |
| Локации | Нет | `/api/delivery-locations` |
| Доставка | Нет | `/api/delivery-settings` |
| Настройки (/settings) | **super-admin** | `/api/loyalty-settings` |

**Разделы с "Да" в колонке auth session** будут давать 500 если SESSION_SECRET не настроен.

---

## Полезные команды диагностики

```bash
# Проверить SESSION_SECRET в логах
pm2 logs ogon-backend --lines 50 | grep -i "secret\|session"

# Проверить ошибки frontend
pm2 logs ogon-frontend --err --lines 30

# Перезапуск с обновлением переменных окружения
pm2 delete ogon-frontend ogon-backend
pm2 start ecosystem.config.js

# Проверить переменные процесса
pm2 env [process-id]
```

---

## Проблема: Раздел /settings не отображается в меню

### Симптомы
После авторизации раздел "Настройки" (`/settings`) не виден в навигации админ-панели.

### Причина
**Несоответствие формата роли в БД и коде.**

Код проверяет:
```svelte
{#if data.user?.role === 'super-admin'}
    <a href="/settings">...</a>
{/if}
```

Но в БД была роль `super_admin` (с подчёркиванием) вместо `super-admin` (с дефисом).

### Решение
```bash
sqlite3 /path/to/app.db "UPDATE admins SET role = 'super-admin' WHERE email = 'admin@domain.ru'"
```

После обновления роли нужно **перелогиниться** для обновления сессии.

**ВАЖНО:** Сессия хранит роль на момент входа. Если пользователь залогинился до исправления роли, его сессия содержит старую роль и он не увидит раздел /settings в меню, хотя сможет открыть его по прямой ссылке. Решение — выйти и войти заново.

---

## Проблема: /settings даёт 500 после исправления роли

### Симптомы
Раздел появился в меню, но при открытии возвращает 500 Internal Error.

В логах frontend:
```
Error: Настройки лояльности не найдены
```

### Причина
**Таблица `loyalty_settings` пустая** — нет начальной записи с настройками.

### Решение
```bash
sqlite3 /path/to/app.db "INSERT INTO loyalty_settings (id, earning_percent, max_discount_percent, expiry_days, welcome_bonus, birthday_bonus, min_redemption_amount, points_name, support_email, support_phone) VALUES (1, 4, 20, 45, 500, 0, 1, 'Баллы', 'info@domain.ru', '+7 (800) 000-00-00')"
```

---

*Документ создан на основе реального опыта развёртывания. Обновлять при обнаружении новых проблем.*
