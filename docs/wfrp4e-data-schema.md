# Схема данных WFRP4e для куколки

Вытащено из исходников системы [moo-man/WFRP4e-FoundryVTT](https://github.com/moo-man/WFRP4e-FoundryVTT) (ветка master, версия 9.x, Foundry V13/V14).
Пути указаны относительно `src/` в репо системы.

## Надето / снято

Все надеваемые предметы наследуют `EquippableItemModel` (`model/item/components/equippable.js`).

| Что | Где |
|---|---|
| Флаг «надето» | `item.system.equipped.value` (boolean) |
| Удобный геттер | `item.system.isEquipped` |
| Можно ли надеть | `item.system.canEquip` |
| Надеваемый ли тип | `item.system.isEquippable` |
| Переключить | `item.system.toggleEquip()` или `item.update({"system.equipped.value": true})` |

Старые поля `worn` у брони, одежды и контейнеров устарели, вместо них `equipped.value`.

После смены `equipped` система сама запускает скрипты предмета (`equipToggle`), играет звук и пересчитывает статы.

## Броня (`model/item/armour.js`)

- `system.AP.{head, body, rArm, lArm, rLeg, lLeg}` - очки брони по локациям
- `system.APdamage.{...}` - повреждения по локациям
- `system.currentAP` - AP с учётом повреждений
- `system.protects.{loc}` - true, если предмет защищает локацию
- `system.armorType.value` - тип (`softLeather`, `mail`, `plate` и т.д.), подписи в `game.wfrp4e.config.armorTypes`
- `system.penalty.value` - штраф

Итоговая броня персонажа по локациям: `actor.system.status.armour[loc].value` (с учётом слоёв и щитов, см. `computeArmour()` в `model/actor/standard.js`).

## Оружие (`model/item/weapon.js`)

- `system.twohanded.value` - двуручное
- `system.offhand.value` - во второй руке
- `system.equipPoints` - сколько «рук» занимает (2 для двуручного, иначе 1)
- `system.usesHands` - какие локации рук заняты
- геттеры для отображения: `Damage`, `Reach`, `Range`, `WeaponGroup`, `isMelee`, `isRanged`

**Важно:** в `_preUpdate` при любой смене `system.equipped` система сбрасывает `offhand` в false.
Поэтому во вторую руку надеваем в два апдейта: сначала `equipped.value = true`, потом `offhand.value = true`.

Лимит экипированного оружия: настройка системы `limitEquippedWeapons`, максимум в `actor.system.settings.equipPoints`,
занято - `actor.system.equipPointsUsed`. При превышении система кидает ошибку и сама показывает уведомление.

Основная рука персонажа: `actor.mainArmLoc` / `actor.secondaryArmLoc` (зависит от `system.details.mainHand`).

## Одежда и контейнеры

- Снаряжение (`model/item/trapping.js`): надеть можно только если `system.trappingType.value === "clothingAccessories"`
- Контейнеры (`model/item/container.js`): надеваются всегда
- Вместимость контейнера: `system.carries.value` (в пунктах нагрузки), `system.countEnc.value`, `system.wearable.value`
- Предмет внутри контейнера: `system.location.value` = id контейнера
- Нагрузка: вещи с `location` система не считает напрямую (`computeItems` в `model/actor/standard.js`)
- Номер слота сумки в куколке хранится во флаге предмета: `flags["wfrp4e-paperdoll"].bagSlot` = `bag1 | bag2 | bag3`

## Общие поля физических предметов (`model/item/components/physical.js`)

- `system.quantity.value`
- `system.encumbrance.value`, итог `system.encumbrance.total` (надетая броня и одежда весят на 1 меньше)
- `system.price.{gc, ss, bp}`
- `system.availability.value` - `common | scarce | rare | exotic | special | None`
- `system.isPhysical`

Качества и изъяны (оружие, броня, снаряжение, боеприпасы): `system.Qualities`, `system.Flaws` - массивы готовых строк.

## Персонаж

- Характеристики: `actor.system.characteristics.{ws, bs, s, t, i, ag, dex, int, wp, fel}.value` и `.bonus`
- Подписи: `game.wfrp4e.config.characteristicsAbbrev`
- Раны: `actor.system.status.wounds.{value, max}`
- Нагрузка: `actor.system.status.encumbrance.{current, max}` (max = БС + БВ)
- Локации: `game.wfrp4e.config.locations`

## Листы и хуки

- Лист персонажа: `ActorSheetWFRP4eCharacter` → `StandardWFRP4eActorSheet` → `BaseWFRP4eActorSheet` → `WarhammerActorSheetV2` (AppV2)
- Кнопку в шапку вешаем через хук `renderActorSheetV2` (срабатывает для всех листов актёров на AppV2)
- Пункты меню шапки (`ApplicationHeaderControlsEntry`) не поддерживают `onClick`, только `action`, поэтому кнопка добавляется прямо в DOM шапки
