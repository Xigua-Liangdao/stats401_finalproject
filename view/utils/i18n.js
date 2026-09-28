import { defaultLanguage, languagePacks } from '../../data/lang/index.js';

const STORAGE_KEY = 'stats401-language';

function storedLanguage() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return languagePacks[id] ? id : defaultLanguage;
  } catch {
    return defaultLanguage;
  }
}

let language = storedLanguage();

export function availableLanguages() {
  return Object.keys(languagePacks);
}

export function languageChoices() {
  return availableLanguages().map((id) => ({
    id,
    name: languagePacks[id].name || id,
  }));
}

export function indexed(index, label) {
  return t('shell.indexed', { index, label });
}

/** Look up a value read from the dataset. The raw string is the key; a missing entry stays as read. */
export function fromData(group, value) {
  if (value == null || value === '') return value;
  return languagePacks[language]?.names?.[group]?.[value] || value;
}

export function currentLanguage() {
  return language;
}

export function textLocale() {
  return languagePacks[language]?.locale ?? languagePacks[defaultLanguage].locale;
}

export function t(key, vars) {
  const pack = languagePacks[language] ?? languagePacks[defaultLanguage];
  const fallback = languagePacks[defaultLanguage];
  const template = pack.messages[key] ?? fallback.messages[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])));
}

export function setLanguage(id) {
  if (!languagePacks[id]) return false;
  language = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore private mode */
  }
  applyDocumentCopy();
  return true;
}

export function applyDocumentCopy() {
  document.documentElement.lang = textLocale();
  document.title = t('home.title');
  const skip = document.querySelector('.skip-link');
  if (skip) skip.textContent = t('app.skip');
  const footer = document.querySelector('.site-footer span');
  if (footer) footer.textContent = t('app.footer');
  const startup = document.querySelector('#startup');
  if (startup) startup.setAttribute('aria-label', t('app.loading'));
  const startupId = document.querySelector('.startup__id');
  if (startupId) startupId.textContent = t('home.title');
  const startupNote = document.querySelector('.startup__note');
  if (startupNote) startupNote.textContent = t('app.tagline');
  const wipe = document.querySelector('.route-wipe__mark');
  if (wipe) wipe.textContent = t('app.linking');
}
