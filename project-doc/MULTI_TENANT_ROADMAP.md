# Multi-Tenant Roadmap

> **Цель:** Адаптировать проект для быстрого развёртывания новых инстансов без ручной правки кода
> **Приоритет:** После стабилизации текущего функционала
> **Оценка:** 2-3 дня работы

---

## Текущие проблемы

При форке проекта для нового клиента приходится вручную:
1. Менять hardcoded значения в коде (Yandex ID, названия и т.д.)
2. Создавать записи в БД (loyalty_settings, shop_settings, admin)
3. Включать закомментированный код
4. Настраивать nginx с правильными роутами
5. Добавлять все переменные в ecosystem.config.js

**Время на развёртывание:** 2-4 часа вместо 15 минут

---

## План улучшений

### Этап 1: Убрать hardcoded значения (Приоритет: HIGH)

#### 1.1 Yandex Maps Organization ID
**Файлы:**
- `frontend-sveltekit/src/lib/components/ui/ReputationWidget.svelte`
- `frontend-sveltekit/src/lib/components/ui/ReputationWidgetTable.svelte`

**Сейчас:**
```javascript
const YANDEX_REVIEW_URL = 'https://yandex.ru/profile/18349245777/?add-review=true';
```

**Должно быть:**
```javascript
export let yandexOrgId: string = '';
$: YANDEX_REVIEW_URL = yandexOrgId
  ? `https://yandex.ru/profile/${yandexOrgId}/?add-review=true`
  : null;
```

**Добавить в БД:**
```sql
ALTER TABLE shop_settings ADD COLUMN yandex_org_id TEXT;
```

#### 1.2 Другие hardcoded значения для поиска
```bash
# Найти все потенциальные hardcoded значения
grep -rn "yandex.ru/profile" frontend-sveltekit/src/
grep -rn "murzik\|granat" frontend-sveltekit/src/
grep -rn "t.me/" frontend-sveltekit/src/
```

---

### Этап 2: Seed скрипт для БД (Приоритет: HIGH)

#### 2.1 Создать `backend-expressjs/src/scripts/seed.ts`

```typescript
import { db } from '../db/client';
import { loyaltySettings, shopSettings, admins } from '../db/schema';
import bcrypt from 'bcrypt';

interface SeedConfig {
  adminEmail: string;
  adminPassword: string;
  shopName: string;
  pointsName?: string;
  welcomeBonus?: number;
  telegramBotToken?: string;
  telegramGroupId?: string;
  yandexOrgId?: string;
}

export async function seedDatabase(config: SeedConfig) {
  console.log('🌱 Seeding database...');

  // 1. Create admin
  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  await db.insert(admins).values({
    email: config.adminEmail,
    password: passwordHash,
    role: 'super-admin',  // ВАЖНО: с дефисом!
    name: 'Admin'
  }).onConflictDoNothing();
  console.log('✅ Admin created');

  // 2. Create loyalty_settings
  await db.insert(loyaltySettings).values({
    id: 1,
    earning_percent: 4,
    max_discount_percent: 20,
    expiry_days: 45,
    welcome_bonus: config.welcomeBonus || 500,
    birthday_bonus: 0,
    min_redemption_amount: 1,
    points_name: config.pointsName || 'Баллы',
    support_email: `info@${config.shopName}.ru`,
    support_phone: '+7 (800) 000-00-00'
  }).onConflictDoNothing();
  console.log('✅ Loyalty settings created');

  // 3. Create shop_settings
  await db.insert(shopSettings).values({
    id: 1,
    shop_name: config.shopName,
    telegram_bot_token: config.telegramBotToken || '',
    telegram_group_id: config.telegramGroupId || '',
    telegram_notifications_enabled: config.telegramBotToken ? 1 : 0,
    yandex_org_id: config.yandexOrgId || ''
  }).onConflictDoNothing();
  console.log('✅ Shop settings created');

  console.log('🎉 Database seeded successfully!');
}
```

#### 2.2 CLI команда для seed
```bash
# package.json
"scripts": {
  "db:seed": "tsx src/scripts/seed.ts"
}

# Использование
npm run db:seed -- --admin-email=admin@shop.ru --admin-password=SecurePass123 --shop-name="Магазин"
```

---

### Этап 3: Валидация при старте (Приоритет: MEDIUM)

#### 3.1 Backend startup check
**Файл:** `backend-expressjs/src/index.ts`

```typescript
async function validateRequiredSettings() {
  const errors: string[] = [];

  // Check loyalty_settings
  const loyaltySettings = await db.select().from(loyaltySettingsTable).get();
  if (!loyaltySettings) {
    errors.push('❌ loyalty_settings table is empty. Run: npm run db:seed');
  }

  // Check shop_settings
  const shopSettings = await db.select().from(shopSettingsTable).get();
  if (!shopSettings) {
    errors.push('❌ shop_settings table is empty. Run: npm run db:seed');
  }

  // Check admin exists
  const admin = await db.select().from(adminsTable).limit(1).get();
  if (!admin) {
    errors.push('❌ No admin user found. Run: npm run db:seed');
  }

  if (errors.length > 0) {
    console.error('\n🚨 STARTUP VALIDATION FAILED:\n');
    errors.forEach(e => console.error(e));
    console.error('\n');
    process.exit(1);
  }

  console.log('✅ All required settings validated');
}

// Call before starting server
await validateRequiredSettings();
```

#### 3.2 Frontend startup check
**Файл:** `frontend-sveltekit/src/hooks.server.ts`

```typescript
// One-time check on first request
let validated = false;

export const handle: Handle = async ({ event, resolve }) => {
  if (!validated) {
    const settings = await db.select().from(loyaltySettings).get();
    if (!settings) {
      console.error('🚨 loyalty_settings not configured!');
    }
    validated = true;
  }
  return resolve(event);
};
```

---

### Этап 4: Убрать временные хаки (Приоритет: HIGH)

#### 4.1 Список мест с `/* TEMPORARILY DISABLED */`
```bash
grep -rn "TEMPORARILY\|TODO:\|FIXME:" frontend-sveltekit/src/ backend-expressjs/src/
```

#### 4.2 Заменить на feature flags
```typescript
// config.ts
export const features = {
  telegramInit: process.env.FEATURE_TELEGRAM_INIT !== 'false',
  welcomeBonus: process.env.FEATURE_WELCOME_BONUS !== 'false',
};

// +layout.svelte
if (features.telegramInit) {
  const { initializeUser } = await import('$lib/telegram');
  await initializeUser();
}
```

---

### Этап 5: Шаблон nginx конфига (Приоритет: MEDIUM)

#### 5.1 Создать `deployment/nginx.template.conf`
```nginx
server {
    server_name {{DOMAIN}};

    # Telegram API (SvelteKit) - MUST BE BEFORE /api
    location /api/telegram {
        proxy_pass http://127.0.0.1:{{FRONTEND_PORT}};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API requests to backend
    location /api {
        proxy_pass http://127.0.0.1:{{BACKEND_PORT}};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend (default)
    location / {
        proxy_pass http://127.0.0.1:{{FRONTEND_PORT}};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 5.2 Скрипт генерации
```bash
#!/bin/bash
# deployment/generate-nginx.sh

DOMAIN=$1
FRONTEND_PORT=$2
BACKEND_PORT=$3

sed -e "s/{{DOMAIN}}/$DOMAIN/g" \
    -e "s/{{FRONTEND_PORT}}/$FRONTEND_PORT/g" \
    -e "s/{{BACKEND_PORT}}/$BACKEND_PORT/g" \
    nginx.template.conf > /etc/nginx/sites-available/$DOMAIN
```

---

### Этап 6: Шаблон ecosystem.config.js (Приоритет: MEDIUM)

#### 6.1 Создать `deployment/ecosystem.template.js`
```javascript
module.exports = {
  apps: [
    {
      name: '{{PROJECT}}-frontend',
      cwd: '{{PATH}}/frontend-sveltekit',
      script: 'build/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: '{{FRONTEND_PORT}}',
        ORIGIN: 'https://{{DOMAIN}}',
        PUBLIC_BACKEND_URL: 'https://{{DOMAIN}}',
        SESSION_SECRET: '{{SESSION_SECRET}}'
      }
    },
    {
      name: '{{PROJECT}}-backend',
      cwd: '{{PATH}}/backend-expressjs',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: '{{BACKEND_PORT}}',
        SESSION_SECRET: '{{SESSION_SECRET}}',
        JWT_SECRET: '{{JWT_SECRET}}',
        TELEGRAM_BOT_TOKEN: '{{BOT_TOKEN}}',
        ORDERS_GROUP_ID: '{{ORDERS_GROUP_ID}}'
      }
    },
    {
      name: '{{PROJECT}}-bot',
      cwd: '{{PATH}}/telegram-bot',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: '{{BOT_PORT}}',
        BOT_TOKEN: '{{BOT_TOKEN}}',
        WEB_APP_URL: 'https://{{DOMAIN}}',
        API_BASE_URL: 'http://localhost:{{BACKEND_PORT}}/api',
        BACKEND_URL: 'http://localhost:{{BACKEND_PORT}}',
        ORDERS_GROUP_ID: '{{ORDERS_GROUP_ID}}'
      }
    }
  ]
};
```

---

### Этап 7: Скрипт быстрого развёртывания (Приоритет: LOW)

#### 7.1 Создать `deployment/setup.sh`
```bash
#!/bin/bash
# Интерактивный скрипт развёртывания

echo "🚀 Loyalty System Setup"
echo "======================"

read -p "Domain (e.g., shop.example.ru): " DOMAIN
read -p "Project name (e.g., myshop): " PROJECT
read -p "Frontend port: " FRONTEND_PORT
read -p "Backend port: " BACKEND_PORT
read -p "Bot port: " BOT_PORT
read -p "Telegram Bot Token: " BOT_TOKEN
read -p "Orders Group ID: " ORDERS_GROUP_ID
read -p "Admin email: " ADMIN_EMAIL
read -s -p "Admin password: " ADMIN_PASSWORD
echo ""
read -p "Shop name: " SHOP_NAME
read -p "Yandex Org ID (optional): " YANDEX_ORG_ID

# Generate secrets
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

echo ""
echo "📁 Creating configuration files..."

# 1. Generate ecosystem.config.js
# 2. Generate nginx config
# 3. Run npm install & build
# 4. Run db:migrate
# 5. Run db:seed
# 6. Start PM2
# 7. Setup nginx & SSL

echo "✅ Setup complete!"
echo "🌐 Your site: https://$DOMAIN"
echo "🔐 Admin panel: https://$DOMAIN/login"
```

---

## Чек-лист после реализации

После выполнения всех этапов развёртывание нового инстанса должно занимать **15 минут**:

1. [ ] `git clone repo && cd repo`
2. [ ] `./deployment/setup.sh` (интерактивно вводим параметры)
3. [ ] Настроить BotFather (имя, описание, меню)
4. [ ] Готово!

---

## Приоритеты реализации

| Этап | Приоритет | Время | Эффект |
|------|-----------|-------|--------|
| 1. Hardcoded values | HIGH | 2ч | Убирает ручную правку кода |
| 2. Seed скрипт | HIGH | 3ч | Убирает ручные SQL команды |
| 3. Startup validation | MEDIUM | 2ч | Понятные ошибки вместо 500 |
| 4. Временные хаки | HIGH | 1ч | Убирает забытые комментарии |
| 5. Nginx шаблон | MEDIUM | 1ч | Убирает ошибки в роутинге |
| 6. Ecosystem шаблон | MEDIUM | 1ч | Убирает забытые переменные |
| 7. Setup скрипт | LOW | 4ч | Полная автоматизация |

**Итого:** ~14 часов (2 рабочих дня)

---

*Создано: 2026-01-11*
*Статус: PLANNED*
*Ответственный: TBD*
