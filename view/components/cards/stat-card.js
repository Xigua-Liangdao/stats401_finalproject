import { h } from '../../utils/dom.js';
import { placeholderValue } from '../../utils/formatting.js';

export function createStatCard({ label, hint, value = placeholderValue() }) {
  return h('article', { class: 'stat-card' }, [
    h('div', { class: 'stat-card__label' }, [label]),
    h('div', { class: 'stat-card__value' }, [value]),
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
