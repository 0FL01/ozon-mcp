# Ozon Selectors — Документация

> Карта стабильных CSS-селекторов для автоматизации Ozon

## Приоритет селекторов

| Приоритет | Тип | Описание |
|-----------|-----|----------|
| 1 | `data-widget="..."` | Самый стабильный — React-компоненты Ozon |
| 2 | `aria-label="..."` | Человекочитаемые метки |
| 3 | Иерархический путь | Виджет → дочерний элемент |

⚠️ **Избегайте**: классы типа `tsBody500Medium`, `x5y_23` — динамически генерируются CSS Modules

---

## ⚠️ Важные ограничения

> **nth-of-type селекторы**: Селекторы `nth-of-type(2)` и `nth-of-type(3)` не работают напрямую в `browser_interact`. Используйте `browser_evaluate` с `querySelectorAll('button')[index]`. Подробнее см. примеры ниже.

> **skuGridSimple**: Виджет `[data-widget='skuGridSimple']` используется **только на главной странице**. На странице поиска используйте `[data-widget='tileGridDesktop']`.

---

## Поиск

### Поисковая строка

```javascript
// Контейнер поиска
document.querySelector('[data-widget="searchBarDesktop"]')

// Input поиска
document.querySelector('[data-widget="searchBarDesktop"] input[name="text"]')

// Кнопка поиска
document.querySelector('[data-widget="searchBarDesktop"] button[aria-label="Поиск"]')
```

### Результаты поиска

```javascript
// Сетка товаров (страница поиска)
document.querySelector('[data-widget="tileGridDesktop"]')

// Сетка товаров (главная страница)
document.querySelector('[data-widget="skuGridSimple"]')

// Карточка товара
document.querySelector('[data-widget="tileGridDesktop"] a[href*="/product/"]')

// Пагинатор (бесконечный скролл)
document.querySelector('[data-widget="infiniteVirtualPaginator"]')
```

### Фильтры

```javascript
// Контейнер фильтров
document.querySelector('[data-widget="filtersDesktop"]')

// Активные фильтры
document.querySelector('[data-widget="searchResultsFiltersActive"]')

// Сортировка
document.querySelector('[data-widget="searchResultsSort"]')
```

---

## Карточка товара (PDP)

### Основные элементы

```javascript
// Заголовок товара
document.querySelector('[data-widget="webProductHeading"]')

// Галерея изображений
document.querySelector('[data-widget="webGallery"]')

// Блок цены
document.querySelector('[data-widget="webPrice"]')

// Текущая цена
document.querySelector('[data-widget="webPrice"] span.tsHeadline600Large')
```

### Добавление в корзину

```javascript
// Контейнер кнопки
document.querySelector('[data-widget="webAddToCart"]')

// Кнопка "Добавить в корзину" / "В корзине"
document.querySelector('[data-widget="webAddToCart"] button:first-of-type')

// Кнопка "минус" (уменьшить количество / удалить из корзины)
document.querySelector('[data-widget="webAddToCart"] button:nth-of-type(2)')

// Кнопка "плюс" (увеличить количество)  
document.querySelector('[data-widget="webAddToCart"] button:nth-of-type(3)')

// Счётчик количества
document.querySelector('[data-widget="webAddToCart"] span.pdp_af5')
```

⚠️ **Примечание**: 
- Кнопки +/- появляются только после добавления товара в корзину
- Кнопка "минус" при количестве = 1 **полностью удаляет** товар из корзины

### Характеристики и описание

```javascript
// Полные характеристики
document.querySelector('[data-widget="webCharacteristics"]')

// Краткие характеристики
document.querySelector('[data-widget="webShortCharacteristics"]')

// Описание
document.querySelector('[data-widget="webDescription"]')

// Вариации (размер, цвет)
document.querySelector('[data-widget="webDetailSKU"]')
```

### Отзывы

```javascript
// Рейтинг и количество отзывов
document.querySelector('[data-widget="webReviewProductScore"]')

// Вкладки отзывов
document.querySelector('[data-widget="webReviewTabs"]')

// Галерея фото из отзывов
document.querySelector('[data-widget="webReviewGallery"]')
```

---

## Хедер

```javascript
// Шапка сайта
document.querySelector('[data-widget="header"]')

// Кнопка каталога
document.querySelector('[data-widget="catalogMenu"]')

// Корзина
document.querySelector('[data-widget="headerIcon"] a[href="/cart"]')

// Избранное
document.querySelector('[data-widget="favoriteCounter"]')

// Заказы
document.querySelector('[data-widget="orderInfo"]')

// Профиль (неавторизованный)
document.querySelector('[data-widget="profileMenuAnonymous"]')

// Адрес доставки
document.querySelector('[data-widget="addressBookBarWeb"]')
```

---

## Модальные окна

```javascript
// Выбор города (кнопка открытия)
document.querySelector('[data-widget="addressBookBarWeb"] button')

// Подтверждение возраста
document.querySelector('[data-widget="ageConfirmation"]')

// Любой диалог
document.querySelector('[role="dialog"]')
```

---

## Использование с MCP

### Пример: поиск товара

```javascript
// browser_interact
{
  "actions": [
    { "type": "type", "selector": "[data-widget='searchBarDesktop'] input", "text": "iPhone 15" },
    { "type": "press_key", "key": "Enter" }
  ]
}
```

### Пример: добавление в корзину

```javascript
// browser_interact
{
  "actions": [
    { "type": "click", "selector": "[data-widget='webAddToCart'] button" }
  ]
}
```

### Пример: увеличение количества

```javascript
// browser_interact (после добавления товара)
{
  "actions": [
    { "type": "click", "selector": "[data-widget='webAddToCart'] button:nth-of-type(3)" }
  ]
}
```

⚠️ **Примечание**: Селектор `nth-of-type(3)` может не работать напрямую в `browser_interact`. Используйте альтернативный подход через `browser_evaluate`:

```javascript
// browser_evaluate - надежный способ увеличить количество
() => {
  const container = document.querySelector('[data-widget="webAddToCart"]');
  const buttons = container?.querySelectorAll('button') || [];
  if (buttons[2]) {
    buttons[2].click();
    return { success: true, action: 'increment' };
  }
  return { success: false, error: 'Increment button not found' };
}
```

### Пример: удаление товара из корзины

**Сценарий**: Когда количество товара = 1, нажатие на кнопку "минус" полностью удаляет товар из корзины.

**Поведение после удаления**:
- Кнопка меняется на "Добавить в корзину"
- Счетчик quantity (`span.pdp_af5`) исчезает
- Счетчик товаров в корзине (хедер) уменьшается
- Остается только 1 кнопка вместо 3

```javascript
// browser_evaluate - удаление товара из корзины (рекомендуется)
() => {
  const container = document.querySelector('[data-widget="webAddToCart"]');
  const quantitySpan = container?.querySelector('span.pdp_af5');
  const currentQuantity = parseInt(quantitySpan?.textContent || '0');
  
  if (currentQuantity === 1) {
    const buttons = container?.querySelectorAll('button') || [];
    if (buttons[1]) {
      buttons[1].click();
      return { 
        success: true, 
        action: 'remove_from_cart',
        previousQuantity: currentQuantity 
      };
    }
  }
  return { success: false, error: 'Cannot remove or quantity > 1' };
}
```

**Альтернативный способ** (может не работать):

```javascript
// browser_interact (при количестве = 1 товар полностью удаляется)
{
  "actions": [
    { "type": "click", "selector": "[data-widget='webAddToCart'] button:nth-of-type(2)" }
  ]
}
```


---

## Найденные виджеты

### Главная страница / Поиск
- `header` — шапка
- `searchBarDesktop` — поисковая строка
- `catalogMenu` — кнопка каталога
- `tileGridDesktop` — сетка товаров (поиск)
- `skuGridSimple` — сетка товаров (главная)
- `filtersDesktop` — фильтры
- `infiniteVirtualPaginator` — бесконечный скролл
- `headerIcon` — иконки хедера (корзина)
- `favoriteCounter` — избранное
- `orderInfo` — заказы
- `addressBookBarWeb` — адрес доставки

### Страница товара (PDP)
- `webProductHeading` — заголовок
- `webGallery` — галерея
- `webPrice` — цена
- `webAddToCart` — добавление в корзину
- `webAddToFavorite` — добавление в избранное
- `webCharacteristics` — характеристики
- `webShortCharacteristics` — краткие характеристики
- `webDescription` — описание
- `webDetailSKU` — артикул/варианты
- `webReviewProductScore` — рейтинг
- `webBrand` — бренд
- `breadCrumbs` — хлебные крошки
