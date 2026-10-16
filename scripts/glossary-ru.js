/**
 * Словарь игровых терминов EN -> RU по русской книге правил WFRP 4e.
 * Названия из компендиумов wfrp4e-core приходят на английском - здесь их книжные русские имена.
 * Специализация в скобках переводится отдельно: «Melee (Basic)» -> «Рукопашный бой (основное)».
 * Чего нет в словаре, остаётся как есть.
 */
export const GLOSSARY_RU = {
  // Характеристики
  "Weapon Skill": "Ближний бой",
  "Ballistic Skill": "Дальний бой",
  "Strength": "Сила",
  "Toughness": "Выносливость",
  "Initiative": "Инициатива",
  "Agility": "Проворство",
  "Dexterity": "Ловкость",
  "Intelligence": "Интеллект",
  "Willpower": "Сила воли",
  "Fellowship": "Харизма",

  // Общие навыки
  "Art": "Искусство",
  "Athletics": "Атлетика",
  "Bribery": "Подкуп",
  "Charm": "Обаяние",
  "Charm Animal": "Усмирение животных",
  "Climb": "Лазание",
  "Cool": "Хладнокровие",
  "Consume Alcohol": "Кутёж",
  "Dodge": "Уклонение",
  "Drive": "Вождение",
  "Endurance": "Стойкость",
  "Entertain": "Артистизм",
  "Gamble": "Азартные игры",
  "Gossip": "Сплетничество",
  "Haggle": "Торговля",
  "Intimidate": "Запугивание",
  "Intuition": "Интуиция",
  "Leadership": "Лидерство",
  "Melee": "Рукопашный бой",
  "Navigation": "Ориентирование",
  "Outdoor Survival": "Выживание",
  "Perception": "Наблюдательность",
  "Ride": "Верховая езда",
  "Row": "Гребля",
  "Stealth": "Скрытность",

  // Профессиональные навыки
  "Animal Care": "Обращение с животными",
  "Animal Training": "Дрессировка",
  "Channelling": "Концентрация",
  "Evaluate": "Оценка",
  "Heal": "Лечение",
  "Language": "Язык",
  "Lore": "Знание",
  "Perform": "Сценическое искусство",
  "Pick Lock": "Взлом",
  "Play": "Музицирование",
  "Pray": "Молитвословие",
  "Ranged": "Стрельба",
  "Research": "Книжные изыскания",
  "Sail": "Хождение под парусом",
  "Secret Signs": "Тайные знаки",
  "Set Trap": "Обращение с ловушками",
  "Sleight of Hand": "Ловкость рук",
  "Swim": "Плавание",
  "Track": "Выслеживание",
  "Trade": "Ремесло",

  // Таланты (из таблицы случайных талантов и самые частые)
  "Acute Sense": "Обострённое восприятие",
  "Animal Affinity": "Сродство с животными",
  "Artistic": "Искусник",
  "Attractive": "Привлекательность",
  "Coolheaded": "Самообладание",
  "Craftsman": "Умелец",
  "Flee!": "Поспешное бегство",
  "Hardy": "Закалка",
  "Lightning Reflexes": "Молниеносная реакция",
  "Linguistics": "Полиглот",
  "Luck": "Фортуна",
  "Marksman": "Меткость",
  "Mimic": "Имитатор",
  "Night Vision": "Сумеречное зрение",
  "Nimble Fingered": "Ловкие пальцы",
  "Noble Blood": "Благородная кровь",
  "Orientation": "Чувство направления",
  "Perfect Pitch": "Абсолютный слух",
  "Pure Soul": "Духовная чистота",
  "Read/Write": "Грамотность",
  "Resistance": "Устойчивость",
  "Sixth Sense": "Шестое чувство",
  "Strong Legs": "Сильные ноги",
  "Suave": "Учтивость",
  "Very Resilient": "Здоровяк",
  "Warrior Born": "Прирождённый воин",
  "Strike Mighty Blow": "Могучий удар",
  "Arcane Magic": "Школа магии",
  "Petty Magic": "Простая магия",
  "Bless": "Благословение",
  "Invoke": "Воззвание",
  "Strike to Stun": "Ошеломляющий удар",
  "Frenzy": "Ярость",

  // Состояния
  "Ablaze": "Горение",
  "Bleeding": "Кровотечение",
  "Blinded": "Ослепление",
  "Broken": "Паника",
  "Deafened": "Оглушение",
  "Entangled": "Обездвиживание",
  "Fatigued": "Усталость",
  "Poisoned": "Отравление",
  "Prone": "Сбит с ног",
  "Stunned": "Ошеломление",
  "Surprised": "Застигнут врасплох",
  "Unconscious": "Без сознания",

  // Народы
  "Human": "Человек",
  "Dwarf": "Гном",
  "Halfling": "Полурослик",
  "High Elf": "Высший эльф",
  "Wood Elf": "Лесной эльф",

  // Сословия
  "Brass": "Медь",
  "Silver": "Серебро",
  "Gold": "Золото"
};

/** Специализации в скобках */
export const SPEC_RU = {
  "basic": "основное",
  "fencing": "фехтовальное",
  "brawling": "кулачный бой",
  "cavalry": "кавалерийское",
  "flail": "цепы",
  "parry": "парирующее",
  "polearm": "древковое",
  "two-handed": "двуручное",
  "bow": "луки",
  "crossbow": "арбалеты",
  "sling": "пращи",
  "blackpowder": "порох",
  "engineering": "инженерное",
  "throwing": "метательное",
  "entangling": "ловчее",
  "explosives": "взрывчатка",
  "any": "любое",
  "magick": "магический",
  "rural": "сельская местность",
  "urban": "города",
  "the empire": "Империя",
  "empire": "Империя",
  "reikland": "Рейкланд",
  "theology": "теология",
  "heraldry": "геральдика",
  "medicine": "медицина",
  "law": "право",
  "history": "история",
  "acting": "актёрство",
  "singing": "пение",
  "storytelling": "рассказы",
  "comedy": "комедия",
  "dancing": "танец",
  "sigmar": "Сигмар",
  "ulric": "Ульрик",
  "classical": "классический",
  "battle": "боевой",
  "disease": "болезни",
  "poison": "яды",
  "chaos": "Хаос",
  "soldiers": "солдаты",
  "nobles": "дворяне",
  "guilders": "гильдейцы",
  "scholars": "книгочеи",
  "fire": "Огонь",
  "heavens": "Небеса",
  "death": "Смерть",
  "beasts": "Звери",
  "metal": "Металл",
  "light": "Свет",
  "shadow": "Тени",
  "shadows": "Тени",
  "life": "Жизнь",
  "hedgecraft": "знахарство",
  "witchcraft": "ведьмовство",
  "daemonology": "демонология",
  "necromancy": "некромантия",
  "slaanesh": "Слаанеш",
  "morr": "Морр",
  "taal": "Таал",
  "shallya": "Шаллья",
  "manann": "Мананн",
  "myrmidia": "Мирмидия",
  "ranald": "Ранальд",
  "rhya": "Рхия",
  "verena": "Верена"
};

/** Перевести название: «Melee (Basic)» -> «Рукопашный бой (основное)». Неизвестное - как есть */
export function translateTerm(text) {
  const s = String(text ?? "").trim();
  if (!s) return s;
  if (GLOSSARY_RU[s]) return GLOSSARY_RU[s];
  const m = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m && GLOSSARY_RU[m[1]]) {
    const spec = SPEC_RU[m[2].toLowerCase()] ?? m[2];
    return `${GLOSSARY_RU[m[1]]} (${spec})`;
  }
  // «Brass 1» / «Silver 3»
  const st = s.match(/^(Brass|Silver|Gold)\s+(\d+)$/);
  if (st) return `${GLOSSARY_RU[st[1]]} ${st[2]}`;
  return s;
}
