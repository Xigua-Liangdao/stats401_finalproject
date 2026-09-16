import { h } from '../../utils/dom.js';
import { createButton } from '../buttons/button.js';

let active = null;
let closeTimer = 0;

function onKey(event) {
  if (event.key === 'Escape') closeDrawer();
}

export function closeDrawer() {
  if (!active) return;
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
  const root = active;
  active = null;
  root.classList.remove('is-open');
  closeTimer = window.setTimeout(() => root.remove(), 180);
}

export function openDrawer({ kicker, title, body }) {
  window.clearTimeout(closeTimer);
  document.querySelectorAll('.drawer-root').forEach((node) => node.remove());
  active = null;
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';

  const root = h('div', { class: 'drawer-root', role: 'presentation' }, [
    h('div', { class: 'drawer-backdrop', onClick: closeDrawer }),
    h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      h('header', { class: 'drawer-header' }, [
        h('div', {}, [
          h('div', { class: 'kicker' }, [kicker]),
          h('h2', {}, [title]),
        ]),
        createButton({ label: 'Close', onClick: closeDrawer, ariaLabel: 'Close drawer' }),
      ]),
      h('div', { class: 'drawer-body' }, [body]),
    ]),
  ]);

  document.body.append(root);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => root.classList.add('is-open'));
  active = root;
  return { close: closeDrawer };
}
