import { t } from './i18n.js';
import { datasetKey, getSelectedDataset } from './season.js';
import { markRouteLoadingWarmed, routeLoadingKey, SLOW_LOADING_MS } from './loading-line.js';

const COVER_MS = 320;
const CLEAR_MS = 380;
const LOADING_DELAY_MS = 280;

const CINEMATIC_ROUTES = new Set(['home', 'players']);

export function shouldPlayRouteWipe(fromName, toName) {
  if (!toName || fromName === toName) return false;
  return CINEMATIC_ROUTES.has(toName);
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

let activeLoading = null;

function hideRouteLoading(loading) {
  if (!loading) return;
  loading.hidden = true;
  loading.classList.remove('is-active');
  loading.setAttribute('aria-hidden', 'true');
}

function startRouteLoading(loading, { enabled, datasetKey: key }) {
  activeLoading?.cancelTimers();
  if (!loading || !enabled) {
    const idle = { cancelTimers() {} };
    activeLoading = idle;
    return () => {
      if (activeLoading === idle) activeLoading = null;
    };
  }

  const startedAt = Date.now();
  const text = loading.querySelector('.route-loading__text');
  const paint = () => {
    if (text) text.textContent = t(routeLoadingKey({ datasetKey: key, elapsedMs: Date.now() - startedAt }));
  };
  const session = {
    showTimer: setTimeout(() => {
      const header = document.querySelector('#site-header');
      const top = header ? header.getBoundingClientRect().bottom : 0;
      loading.style.top = `${Math.max(0, top)}px`;
      loading.hidden = false;
      loading.classList.add('is-active');
      loading.setAttribute('aria-hidden', 'false');
      paint();
    }, LOADING_DELAY_MS),
    slowTimer: setTimeout(paint, SLOW_LOADING_MS),
    cancelTimers() {
      clearTimeout(this.showTimer);
      clearTimeout(this.slowTimer);
    },
  };
  activeLoading = session;
  return () => {
    session.cancelTimers();
    if (activeLoading !== session) return;
    hideRouteLoading(loading);
    activeLoading = null;
  };
}

export function createRouteTransition(app, wipe, loading = null) {
  let generation = 0;

  return async function runTransition(renderInto, { cinematic = false, isCurrent = () => true } = {}) {
    const id = ++generation;
    const firstPaint = app.childElementCount === 0;
    const instant = reducedMotion() || firstPaint || !cinematic;
    const showLoading = instant && !firstPaint;
    const key = datasetKey(getSelectedDataset());
    const stopLoading = startRouteLoading(loading, { enabled: showLoading, datasetKey: key });

    try {
      wipe.setAttribute('aria-hidden', 'true');

      if (!instant) {
        wipe.classList.remove('is-clearing');
        wipe.classList.add('is-covering');
        await wait(COVER_MS);
        if (id !== generation || !isCurrent()) return;
      }

      app.classList.remove('is-entering');
      window.scrollTo(0, 0);
      const staging = document.createElement('div');
      staging.style.display = 'contents';
      // Give each render its own connected host so chart mount hooks can run.
      // A newer route removes this host; late appends then stay off-screen.
      app.replaceChildren(staging);

      try {
        await renderInto(staging);
        if (id !== generation || !isCurrent()) return;
        if (showLoading) markRouteLoadingWarmed(key);
        app.replaceChildren(...staging.childNodes);
      } finally {
        if (id !== generation || !isCurrent()) return;

        if (instant) {
          wipe.classList.remove('is-covering', 'is-clearing');
          return;
        }

        requestAnimationFrame(() => {
          if (id !== generation) return;
          app.classList.add('is-entering');
        });

        wipe.classList.remove('is-covering');
        wipe.classList.add('is-clearing');
        await wait(CLEAR_MS);
        if (id !== generation) return;
        wipe.classList.remove('is-clearing');
      }
    } finally {
      stopLoading();
    }
  };
}
