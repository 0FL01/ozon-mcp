# Project: Ozon MCP

MCP-сервер для автоматизации Chrome через расширение браузера. Использует реальный профиль браузера с сохранёнными сессиями, куками и расширениями для обхода защиты от ботов на Ozon.

**Tech Stack:**
- Language: Node.js ≥18
- Frameworks: MCP SDK (@modelcontextprotocol/sdk)
- Key Libs: ws (WebSocket), sharp (image processing), jsonpath-plus, image-size
- Browser: Chrome Extension (Manifest V3) with Chrome DevTools Protocol

## Branch
The default branch is `main`.

## 🏗 Project Structure

```
server/                      # MCP-сервер (Node.js)
├── index.js                 # Точка входа
├── package.json
└── src/
    ├── extensionServer.js   # WebSocket сервер (порт 5555)
    ├── transport.js         # Транспорт (DirectTransport для MCP)
    ├── unifiedBackend.js    # Реализация MCP-инструментов
    ├── ozonHandler.js       # Ozon-специфичная бизнес-логика
    └── fileLogger.js        # Логирование

extensions/chrome/           # Chrome расширение
├── manifest.json            # Manifest V3
├── src/
│   ├── background-module.js # Service worker (CDP команды)
│   ├── content-script.js    # Инъекция в страницу
│   └── stealth-inject.js    # Скрытие автоматизации
└── shared/                  # Shared модули
    ├── handlers/            # Обработчики (tabs, console, network, dialogs)
    ├── adapters/            # Browser adapters
    └── utils/               # Утилиты (logger, icons, jwt, etc.)

selectors/                   # CSS-селекторы для Ozon
└── ozon-selectors.json

scripts/                     # Скрипты сборки
└── build_prod.sh            # Сборка standalone бинарника
dist/                        # Собранный бинарник (ozon-mcp)
```

### Key Modules

- **extensionServer.js**: WebSocket сервер для связи с Chrome extension
- **unifiedBackend.js**: Реализация всех MCP-инструментов (browser_*, ozon_*)
- **ozonHandler.js**: Парсинг Ozon (поиск, товары, корзина)
- **background-module.js**: Chrome extension service worker с CDP
- **content-script.js**: Инъекция в страницу для выполнения скриптов

## 🛠 Architecture & Rules

### 1. Patterns
- **Client-Server через WebSocket**: Сервер (Node.js) ↔ Extension (Chrome) ↔ Browser
- **MCP Protocol**: stdio транспорт между AI и сервером
- **CDP (Chrome DevTools Protocol)**: Для управления вкладками, скриншотов, выполнения JS
- **Очередь команд**: Все CDP команды идут последовательно через queueCommand

### 2. Conventions
- **Error Handling**: Используйте try/catch, логируйте через fileLogger
- **Логирование**: DEBUG=true для подробных логов
- **Селекторы**: Вынесены в selectors/ozon-selectors.json
- **Бинарник**: Собирается через pkg (scripts/build_prod.sh)

### 3. Environment Variables
```bash
MCP_PORT=5555      # Порт WebSocket (по умолчанию 5555)
DEBUG=true         # Включить дебаг логи
```

### 4. Testing
- **Framework**: Jest
- **Config**: server/jest.config.js
- **Run**: npm test (в директории server)
