# Project: Ozon MCP

MCP-сервер для автоматизации Chrome через расширение браузера. Использует реальный профиль браузера с сохранёнными сессиями, куками и расширениями для обхода защиты от ботов на Ozon.

**Tech Stack:**
- Server: Rust 2024
- Rust libs: rmcp, tokio, tokio-tungstenite, futures-util, clap, anyhow, serde, serde_json
- Browser: Chrome Extension (Manifest V3) with Chrome DevTools Protocol

## Branch
The default branch is `main`.

## 🏗 Project Structure

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
│   ├── form-result.html
│   ├── form-result.js
│   ├── login-success.html
│   ├── login-success.js
│   ├── test-iframes.html
│   └── test-side-effects.html
├── icons/                     # Иконки расширения
├── _locales/                  # Локализации
└── tests/
    └── extension.spec.ts

selectors/                     # CSS-селекторы для Ozon
├── ozon-selectors.json
└── README.md

docs/
└── ANTI_BOT_SOLUTIONS.md

stories/                       # User stories
├── 01-stable-selectors.md
├── 02-listing-data-extractor.md
├── 03-pdp-data-extractor.md
└── 04-state-monitor.md

scripts/                       # Скрипты сборки
└── build_prod.sh              # Сборка standalone бинарника

dist/                          # Собранный бинарник (ozon-mcp)
```

### Key Modules

- **extension_server.rs**: WebSocket bridge, single active extension connection, request/response correlation
- **unified_backend.rs**: Точка диспетчеризации MCP-инструментов (browser_* и ozon_*)
- **ozon_handler.rs**: Ozon-операции (поиск, карточка товара, корзина)
- **browser_handler.rs**: Браузер-специфичные операции
- **ownership_arbiter.rs**: Управление exclusive access
- **tool_catalog.rs**: Единый каталог инструментов для list_tools
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

### 3. Environment Variables
```bash
MCP_HOST=127.0.0.1 # Хост WebSocket (Rust server)
MCP_PORT=5555      # Порт WebSocket (по умолчанию 5555)
DEBUG=true         # Включить дебаг логи
```

### 4. Testing
- **Rust checks**: `cargo fmt --all -- --check`, `cargo check`, `cargo clippy --all-targets -- -D warnings`
- **Rust tests**: `cargo test`
