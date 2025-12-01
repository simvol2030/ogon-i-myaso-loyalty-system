# Git Workflow - Murzicoin Loyalty System

> **Версия:** 1.0
> **Дата:** 2025-12-01
> **Автор:** Claude Code

Этот документ описывает **правильный** Git Workflow для разработки и деплоя проекта `murzicoin.murzico.ru`.

---

## 🎯 ГЛАВНОЕ ПРАВИЛО

**Единственный источник правды:** GitHub, ветка `main`

**Production deployment:** ТОЛЬКО из ветки `main` на GitHub

---

## 📊 СТРУКТУРА ВЕТОК

```
main (production)           ← Deployment source of truth
  ↑
  merge (after testing!)
  ↑
dev (development)           ← Daily work
  ↑
  feature/* (optional)      ← Feature branches
```

### Ветки и их назначение:

| Ветка | Назначение | Кто использует |
|-------|------------|----------------|
| `main` | Production-ready код | Deployment script |
| `dev` | Ежедневная разработка | Developers |
| `feature/*` | Отдельные фичи (опционально) | Developers |

---

## 🔄 РАБОЧИЙ ПРОЦЕСС

### 1. **Ежедневная работа (в ветке dev)**

```bash
# 1. Убедись, что ты на ветке dev
git checkout dev
git pull origin dev

# 2. Делай изменения в коде
# Edit files...

# 3. Проверь код локально
npm run check          # TypeScript проверка
npm run dev            # Тестируй в браузере

# 4. Коммит и пуш
git add .
git commit -m "feat: add new feature"
git push origin dev
```

### 2. **Готов к production? Merge в main**

```bash
# 1. Убедись, что dev работает
git checkout dev
npm run check          # 0 errors
npm run build          # Build successful

# 2. Переключись на main
git checkout main
git pull origin main

# 3. Merge dev в main
git merge dev

# 4. Push main на GitHub
git push origin main
```

### 3. **Deployment на сервер (из main)**

```bash
# На СЕРВЕРЕ (через SSH):
ssh webmaster@46.8.19.26

# Запусти deploy скрипт
cd /opt/websites/murzicoin.murzico.ru
bash deploy.sh
```

**deploy.sh делает:**
1. `git pull origin main` (берёт код С GITHUB!)
2. `npm install` (frontend + backend)
3. `npm run build` (frontend + backend)
4. `pm2 restart` (перезапуск процессов)

---

## ✅ ЧЕКЛИСТ ПЕРЕД MERGE В MAIN

Перед `git merge dev` в `main`, проверь:

- [ ] `npm run check` - **0 errors**
- [ ] `npm run dev` - всё работает локально
- [ ] Никаких `console.log()` в production коде
- [ ] Никаких `localhost:3000` в коде
- [ ] ecosystem.config.js обновлён (если нужно)
- [ ] Все зависимости установлены

---

## 🚨 ЧТО **НЕ НУЖНО** ДЕЛАТЬ

❌ **НЕ деплоить из dev ветки**
```bash
# ❌ НЕПРАВИЛЬНО!
git checkout dev
bash deploy.sh  # Деплоит не ту ветку!
```

❌ **НЕ использовать локальный build**
```bash
# ❌ НЕПРАВИЛЬНО!
npm run build
scp build/* server:/opt/websites/.../
```

❌ **НЕ коммитить deploy скрипты в Git**
```bash
# ❌ deploy.sh должен лежать ТОЛЬКО на сервере!
```

❌ **НЕ забывать git push**
```bash
# ❌ НЕПРАВИЛЬНО!
git commit -m "fix: something"
bash deploy.sh  # Деплоит старую версию с GitHub!
```

---

## 📋 ПРИМЕРЫ СЦЕНАРИЕВ

### Сценарий 1: Обычный feature

```bash
# Локально
git checkout dev
# Edit code...
git add .
git commit -m "feat: add product search"
git push origin dev

# Тестируем локально
npm run dev
# Проверяем в браузере

# Готово? Merge в main
git checkout main
git merge dev
git push origin main

# На сервере
ssh webmaster@46.8.19.26
cd /opt/websites/murzicoin.murzico.ru
bash deploy.sh
```

### Сценарий 2: Экстренный bugfix

```bash
# Локально (можно работать прямо в main)
git checkout main
git pull origin main

# Fix bug...
git add .
git commit -m "fix: cashier localhost:3000 issue"
git push origin main

# На сервере (сразу деплоим)
ssh webmaster@46.8.19.26
cd /opt/websites/murzicoin.murzico.ru
bash deploy.sh

# После деплоя - merge в dev тоже
git checkout dev
git merge main
git push origin dev
```

### Сценарий 3: Большая фича (с feature branch)

```bash
# Создаём feature branch от dev
git checkout dev
git checkout -b feature/cashback-tiers

# Работаем...
git add .
git commit -m "feat: implement tier system"
git push origin feature/cashback-tiers

# Готово? Merge в dev
git checkout dev
git merge feature/cashback-tiers
git push origin dev

# Тестируем dev → потом merge в main
git checkout main
git merge dev
git push origin main

# Деплой
ssh webmaster@46.8.19.26
cd /opt/websites/murzicoin.murzico.ru
bash deploy.sh
```

---

## 🛠️ TROUBLESHOOTING

### Проблема: Deploy не видит мои изменения

**Причина:** Забыл `git push origin main`

**Решение:**
```bash
# Проверь, что изменения на GitHub
git log origin/main..HEAD
# Если есть коммиты - запуш их
git push origin main
```

### Проблема: Конфликт при merge

**Причина:** dev и main разошлись

**Решение:**
```bash
git checkout main
git pull origin main
git merge dev
# Если конфликт - реши его вручную
git add .
git commit -m "merge: resolve conflicts"
git push origin main
```

### Проблема: Deploy упал

**Причина:** Ошибка в коде или конфигурации

**Решение:**
```bash
# На сервере проверь логи
pm2 logs murzicoin-frontend
pm2 logs murzicoin-backend

# Если нужно - rollback
git reset --hard HEAD~1
git push --force origin main  # ТОЛЬКО для экстренных случаев!
bash deploy.sh
```

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

- `DEPLOYMENT-CHECKLIST.md` - Проверки перед деплоем
- `GIT-BASED-DEPLOYMENT-WORKFLOW-v2.md` - Детали Git-based деплоя
- `docs/TROUBLESHOOTING-SESSION-PM2.md` - PM2 и env переменные

---

## 🎉 ИТОГО: ПРАВИЛЬНАЯ СХЕМА

```
┌─────────────┐
│   Локально  │
│   (ветка dev)│
└──────┬──────┘
       │ git add + commit + push
       ↓
┌──────────────┐
│   GitHub     │
│   (dev)      │
└──────┬───────┘
       │ Тестирование OK?
       │ git merge dev → main
       ↓
┌──────────────┐
│   GitHub     │
│   (main)     │  ← Единственный источник правды!
└──────┬───────┘
       │ git push origin main
       ↓
┌──────────────┐
│   Сервер     │
│   bash       │
│   deploy.sh  │
└──────┬───────┘
       │ git pull origin main
       │ npm install
       │ npm run build
       │ pm2 restart
       ↓
┌──────────────┐
│  Production  │
│  https://    │
│  murzicoin   │
└──────────────┘
```

**Главное:** Всегда `git push origin main` → потом `bash deploy.sh` на сервере!

---

**Дата последнего обновления:** 2025-12-01
**Версия:** 1.0
