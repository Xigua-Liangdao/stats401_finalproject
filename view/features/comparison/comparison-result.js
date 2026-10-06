import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { statValue } from '../../utils/stats.js';
import { LINEUP_STAT_CARDS } from '../lineup/lineup-data.js';
import { loadLineupHeatmap } from '../pair-impact/pair-impact-data.js';
import { createPairHeatmapPanel } from '../pair-impact/pair-impact-heatmap.js';
import { createCompareRadar } from './comparison-radar.js';

const PLAYER_STATS = [
  { field: 'n_games', format: 'count', get label() { return t('common.games'); } },
  { field: 'win_rate', format: 'percent', get label() { return t('common.winRate'); } },
  { field: 'mean_gold_share', format: 'percent', get label() { return t('common.goldShare'); } },
  { field: 'mean_damage_share', format: 'percent', get label() { return t('common.damageShare'); } },
  { field: 'mean_dpm', format: 'dpm', get label() { return t('common.dpm'); } },
  { field: 'mean_vision_per_minute', format: 'vision', get label() { return t('common.vision'); } },
  { field: 'shrunk_impact', format: 'impact', get label() { return t('common.impact'); } },
];

export function createStatCompare({ rows, left, right }) {
  return h('div', { class: 'compare-stats panel' }, [
    h('div', { class: 'compare-stats__row compare-stats__row--head' }, [
      h('span', {}, ['']),
      h('span', { class: 'compare-stats__name compare-stats__name--left' }, [left.name]),
      h('span', { class: 'compare-stats__name compare-stats__name--right' }, [right.name]),
    ]),
    ...rows.map((row) => h('div', { class: 'compare-stats__row' }, [
      h('span', { class: 'compare-stats__label' }, [row.label]),
      h('span', { class: 'compare-stats__value compare-stats__value--left' }, [statValue(left.stats?.[row.field ?? row.key], row.format)]),
      h('span', { class: 'compare-stats__value compare-stats__value--right' }, [statValue(right.stats?.[row.field ?? row.key], row.format)]),
    ])),
  ]);
}

export function createPlayerComparison({ left, right, players }) {
  return h('div', { class: 'compare-output' }, [
    createCompareRadar({ left, right, players }),
    createStatCompare({ rows: PLAYER_STATS, left, right }),
  ]);
}

export function createLineupComparison({ left, right }) {
  const root = h('div', { class: 'compare-output' });
  const charts = h('div', { class: 'compare-heatmaps' }, [
    h('p', { class: 'compare-stage__label' }, [t('compare.loading')]),
  ]);
  root.append(
    charts,
    createStatCompare({ rows: LINEUP_STAT_CARDS, left, right }),
  );

  Promise.all([loadPanel(left), loadPanel(right)]).then((results) => {
    if (!root.isConnected) return;
    charts.replaceChildren(...syncedHeatmaps(results));
  });

  return root;
}

function syncedHeatmaps(results) {
  const apis = [null, null];
  let origin = null;
  return results.map((result, index) => {
    if (!result.heatmap) {
      return h('div', { class: 'panel compare-heatmap-empty' }, [
        h('p', { class: 'viz-placeholder__title' }, [result.lineup.name]),
        h('p', { class: 'empty-state' }, [t('compare.missing')]),
      ]);
    }
    return createPairHeatmapPanel({
      heatmap: result.heatmap,
      teamName: [result.lineup.name, result.lineup.team?.name].filter(Boolean).join(' · '),
      onInspect(state) {
        const other = apis[1 - index];
        if (!other || origin != null) return;
        origin = index;
        other.highlight(state);
        origin = null;
      },
      bind(api) {
        apis[index] = api;
      },
    });
  });
}

function loadPanel(lineup) {
  return loadLineupHeatmap(lineup.id)
    .then((heatmap) => ({ lineup, heatmap }))
    .catch(() => ({ lineup, heatmap: null }));
}
