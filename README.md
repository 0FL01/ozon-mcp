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
- `browser_tabs` — список, создание, переключение вкладок

### Навигация
- `browser_navigate` — перейти по URL
- `browser_navigate_back` — назад в истории

### Контент
- `browser_snapshot` — получить текст страницы (accessibility tree)
- `browser_take_screenshot` — сделать скриншот
- `browser_extract_content` — извлечь контент как markdown
- `browser_console_messages` — логи консоли
- `browser_network_requests` — мониторинг сетевых запросов

### Взаимодействие
- `browser_click` — клик по элементу
- `browser_type` — ввод текста
- `browser_hover` — наведение курсора
- `browser_select_option` — выбор в dropdown
- `browser_fill_form` — заполнить несколько полей формы
- `browser_press_key` — нажатие клавиши
- `browser_drag` — drag and drop

### Продвинутые
- `browser_evaluate` — выполнить JavaScript
- `browser_handle_dialog` — обработка alert/confirm/prompt
- `browser_file_upload` — загрузка файлов
- `browser_window` — управление окном браузера
- `browser_pdf_save` — сохранить страницу как PDF

### Ozon-специфичные
- `ozon_search_and_parse` — поиск товаров на Ozon и парсинг результатов
- `ozon_parse_product_page` — извлечение данных со страницы товара
- `ozon_cart_action` — работа с корзиной (add/increment/decrement)
- `ozon_get_share_link` — получить чистую ссылку на товар (без UTM)

**Примечание:** Фильтры (brand, price, sort) временно недоступны из-за сложной архитектуры React + virtual scrolling на Ozon. Требуется прямое взаимодействие с React internals.

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
src/                         # MCP-сервер (Rust)
├── main.rs                  # Точка входа
├── lib.rs                   # Экспорт модулей
├── app.rs                   # Инициализация зависимостей
├── config.rs                # Конфиг (CLI + env)
├── extension_server.rs      # WebSocket bridge с extension
├── transport.rs             # Транспортный слой
├── unified_backend.rs       # Диспетчер MCP-инструментов
├── ozon_handler.rs          # Ozon-специфичная логика
├── tool_catalog.rs          # Реестр инструментов
├── tool_result.rs           # Модели результатов
└── file_logger.rs           # Логирование

extensions/chrome/           # Chrome расширение
├── manifest.json            # Manifest V3
└── src/
    ├── background-module.js # Service worker
    └── content-script.js    # Инъекция в страницу

selectors/
├── ozon-selectors.json      # CSS-селекторы для Ozon
└── README.md                # Документация по селекторам

target/release/ozon-mcp      # Собранный бинарник
```

---

## Технологии

- **Server:** Rust 2024, rmcp, tokio, tokio-tungstenite
- **Browser:** Chrome Extension (Manifest V3), Chrome DevTools Protocol
- **Protocol:** MCP (Model Context Protocol) через stdio
- **Communication:** WebSocket между сервером и расширением

---

## Лицензия

Apache License 2.0

Основано на [blueprint-mcp](https://github.com/railsblueprint/blueprint-mcp) от Rails Blueprint.
