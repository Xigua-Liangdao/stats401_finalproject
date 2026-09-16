import { h } from '../../utils/dom.js';
import { placeholderValue } from '../../utils/formatting.js';

export function createStatCard({ label, hint, value = placeholderValue(), valueClass, tone }) {
  return h('article', { class: 'stat-card', dataset: tone ? { tone } : undefined }, [
    h('div', { class: 'stat-card__label' }, [label]),
    h('div', { class: valueClass ? `stat-card__value ${valueClass}` : 'stat-card__value' }, [value]),
    hint ? h('div', { class: 'stat-card__hint' }, [hint]) : null,
  ]);
}

export function createStatGrid(cards) {
  return h(
    'div',
    { class: 'stat-grid' },
    cards.map((card) => createStatCard(card)),
  );
}
