# Ozon MCP

> Управление реальным браузером через Model Context Protocol для автоматизации Ozon

## Что это?

MCP-сервер для автоматизации Chrome через расширение браузера. Использует реальный профиль браузера с сохранёнными сессиями, куками и расширениями. Идеально для работы с Ozon - обходит защиту от ботов.

### Преимущества vs Playwright/Puppeteer

| Ozon MCP | Playwright |
|----------|------------|
| ✅ Реальный браузер | ❌ Headless |
| ✅ Сохранённые сессии | ❌ Новая сессия каждый раз |
| ✅ Обходит защиту | ⚠️ Детектится как бот |
| ✅ Расширения работают | ❌ Без расширений |

---

## Установка

### 1. Сборка бинарника (Rust)

```bash
# Клонировать репозиторий
git clone <repo-url>
cd ozon-mcp

# Собрать release версию
cargo build --release

# Бинарный файл будет доступен по пути:
# ./target/release/ozon-mcp
```

### 2. Загрузить расширение в Chrome

Папка `extensions/chrome` — это и есть готовое расширение (в распакованном виде). Ничего архивировать или собирать не нужно.

1. Откройте в браузере страницу управления расширениями: `chrome://extensions`
2. Включите **"Режим разработчика"** (Developer mode) в правом верхнем углу.
3. Нажмите кнопку **"Загрузить распакованное"** (Load unpacked).
4. В диалоговом окне выберите папку:
   `.../ozon-mcp/extensions/chrome`
   *(Эта папка содержит файл `manifest.json`)*

### 3. Запуск

```bash
# Обычный режим
./target/release/ozon-mcp

# Дебаг режим (рекомендуется для разработки)
DEBUG=true ./target/release/ozon-mcp

# На другом порту
MCP_PORT=8080 ./target/release/ozon-mcp
```

---

## Подключение к IDE

### OpenCode (рекомендуется)

Создайте файл `opencode.jsonc` в корне проекта:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "ozon-mcp": {
      "type": "local",
      "command": [
        "./target/release/ozon-mcp"
      ],
      "enabled": true
    }
  }
}
```

**Примечания:**
- Путь `./target/release/ozon-mcp` относительно корня проекта
- Убедитесь, что бинарник собран (`cargo build --release`)
- При изменении кода необходим реинит MCP (перезапуск IDE/агента)

### VS Code / Cursor

Добавить в `.vscode/mcp.json` или `.cursor/mcp.json`:

```json
{
  "servers": {
    "ozon-mcp": {
      "command": "/absolute/path/to/ozon-mcp/target/release/ozon-mcp",
      "args": []
    }
  }
}
```

### Claude Desktop

Добавить в `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ozon-mcp": {
      "command": "/absolute/path/to/ozon-mcp/target/release/ozon-mcp",
      "args": [],
      "env": {
        "MCP_PORT": "5555",
        "DEBUG": "false"
      }
    }
  }
}
```

### Gemini CLI / Antigravity

Добавить в `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "ozon-mcp": {
      "command": "/absolute/path/to/ozon-mcp/target/release/ozon-mcp",
      "args": [],
      "env": {
        "MCP_PORT": "5555"
      }
    }
  }
}
```

---

## Архитектура

```
┌─────────────────────┐
│   AI (Claude/GPT)   │
└─────────┬───────────┘
          │ MCP Protocol (stdio)
          ↓
┌─────────────────────┐
│   ozon-mcp server   │  ← Rust + rmcp
└─────────┬───────────┘
          │ WebSocket (localhost:5555)
          ↓
┌─────────────────────┐
│  Chrome Extension   │  ← Chrome DevTools Protocol
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│   Браузер Chrome    │
│   (реальный профиль)│
└─────────────────────┘
```

---

## Доступные инструменты

### Вкладки
- `browser_tabs` — список (`list`), создание (`new`), переключение (`attach`), закрытие (`close`) вкладок. Поддержка режима `stealth`.

### Навигация
- `browser_navigate` — навигация: переход по URL (`url`), назад (`back`), вперед (`forward`), перезагрузка (`reload`)

### Взаимодействие
- `browser_interact` — универсальный инструмент для эмуляции действий пользователя:
  - `click` — клик по элементу
  - `type` — ввод текста
  - `clear` — очистка поля
  - `press_key` — нажатие клавиши (Enter, Tab, Escape, стрелки и др.)
  - `hover` — наведение курсора
  - `scroll_by` / `scroll_into_view` — прокрутка
  - `wait` — ожидание
  - Поддержка цепочек действий (`actions`) и обработки ошибок (`onError`)

### Контент
- `browser_snapshot` — получить текст страницы (accessibility tree)
- `browser_evaluate` — выполнить JavaScript в контексте страницы
- `browser_take_screenshot` — сделать скриншот (viewport или full page, PNG/JPEG)
- `browser_console_messages` — получить или очистить логи консоли браузера

### Диалоги
- `browser_handle_dialog` — принять или отклонить alert/confirm/prompt

### Ozon-специфичные
- `ozon_search_and_parse` — поиск товаров на Ozon и парсинг результатов
- `ozon_parse_product_page` — извлечение данных со страницы товара (с возможностью открытия из поиска)
- `ozon_cart_action` — работа с корзиной (add/increment/decrement)
- `ozon_get_share_link` — получить каноническую ссылку на товар
- `ozon_ownership_status` — проверка статуса эксклюзивного доступа к браузерному мосту

---

## Переменные окружения

```bash
MCP_PORT=5555      # Порт WebSocket (по умолчанию 5555)
DEBUG=true         # Включить дебаг логи
```

---

## Устранение неполадок

### Расширение не подключается
1. Проверить что сервер запущен (`./target/release/ozon-mcp`)
2. Кликнуть на иконку расширения - должен показать статус подключения
3. Перезагрузить расширение

### Порт 5555 занят
```bash
# Убить процесс на порту
lsof -ti:5555 | xargs kill -9

# Или использовать другой порт
MCP_PORT=8080 ./target/release/ozon-mcp
```

### После изменения кода инструмент не обновляется
**Важно:** После пересборки (`cargo build --release`) необходим **реинит MCP**.
- OpenCode: перезапустить IDE или перезагрузить окно
- Claude Desktop: полностью перезапустить приложение
- VS Code: перезапустить MCP сервер

---

## Структура проекта

```
src/                           # MCP-сервер (Rust)
├── main.rs                    # Точка входа Rust-бинарника
├── lib.rs                     # Экспорт модулей
├── app.rs                     # Инициализация зависимостей и lifecycle
├── config.rs                  # Конфиг (CLI + env)
├── extension_server.rs        # WebSocket bridge с extension
├── transport.rs               # Транспортный слой (DirectTransport)
├── unified_backend.rs         # Диспетчер MCP-инструментов
├── ozon_handler.rs            # Ozon-специфичная логика
├── browser_handler.rs         # Браузер-специфичные операции
├── ownership_arbiter.rs       # Управление exclusive access
├── tool_catalog.rs            # Реестр инструментов browser_* / ozon_*
├── tool_result.rs             # Модели результатов
└── file_logger.rs             # Логирование

extensions/chrome/             # Chrome расширение
├── manifest.json              # Manifest V3
├── package.json               # Зависимости npm
├── src/
│   ├── background-module.js   # Service worker (CDP команды)
│   ├── content-script.js      # Инъекция в страницу
│   └── stealth-inject.js      # Скрытие автоматизации
├── shared/
│   ├── adapters/browser.js    # Chrome API adapter
│   ├── connection/websocket.js # WebSocket клиент
│   ├── handlers/              # Обработчики CDP событий
│   │   ├── console.js
│   │   ├── dialogs.js
│   │   ├── network.js
│   │   └── tabs.js
│   ├── popup/                 # UI popup
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── utils/                 # Утилиты
│       ├── icons.js
│       ├── jwt.js
│       ├── logger.js
│       └── unwrap.js
├── public/                    # Статические страницы
├── icons/                     # Иконки расширения
├── _locales/                  # Локализации
└── tests/                     # Тесты расширения

selectors/                     # CSS-селекторы для Ozon
├── ozon-selectors.json
└── README.md

stories/                       # User stories
scripts/                       # Скрипты сборки
dist/                          # Собранный бинарник
```

---

## Архитектура и возможности

### Local Direct Transport
Ozon MCP работает в локальном режиме без облачного прокси:
- **WebSocket:** Локальный сервер на порту `5555` ожидает подключения расширения
- **Безопасность:** Куки и сессии никогда не покидают ваш компьютер
- **Stealth Mode:** Режим маскировки через параметр `stealth` при создании вкладки

## Технологии

- **Server:** Rust 2024 Edition, rmcp, tokio, tokio-tungstenite, futures-util
- **Browser:** Chrome Extension (Manifest V3), Chrome DevTools Protocol (CDP)
- **Protocol:** MCP (Model Context Protocol) через stdio транспорт
- **Communication:** WebSocket между сервером и расширением

---

## Лицензия

Apache License 2.0

Основано на [blueprint-mcp](https://github.com/railsblueprint/blueprint-mcp) от Rails Blueprint.
