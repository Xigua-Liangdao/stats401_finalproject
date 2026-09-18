const COVER_MS = 320;
const CLEAR_MS = 380;

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

export function createRouteTransition(app, wipe) {
  let generation = 0;

  return async function runTransition(renderInto, { cinematic = false } = {}) {
    const id = ++generation;
    const firstPaint = app.childElementCount === 0;
    const instant = reducedMotion() || firstPaint || !cinematic;

    wipe.setAttribute('aria-hidden', 'true');

    if (!instant) {
      wipe.classList.remove('is-clearing');
      wipe.classList.add('is-covering');
      await wait(COVER_MS);
      if (id !== generation) return;
    }

    app.classList.remove('is-entering');
    app.replaceChildren();
    window.scrollTo(0, 0);

    try {
      await renderInto(app);
    } finally {
      if (id !== generation) return;

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
  };
}
