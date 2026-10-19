const CONTEXT_LIMIT = 3500;

const CONTEXT_SELECTOR = [
  'h1',
  '.viz-placeholder__title',
  '.viz-placeholder__note',
  '.section-block__title',
  '.stat-card__label',
  '.stat-card__value',
  '.compare-selection',
  '.home-metric dt',
  '.home-metric dd',
  '.home-sub',
].join(', ');

export function pageContext() {
  const root = document.querySelector('#app');
  if (!root) return '';
  const seen = new Set();
  const lines = [];
  for (const node of root.querySelectorAll(CONTEXT_SELECTOR)) {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    lines.push(text);
    if (lines.join('\n').length >= CONTEXT_LIMIT) break;
  }
  return lines.join('\n').slice(0, CONTEXT_LIMIT);
}
