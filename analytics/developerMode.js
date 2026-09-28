const STORAGE_KEY = 'analytics_is_test';
const CLICKS_REQUIRED = 8;
const CLICK_GAP_MS = 2500;
const NOTICE_MS = 2400;

let memoryTest = false;
let clickCount = 0;
let lastClickAt = 0;

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return memoryTest;
  }
}

function writeStored(enabled) {
  memoryTest = enabled;
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, 'true');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode keeps the in-memory flag */
  }
}

export function isDeveloperMode() {
  return readStored();
}

function showNotice(message) {
  document.querySelector('.analytics-notice')?.remove();
  const notice = document.createElement('p');
  notice.className = 'analytics-notice';
  notice.setAttribute('role', 'status');
  notice.textContent = message;
  document.body.append(notice);
  window.setTimeout(() => notice.remove(), NOTICE_MS);
}

export function syncDeveloperIndicator() {
  const footer = document.querySelector('.site-footer');
  if (!footer) return;
  const current = footer.querySelector('.site-footer__developer');
  if (!isDeveloperMode()) {
    current?.remove();
    return;
  }
  if (current) return;
  const mark = document.createElement('span');
  mark.className = 'site-footer__developer';
  mark.textContent = 'developer';
  mark.addEventListener('dblclick', (event) => {
    event.preventDefault();
    disableDeveloperMode();
  });
  footer.append(mark);
}

export function enableDeveloperMode() {
  if (isDeveloperMode()) return;
  writeStored(true);
  clickCount = 0;
  console.log('[Analytics] Developer Mode enabled');
  console.log('[Analytics] is_test: true');
  syncDeveloperIndicator();
  showNotice('Developer Mode enabled');
}

export function disableDeveloperMode() {
  if (!isDeveloperMode()) return;
  writeStored(false);
  clickCount = 0;
  console.log('[Analytics] Developer Mode disabled');
  console.log('[Analytics] is_test: false');
  syncDeveloperIndicator();
  showNotice('Developer Mode disabled');
}

function onStatusChipClick() {
  if (isDeveloperMode()) return;
  const now = Date.now();
  if (now - lastClickAt > CLICK_GAP_MS) clickCount = 0;
  lastClickAt = now;
  clickCount += 1;
  if (clickCount >= CLICKS_REQUIRED) enableDeveloperMode();
}

export function bindDeveloperMode() {
  const chip = document.querySelector('.status-chip.status-chip--mock');
  if (!chip || chip.dataset.analyticsBound === 'true') return;
  chip.dataset.analyticsBound = 'true';
  chip.addEventListener('click', onStatusChipClick);
}
