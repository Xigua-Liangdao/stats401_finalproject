import { PLACEHOLDER } from './constants.js';
import { formatCount, formatFixed, formatImpact, formatPercent } from './formatting.js';

const FORMATTERS = {
  count: formatCount,
  percent: formatPercent,
  share: (value) => formatFixed(value, 3),
  dpm: (value) => formatFixed(value, 1),
  kda: (value) => formatFixed(value, 2),
  impact: formatImpact,
  vision: (value) => formatFixed(value, 2),
};

export function statValue(value, format = 'count') {
  const formatter = FORMATTERS[format];
  return formatter ? formatter(value) : value == null || value === '' ? PLACEHOLDER : String(value);
}

export function fillStatCards(cards, stats = {}) {
  return cards.map((card) => ({
    ...card,
    value: statValue(stats[card.field ?? card.key], card.format),
  }));
}

export function isEligible(stats) {
  return Boolean(stats?.eligible);
}
