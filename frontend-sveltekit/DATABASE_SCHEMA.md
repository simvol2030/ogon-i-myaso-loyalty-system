# 🗄️ Database Schema - Loyalty System

Полная схема базы данных для миграции с Pseudo API на реальную БД.

## 📋 Общая архитектура

- **ORM**: Рекомендуется Prisma или Drizzle ORM
- **База данных**: PostgreSQL или MySQL
- **Миграции**: Автоматические через ORM
- **Индексы**: Добавлены для оптимизации запросов

---

## 🔑 Основные таблицы

### 1. `users` - Пользователи системы лояльности

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  card_number VARCHAR(20) UNIQUE NOT NULL,
  current_balance DECIMAL(10, 2) DEFAULT 0.00,
  total_purchases INT DEFAULT 0,
  total_saved DECIMAL(10, 2) DEFAULT 0.00,
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_card ON users(card_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
```

**Связь с JSON**: `user.json`

---

### 2. `products` - Каталог товаров

```sql
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  old_price DECIMAL(10, 2),
  image VARCHAR(500),
  category_id INT,
  stock_quantity INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  popularity_score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_popularity ON products(popularity_score DESC);
CREATE INDEX idx_products_slug ON products(slug);
```

**Связь с JSON**: `products.json`

---

### 3. `categories` - Категории товаров

```sql
CREATE TABLE categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  parent_id INT,
  description TEXT,
  icon VARCHAR(50),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_order ON categories(display_order);
```

**Связь с JSON**: Поле `category` в `products.json`

---

### 4. `offers` - Акции и специальные предложения

```sql
CREATE TABLE offers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  details TEXT,
  conditions JSON, -- Array of strings
  icon VARCHAR(10),
  icon_color VARCHAR(50),
  deadline VARCHAR(100),
  deadline_class VARCHAR(50),
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_offers_active ON offers(is_active);
CREATE INDEX idx_offers_dates ON offers(start_date, end_date);
CREATE INDEX idx_offers_order ON offers(display_order);
```

**Связь с JSON**: `offers.json`

---

### 5. `stores` - Магазины сети

```sql
CREATE TABLE stores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  hours VARCHAR(255),
  features JSON, -- Array of strings: ["Парковка", "Ветеринар", ...]
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  icon_color VARCHAR(50),
  is_closed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_stores_location ON stores(latitude, longitude);
CREATE INDEX idx_stores_city ON stores(city);
CREATE INDEX idx_stores_active ON stores(is_active, is_closed);
```

**Связь с JSON**: `stores.json`

---

### 6. `transactions` - История операций (начисление/списание баллов)

```sql
CREATE TABLE transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  store_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL, -- Positive for earn, negative for spend
  type ENUM('earn', 'spend') NOT NULL,
  spent_money DECIMAL(10, 2), -- Actual money spent (if applicable)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_store ON transactions(store_id);
```

**Связь с JSON**: `history.json`

**Важная бизнес-логика**:
```sql
-- Trigger для обновления баланса пользователя
CREATE TRIGGER update_user_balance
AFTER INSERT ON transactions
FOR EACH ROW
BEGIN
  UPDATE users
  SET current_balance = current_balance + NEW.amount
  WHERE id = NEW.user_id;
END;
```

---

### 7. `recommendations` - Персональные рекомендации товаров

```sql
CREATE TABLE recommendations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  product_id INT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  image VARCHAR(500),
  recommendation_reason TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_recommendations_user ON recommendations(user_id);
CREATE INDEX idx_recommendations_product ON recommendations(product_id);
CREATE INDEX idx_recommendations_order ON recommendations(display_order);
```

**Связь с JSON**: `recommendations.json`

---

### 8. `loyalty_rules` - Правила программы лояльности

```sql
CREATE TABLE loyalty_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rule_type VARCHAR(50) NOT NULL, -- 'earning', 'payment', 'expiry'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  value VARCHAR(100),
  icon VARCHAR(10),
  percentage DECIMAL(5, 2), -- e.g., 4.00 for 4%
  max_usage_percentage DECIMAL(5, 2), -- e.g., 20.00 for 20%
  expiry_days INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_loyalty_rules_type ON loyalty_rules(rule_type);
CREATE INDEX idx_loyalty_rules_active ON loyalty_rules(is_active);
```

**Связь с JSON**: `loyalty-rules.json`, `loyalty-rules-detailed.json`

---

### 9. `profile_menu_items` - Пункты меню профиля

```sql
CREATE TABLE profile_menu_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  icon VARCHAR(50),
  action_type VARCHAR(50) NOT NULL, -- 'modal', 'page', 'external'
  action_value VARCHAR(255),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_profile_menu_order ON profile_menu_items(display_order);
CREATE INDEX idx_profile_menu_active ON profile_menu_items(is_active);
```

**Связь с JSON**: `profile-menu.json`

---

## 🔗 Связанные таблицы (Many-to-Many)

### 10. `offer_products` - Связь акций и товаров

```sql
CREATE TABLE offer_products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  offer_id INT NOT NULL,
  product_id INT NOT NULL,
  discount_percentage DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_offer_product (offer_id, product_id)
);

CREATE INDEX idx_offer_products_offer ON offer_products(offer_id);
CREATE INDEX idx_offer_products_product ON offer_products(product_id);
```

---

## 📊 Представления (Views) для частых запросов

### View: `user_statistics`

```sql
CREATE VIEW user_statistics AS
SELECT
  u.id,
  u.name,
  u.card_number,
  u.current_balance,
  COUNT(DISTINCT t.id) as total_transactions,
  SUM(CASE WHEN t.type = 'earn' THEN t.amount ELSE 0 END) as total_earned,
  SUM(CASE WHEN t.type = 'spend' THEN ABS(t.amount) ELSE 0 END) as total_spent,
  MAX(t.created_at) as last_transaction_date
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id
GROUP BY u.id, u.name, u.card_number, u.current_balance;
```

### View: `active_offers`

```sql
CREATE VIEW active_offers AS
SELECT *
FROM offers
WHERE is_active = TRUE
  AND (start_date IS NULL OR start_date <= CURDATE())
  AND (end_date IS NULL OR end_date >= CURDATE())
ORDER BY display_order, created_at DESC;
```

---

## 🚀 Миграция с Pseudo API на БД

### Этап 1: Создание ORM модели (Prisma пример)

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id               Int            @id @default(autoincrement())
  name             String
  cardNumber       String         @unique @map("card_number")
  currentBalance   Decimal        @default(0.00) @map("current_balance") @db.Decimal(10, 2)
  totalPurchases   Int            @default(0) @map("total_purchases")
  totalSaved       Decimal        @default(0.00) @map("total_saved") @db.Decimal(10, 2)
  transactions     Transaction[]
  recommendations  Recommendation[]
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")

  @@map("users")
}

model Transaction {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  storeId     Int?      @map("store_id")
  title       String
  amount      Decimal   @db.Decimal(10, 2)
  type        TransactionType
  spentMoney  Decimal?  @map("spent_money") @db.Decimal(10, 2)
  createdAt   DateTime  @default(now()) @map("created_at")

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  store       Store?    @relation(fields: [storeId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt(sort: Desc)])
  @@map("transactions")
}

enum TransactionType {
  earn
  spend
}

// ... остальные модели
```

### Этап 2: Изменение в `+page.server.ts` файлах

**До (Pseudo API)**:
```typescript
const offersPath = join(process.cwd(), 'src/lib/data/loyalty/offers.json');
const offers = JSON.parse(readFileSync(offersPath, 'utf-8'));
```

**После (Database)**:
```typescript
import { prisma } from '$lib/server/prisma';

const offers = await prisma.offer.findMany({
  where: { isActive: true },
  orderBy: { displayOrder: 'asc' }
});
```

### Этап 3: Seed данные из JSON в БД

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  // Seed users
  const usersData = JSON.parse(
    readFileSync(join(__dirname, '../src/lib/data/loyalty/user.json'), 'utf-8')
  );
  await prisma.user.create({ data: usersData });

  // Seed offers
  const offersData = JSON.parse(
    readFileSync(join(__dirname, '../src/lib/data/loyalty/offers.json'), 'utf-8')
  );
  await prisma.offer.createMany({ data: offersData });

  // ... остальные таблицы
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

---

## ✅ Чек-лист миграции

- [ ] Установить Prisma/Drizzle ORM
- [ ] Создать схему БД на основе этого документа
- [ ] Запустить миграции: `npx prisma migrate dev`
- [ ] Seed данные из JSON: `npx prisma db seed`
- [ ] Обновить все `+page.server.ts` файлы
- [ ] Добавить индексы для оптимизации
- [ ] Настроить connection pooling
- [ ] Добавить error handling
- [ ] Тестирование всех страниц
- [ ] Удалить JSON файлы

---

## 📈 Оптимизации для продакшена

1. **Connection Pooling**: Настроить пул соединений (рекомендуется 10-20 соединений)
2. **Caching**: Использовать Redis для кеширования частых запросов
3. **Pagination**: Добавить cursor-based pagination для больших списков
4. **Read Replicas**: Настроить read replicas для масштабирования чтения
5. **Query Optimization**: Использовать EXPLAIN ANALYZE для оптимизации запросов

---

**Версия документа**: 1.0
**Дата**: 2025-10-23
**Статус**: Ready for implementation
