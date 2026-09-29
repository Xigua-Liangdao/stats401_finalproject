import { h } from '../../utils/dom.js';
import { trackUi } from '../../utils/track.js';

function bindClick(onClick, track) {
  if (!track) return onClick;
  return (event) => {
    try {
      trackUi(track);
    } finally {
      onClick?.(event);
    }
  };
}

export function createButton({ label, variant = 'ghost', href, onClick, ariaLabel, track }) {
  const className = `btn btn--${variant}`;
  const handle = bindClick(onClick, track);
  if (href) {
    return h('a', { class: className, href, onClick: handle, 'aria-label': ariaLabel }, [label]);
  }
  return h(
    'button',
    { class: className, type: 'button', onClick: handle, 'aria-label': ariaLabel },
    [label],
  );
}
