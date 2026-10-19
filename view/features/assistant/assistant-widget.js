import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { withDataset } from '../../utils/navigation.js';
import { assistantOnline, noteAssistantFailure, requestSummary } from './assistant-client.js';
import { interpretAssistant } from './assistant-intent.js';
import { pageContext } from './page-context.js';

const CORNER_KEY = 'stats401-assistant-corner';
const CORNERS = ['se', 'sw', 'ne', 'nw'];
const SIZE = 58;
const PAD = 18;
const DRAG_PX = 6;

function savedCorner() {
  try {
    const value = localStorage.getItem(CORNER_KEY);
    return CORNERS.includes(value) ? value : 'sw';
  } catch {
    return 'sw';
  }
}

function feedbackHref() {
  return document.querySelector('.site-footer__feedback')?.getAttribute('href') || '';
}

export function mountAssistant(parent = document.body) {
  const host = h('div', { class: 'assistant is-sw' });
  const banner = h('p', { class: 'assistant__banner', hidden: true });
  const log = h('div', { class: 'assistant__log', role: 'log' });
  const input = h('input', {
    class: 'assistant__input',
    type: 'text',
    maxlength: '200',
    placeholder: t('assistant.placeholder'),
    'aria-label': t('assistant.placeholder'),
  });
  const close = h('button', {
    class: 'assistant__close',
    type: 'button',
    'aria-label': t('assistant.close'),
  }, ['×']);
  const title = h('p', { class: 'assistant__title' }, [t('assistant.title')]);
  const send = h('button', { class: 'assistant__send', type: 'submit' }, [t('assistant.send')]);
  const form = h('form', { class: 'assistant__form' }, [
    input,
    send,
  ]);
  const panel = h('div', { class: 'assistant__panel', hidden: true }, [
    h('div', { class: 'assistant__head' }, [
      title,
      close,
    ]),
    banner,
    log,
    form,
  ]);
  const orb = h('button', {
    class: 'assistant__orb',
    type: 'button',
    'aria-expanded': 'false',
    'aria-label': t('assistant.open'),
  });
  host.append(panel, orb);
  parent.append(host);

  let open = false;
  let greeted = false;
  let drag = null;

  function cornerPoint(corner) {
    const right = Math.max(PAD, window.innerWidth - SIZE - PAD);
    const bottom = Math.max(PAD, window.innerHeight - SIZE - PAD);
    if (corner === 'se') return [right, bottom];
    if (corner === 'ne') return [right, PAD];
    if (corner === 'nw') return [PAD, PAD];
    return [PAD, bottom];
  }

  function setCorner(corner) {
    host.classList.remove(...CORNERS.map((item) => `is-${item}`));
    host.classList.add(`is-${corner}`);
  }

  function place(corner, { animate = false } = {}) {
    setCorner(corner);
    host.classList.toggle('is-animating', animate);
    const [x, y] = cornerPoint(corner);
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
  }

  function quadrant(x, y) {
    const east = x + SIZE / 2 > window.innerWidth / 2;
    const south = y + SIZE / 2 > window.innerHeight / 2;
    return `${south ? 's' : 'n'}${east ? 'e' : 'w'}`;
  }

  function push(role, children) {
    log.append(h('div', { class: `assistant__msg assistant__msg--${role}` }, children));
    log.scrollTop = log.scrollHeight;
  }

  function showAway() {
    const href = feedbackHref();
    banner.hidden = false;
    banner.replaceChildren(
      h('strong', {}, [t('assistant.away')]),
      ' ',
      href
        ? h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, [t('assistant.awayHint')])
        : t('assistant.awayHint'),
    );
  }

  async function ensureOnline() {
    const ok = await assistantOnline();
    if (!ok) showAway();
    return ok;
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    push('bot', [t('assistant.greeting')]);
  }

  function setOpen(next) {
    open = next;
    panel.hidden = !open;
    title.textContent = t('assistant.title');
    send.textContent = t('assistant.send');
    input.placeholder = t('assistant.placeholder');
    input.setAttribute('aria-label', t('assistant.placeholder'));
    close.setAttribute('aria-label', t('assistant.close'));
    orb.setAttribute('aria-expanded', open ? 'true' : 'false');
    orb.setAttribute('aria-label', t(open ? 'assistant.close' : 'assistant.open'));
    if (!open) return;
    greet();
    ensureOnline();
    input.focus();
  }

  async function replyTo(text) {
    const intent = interpretAssistant(text);
    if (intent.kind === 'empty') return;
    push('user', [text]);
    if (intent.kind === 'lookup') {
      const href = withDataset(`#/players?q=${encodeURIComponent(intent.name)}`);
      push('bot', [
        t('assistant.lookup', { name: intent.name }),
        ' ',
        h('a', { href }, [t('assistant.catalogue')]),
      ]);
      return;
    }
    if (intent.kind === 'unknown') {
      push('bot', [t('assistant.unknown')]);
      return;
    }
    const context = pageContext();
    if (!context) {
      push('bot', [t('assistant.summaryEmpty')]);
      return;
    }
    if (!(await ensureOnline())) {
      push('bot', [t('assistant.away')]);
      return;
    }
    form.setAttribute('aria-busy', 'true');
    input.disabled = true;
    try {
      push('bot', [await requestSummary(text, context)]);
    } catch (error) {
      console.error('[Assistant] summary failed:', error);
      noteAssistantFailure();
      showAway();
      push('bot', [t('assistant.away')]);
    } finally {
      form.removeAttribute('aria-busy');
      input.disabled = false;
      input.focus();
    }
  }

  orb.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: host.offsetLeft,
      top: host.offsetTop,
      moved: false,
    };
    orb.setPointerCapture(event.pointerId);
  });
  orb.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > DRAG_PX) drag.moved = true;
    if (!drag.moved) return;
    host.classList.add('is-dragging');
    host.classList.remove('is-animating');
    const x = Math.min(Math.max(PAD, drag.left + dx), window.innerWidth - SIZE - PAD);
    const y = Math.min(Math.max(PAD, drag.top + dy), window.innerHeight - SIZE - PAD);
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    setCorner(quadrant(x, y));
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    host.classList.remove('is-dragging');
    if (!moved) {
      setOpen(!open);
      return;
    }
    const corner = quadrant(host.offsetLeft, host.offsetTop);
    try {
      localStorage.setItem(CORNER_KEY, corner);
    } catch { /* The corner still applies for this visit. */ }
    place(corner, { animate: true });
  }
  orb.addEventListener('pointerup', endDrag);
  orb.addEventListener('pointercancel', endDrag);
  close.addEventListener('click', () => setOpen(false));
  host.addEventListener('transitionend', () => host.classList.remove('is-animating'));
  window.addEventListener('resize', () => place(quadrant(host.offsetLeft, host.offsetTop)));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) setOpen(false);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (form.getAttribute('aria-busy') === 'true') return;
    const text = input.value.trim();
    input.value = '';
    replyTo(text);
  });

  place(savedCorner());
  return host;
}
