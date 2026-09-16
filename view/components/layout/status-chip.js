import { h } from '../../utils/dom.js';

export function createStatusChip({ label, variant = '' }) {
  const classes = ['status-chip'];
  if (variant) classes.push(`status-chip--${variant}`);
  return h('span', { class: classes.join(' ') }, [
    h('span', { class: 'status-chip__dot', 'aria-hidden': 'true' }),
    label,
  ]);
}
