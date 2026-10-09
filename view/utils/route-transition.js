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

  return async function runTransition(renderInto, { cinematic = false, isCurrent = () => true } = {}) {
    const id = ++generation;
    const firstPaint = app.childElementCount === 0;
    const instant = reducedMotion() || firstPaint || !cinematic;

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
  };
}
