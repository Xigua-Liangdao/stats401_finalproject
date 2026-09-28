import { defaultLanguage, languagePacks } from '../res/lang/index.js';

let language = defaultLanguage;

export function availableLanguages() {
  return Object.keys(languagePacks);
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
  applyDocumentCopy();
  return true;
}

export function applyDocumentCopy() {
  document.documentElement.lang = textLocale();
  document.title = t('app.name');
  const skip = document.querySelector('.skip-link');
  if (skip) skip.textContent = t('app.skip');
  const footer = document.querySelector('.site-footer span');
  if (footer) footer.textContent = t('app.footer');
  const startup = document.querySelector('#startup');
  if (startup) startup.setAttribute('aria-label', t('app.loading'));
  const startupId = document.querySelector('.startup__id');
  if (startupId) startupId.textContent = t('app.name');
  const startupNote = document.querySelector('.startup__note');
  if (startupNote) startupNote.textContent = t('app.tagline');
  const wipe = document.querySelector('.route-wipe__mark');
  if (wipe) wipe.textContent = t('app.linking');
}
