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

### 1. Установить сервер

```bash
cd server
npm install
```

### 2. Загрузить расширение в Chrome

1. Открыть `chrome://extensions`
2. Включить "Режим разработчика" (Developer mode)
3. Нажать "Загрузить распакованное" (Load unpacked)
4. Выбрать папку `extensions/chrome`

### 3. Запуск

```bash
# Обычный режим
node server/index.js

# Дебаг режим (рекомендуется для разработки)
DEBUG=true node server/index.js
```

---

## Подключение к IDE

### VS Code / Cursor

Добавить в `.vscode/mcp.json` или `.cursor/mcp.json`:

```json
{
  "servers": {
    "ozon-mcp": {
      "command": "node",
      "args": ["/home/stfu/ai/mcp/ozon-mcp/blueprint-mcp/server/index.js"]
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
      "command": "node",
      "args": ["/home/stfu/ai/mcp/ozon-mcp/blueprint-mcp/server/index.js"]
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
      "command": "node",
      "args": ["/home/stfu/ai/mcp/ozon-mcp/blueprint-mcp/server/index.js"]
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
│   ozon-mcp server   │  ← Node.js
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

---

## Переменные окружения

```bash
MCP_PORT=5555      # Порт WebSocket (по умолчанию 5555)
DEBUG=true         # Включить дебаг логи
```

---

## Устранение неполадок

### Расширение не подключается
1. Проверить что сервер запущен (`node server/index.js`)
2. Кликнуть на иконку расширения - должен показать статус подключения
3. Перезагрузить расширение

### Порт 5555 занят
```bash
# Убить процесс на порту
lsof -ti:5555 | xargs kill -9

# Или использовать другой порт
MCP_PORT=8080 node server/index.js
```

---

## Структура проекта

```
server/
├── index.js              # Точка входа
├── package.json
└── src/
    ├── extensionServer.js # WebSocket сервер
    ├── transport.js       # Транспорт (DirectTransport)
    ├── unifiedBackend.js  # Реализация MCP-инструментов
    └── fileLogger.js      # Логирование

extensions/chrome/
├── manifest.json
└── src/
    ├── background-module.js  # Service worker (CDP команды)
    └── content-script.js     # Инъекция в страницу
```

---

## Лицензия

Apache License 2.0

Основано на [blueprint-mcp](https://github.com/railsblueprint/blueprint-mcp) от Rails Blueprint.
