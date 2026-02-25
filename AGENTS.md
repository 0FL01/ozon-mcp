# Project: Ozon MCP

MCP-сервер для автоматизации Chrome через расширение браузера. Использует реальный профиль браузера с сохранёнными сессиями, куками и расширениями для обхода защиты от ботов на Ozon.

Текущий этап: сервер мигрируется с Node.js на Rust итеративно, с целью полного паритета инструментов.

**Tech Stack:**
- Server (target): Rust 2024
- Rust libs: rmcp, tokio, tokio-tungstenite, futures-util, clap, anyhow, serde, serde_json
- Legacy server (reference for parity): Node.js >=18, @modelcontextprotocol/sdk, ws, sharp, jsonpath-plus, image-size
- Browser: Chrome Extension (Manifest V3) with Chrome DevTools Protocol

## Branch
The default branch is `main`.

## 🏗 Project Structure

```
src/                         # MCP-сервер (Rust, текущая реализация)
├── main.rs                  # Точка входа Rust-бинарника
├── lib.rs                   # Экспорт модулей
├── app.rs                   # Инициализация зависимостей и lifecycle
├── config.rs                # Конфиг (CLI + env)
├── extension_server.rs      # WebSocket bridge с extension (Slice 2)
├── transport.rs             # Транспортный слой (DirectTransport)
├── unified_backend.rs       # Диспетчер MCP-инструментов
├── ozon_handler.rs          # Ozon-специфичная логика (в процессе переноса)
├── tool_catalog.rs          # Реестр инструментов browser_* / ozon_*
├── tool_result.rs           # Модели результатов вызова инструментов
└── file_logger.rs           # Логирование

server/                      # Legacy MCP-сервер (Node.js, источник паритета)
├── index.js                 # Точка входа
├── package.json
└── src/
    ├── extensionServer.js   # WebSocket сервер (эталонная логика)
    ├── transport.js         # Транспорт
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

docs/
├── RUST_MIGRATION_PLAN.md   # План миграции JS -> Rust по слайсам
└── ANTI_BOT_SOLUTIONS.md

scripts/                     # Скрипты сборки
└── build_prod.sh            # Сборка standalone бинарника
dist/                        # Собранный бинарник (ozon-mcp)
```

### Key Modules

- **extension_server.rs**: WebSocket bridge, single active extension connection, request/response correlation
- **unified_backend.rs**: Точка диспетчеризации MCP-инструментов (browser_* и ozon_*)
- **ozon_handler.rs**: Ozon-операции (поиск, карточка товара, корзина) в процессе переноса
- **tool_catalog.rs**: Единый каталог инструментов для list_tools и контроля паритета
- **server/src/unifiedBackend.js**: Эталонный legacy-источник поведения при переносе
- **background-module.js**: Chrome extension service worker с CDP
- **content-script.js**: Инъекция в страницу для выполнения скриптов

## 🛠 Architecture & Rules

### 1. Patterns
- **Client-Server через WebSocket**: Сервер (Rust) ↔ Extension (Chrome) ↔ Browser
- **MCP Protocol**: stdio транспорт между AI и сервером (rmcp)
- **CDP (Chrome DevTools Protocol)**: Для управления вкладками, скриншотов, выполнения JS
- **Очередь команд**: Команды extension выполняются последовательно через bridge/queue

### 2. Conventions
- **Error Handling (Rust)**: Используйте `anyhow::Result`, без `unwrap/expect` в runtime-путях
- **Логирование**: DEBUG=true для подробных логов
- **Селекторы**: Вынесены в selectors/ozon-selectors.json
- **Паритет инструментов**: Имена инструментов синхронизируются через `src/tool_catalog.rs`
- **Legacy reference**: До полного паритета поведение сверяется с `server/src/*.js`

### 3. Environment Variables
```bash
MCP_HOST=127.0.0.1 # Хост WebSocket (Rust server)
MCP_PORT=5555      # Порт WebSocket (по умолчанию 5555)
DEBUG=true         # Включить дебаг логи
```

### 4. Testing
- **Rust checks**: `cargo fmt --all -- --check`, `cargo check`, `cargo clippy --all-targets -- -D warnings`
- **Rust tests**: `cargo test`
- **Legacy tests**: `npm test` (в директории `server`) для сверки паритета при миграции
