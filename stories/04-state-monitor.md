# Story 4: Мониторинг состояния (State & Navigation Monitor)

## Контекст
LLM-агент выполняет действия (клики, навигация) и должен понимать, сработали ли они. Нужен механизм обратной связи: изменился ли счётчик корзины? Произошёл ли редирект? Открылась ли новая вкладка?

## Цель
Создать систему мониторинга состояния браузера для подтверждения успешности действий агента.

## Мониторируемые данные

### 1. Счётчик корзины
| Поле              | Тип       | Описание                                      |
|-------------------|-----------|-----------------------------------------------|
| `cartCount`       | number    | Количество товаров в корзине                  |
| `cartCountDelta`  | number    | Изменение с прошлой проверки (+1, -1, 0)      |

**Использование:** Главный сигнал успеха операции `add_to_cart`. Если `cartCountDelta == +1`, товар добавлен.

### 2. Навигация
| Поле              | Тип       | Описание                                      |
|-------------------|-----------|-----------------------------------------------|
| `currentUrl`      | string    | Текущий URL страницы                          |
| `urlChanged`      | boolean   | URL изменился с прошлой проверки?             |
| `previousUrl`     | string?   | Предыдущий URL                                |
| `isRedirect`      | boolean   | Это редирект (а не навигация)?                |

**Использование:** Определение редиректов на страницу логина или "вы бот".

### 3. Вкладки
| Поле              | Тип       | Описание                                      |
|-------------------|-----------|-----------------------------------------------|
| `tabsCount`       | number    | Количество открытых вкладок                   |
| `activeTabIndex`  | number    | Индекс активной вкладки                       |
| `activeTabTitle`  | string    | Заголовок активной вкладки                    |
| `newTabOpened`    | boolean   | Открылась новая вкладка?                      |

**Использование:** Товар может открыться в новой вкладке (`target="_blank"`), агент должен переключить фокус.

### 4. Модальные окна / Overlays
| Поле              | Тип       | Описание                                      |
|-------------------|-----------|-----------------------------------------------|
| `hasOverlay`      | boolean   | Есть ли блокирующий оверлей?                  |
| `overlayType`     | string?   | Тип: "city", "age", "promo", "login", "error" |
| `overlaySelector` | string?   | Селектор оверлея                              |
| `closeSelector`   | string?   | Селектор кнопки закрытия                      |

**Использование:** Оверлеи блокируют клики. Агент должен сначала закрыть popup.

### 5. Ошибки и блокировки
| Поле              | Тип       | Описание                                      |
|-------------------|-----------|-----------------------------------------------|
| `isBlocked`       | boolean   | Страница заблокировала бота?                  |
| `isCaptcha`       | boolean   | Показана капча?                               |
| `isLoginRequired` | boolean   | Требуется авторизация?                        |
| `errorMessage`    | string?   | Текст ошибки (если есть)                      |

## Задачи

### 1. Создать скрипт мониторинга
- [ ] Файл: `scripts/monitor/state.js`
- [ ] Функция: `getPageState()` — моментальный снимок состояния
- [ ] Функция: `compareState(prev, current)` — сравнение состояний

### 2. Мониторинг корзины
- [ ] Найти элемент счётчика в хедере
- [ ] Парсить число (может быть "99+" для переполнения)
- [ ] Сравнивать с предыдущим значением

### 3. Детекция оверлеев
- [ ] Список известных оверлеев и их селекторов
- [ ] Проверка `display: none` / `visibility: hidden`
- [ ] Определение типа оверлея по контенту

### 4. Детекция блокировок
- [ ] Обнаружение редиректа на страницу captcha
- [ ] Обнаружение сообщения "Подозрительная активность"
- [ ] Обнаружение требования логина

### 5. Интеграция
- [ ] Вызывать автоматически после каждого действия
- [ ] Возвращать diff состояний агенту

## Формат результата

```json
{
  "cart": {
    "count": 3,
    "delta": 1,
    "success": true
  },
  
  "navigation": {
    "url": "https://ozon.ru/product/123456789/",
    "urlChanged": false,
    "isRedirect": false
  },
  
  "tabs": {
    "count": 2,
    "activeIndex": 1,
    "activeTitle": "Наушники Sony - Ozon",
    "newTabOpened": true
  },
  
  "overlay": {
    "hasOverlay": true,
    "type": "city",
    "title": "Укажите город доставки",
    "closeSelector": "[data-widget='citySelector'] button.close"
  },
  
  "blocking": {
    "isBlocked": false,
    "isCaptcha": false,
    "isLoginRequired": false,
    "errorMessage": null
  },
  
  "timestamp": "2024-12-23T15:30:00Z"
}
```

## Интеграция с MCP

### Инструмент получения состояния
```javascript
{
  name: "ozon_get_state",
  description: "Получить текущее состояние страницы Ozon (корзина, оверлеи, блокировки)",
  inputSchema: { type: "object", properties: {} }
}
```

### Инструмент после действия
```javascript
{
  name: "ozon_verify_action",
  description: "Проверить результат последнего действия (добавление в корзину и т.д.)",
  inputSchema: {
    type: "object",
    properties: {
      expectedCartDelta: { type: "number", description: "Ожидаемое изменение корзины" }
    }
  }
}
```

## Логика агента

```
1. ozon_get_state() → сохранить как prevState
2. browser_click(addToCartSelector)
3. wait(500ms)
4. ozon_verify_action({ expectedCartDelta: 1 })
   → Если cart.delta == 1 → SUCCESS
   → Если overlay.hasOverlay → закрыть оверлей, повторить
   → Если blocking.isCaptcha → FAIL, уведомить пользователя
```

## Acceptance Criteria
- [ ] Корректно определяет изменение счётчика корзины
- [ ] Обнаруживает все типы оверлеев (город, возраст, реклама)
- [ ] Детектит блокировку бота (captcha, редирект)
- [ ] Работает в связке с действиями агента

## Обработка оверлеев (автоматическая)

```javascript
const overlayHandlers = {
  city: async () => {
    // Кликнуть "Москва" или первый город
    await browser_click('[data-widget="citySelector"] button:first-child')
  },
  age: async () => {
    // Кликнуть "Да, мне есть 18"
    await browser_click('[data-widget="ageConfirmation"] button.confirm')
  },
  promo: async () => {
    // Закрыть рекламный баннер
    await browser_click('.promo-banner .close')
  }
}
```

## Зависимости
- Story 1 (Stable Selectors)

## Оценка: 5 story points
