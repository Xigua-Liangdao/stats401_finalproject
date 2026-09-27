import { h } from '../../utils/dom.js';
import { statValue } from '../../utils/stats.js';
import { LINEUP_STAT_CARDS } from '../lineup/lineup-data.js';
import { loadLineupHeatmap } from '../pair-impact/pair-impact-data.js';
import { createPairHeatmapPanel } from '../pair-impact/pair-impact-heatmap.js';
import { createCompareRadar } from './comparison-radar.js';

const PLAYER_STATS = [
  { label: 'Games', field: 'n_games', format: 'count' },
  { label: 'Win rate', field: 'win_rate', format: 'percent' },
  { label: 'Gold share', field: 'mean_gold_share', format: 'percent' },
  { label: 'Damage share', field: 'mean_damage_share', format: 'percent' },
  { label: 'DPM', field: 'mean_dpm', format: 'dpm' },
  { label: 'Vision / min', field: 'mean_vision_per_minute', format: 'vision' },
  { label: 'Impact', field: 'shrunk_impact', format: 'impact' },
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
      h('span', { class: 'compare-stats__value' }, [statValue(left.stats?.[row.field ?? row.key], row.format)]),
      h('span', { class: 'compare-stats__value' }, [statValue(right.stats?.[row.field ?? row.key], row.format)]),
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
    h('p', { class: 'compare-stage__label' }, ['Loading pair impact']),
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
        h('p', { class: 'empty-state' }, ['No pair impact for this lineup.']),
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
