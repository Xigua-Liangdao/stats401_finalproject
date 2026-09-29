let current = '';
let watching = false;

function readViewportDevice() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return '';
  if (window.matchMedia('(max-width: 640px)').matches) return 'phone';
  if (window.matchMedia('(max-width: 980px)').matches) return 'pad';
  return 'laptop';
}

export function currentDevice() {
  if (!current) current = readViewportDevice();
  return current || null;
}

export function watchDevice() {
  if (watching || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  watching = true;
  current = readViewportDevice();
  const update = () => {
    current = readViewportDevice();
  };
  window.matchMedia('(max-width: 640px)').addEventListener('change', update);
  window.matchMedia('(max-width: 980px)').addEventListener('change', update);
}
