import { h } from '../../utils/dom.js';

export function createButton({ label, variant = 'ghost', href, onClick, ariaLabel }) {
  const className = `btn btn--${variant}`;
  if (href) {
    return h('a', { class: className, href, 'aria-label': ariaLabel }, [label]);
  }
  return h(
    'button',
    { class: className, type: 'button', onClick, 'aria-label': ariaLabel },
    [label],
  );
}
