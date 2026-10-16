/**
 * Машинный перевод описаний (английский -> язык клиента), с кэшем в браузере.
 * Провайдеры:
 *  - "chrome": встроенный переводчик Chrome (Translator API) - локально, бесплатно, без ключей. Есть не везде.
 *  - "google": бесплатный веб-эндпоинт Google Translate. Не официальный API: может перестать работать, тексты уходят в Google.
 */
const CACHE_KEY = "wfrp4e-paperdoll.translations";
const MAX_ENTRIES = 3000;
let cache = null;
const pending = new Map();
let chromeTranslator = null;

function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") ?? {};
  } catch {
    cache = {};
  }
  return cache;
}
function saveCache() {
  try {
    const keys = Object.keys(cache);
    if (keys.length > MAX_ENTRIES) for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete cache[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

/** Похоже на английский текст, который стоит переводить */
export function looksEnglish(text) {
  const s = String(text ?? "");
  if (s.length < 12 || /[А-Яа-яЁё]/.test(s)) return false;
  return (s.match(/[A-Za-z]{3,}/g) ?? []).length >= 2;
}

export function cachedTranslation(text, lang) {
  return loadCache()[`${lang}|${text}`] ?? null;
}

async function viaChrome(text, lang) {
  const T = globalThis.Translator;
  if (!T?.create) throw new Error("Chrome Translator API is not available");
  if (!chromeTranslator || chromeTranslator.lang !== lang) {
    const avail = await T.availability?.({ sourceLanguage: "en", targetLanguage: lang });
    if (avail === "unavailable") throw new Error("Chrome cannot translate en -> " + lang);
    chromeTranslator = { lang, t: await T.create({ sourceLanguage: "en", targetLanguage: lang }) };
  }
  return chromeTranslator.t.translate(text);
}

async function viaGoogle(text, lang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Translate: ${res.status}`);
  const data = await res.json();
  return (data?.[0] ?? []).map((part) => part?.[0] ?? "").join("");
}

/** Перевести (с кэшем и без повторных одновременных запросов). null - не получилось */
export async function translateText(text, lang, provider) {
  if (!provider || provider === "off" || !looksEnglish(text)) return null;
  const key = `${lang}|${text}`;
  const c = loadCache();
  if (c[key]) return c[key];
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
    try {
      const out = provider === "chrome" ? await viaChrome(text, lang) : await viaGoogle(text, lang);
      if (out) {
        c[key] = out;
        saveCache();
      }
      return out || null;
    } catch (err) {
      console.warn("wfrp4e-paperdoll | translate", err);
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, job);
  return job;
}
