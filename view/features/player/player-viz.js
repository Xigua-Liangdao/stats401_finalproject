import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { PLAYER_CHART_CATEGORIES, findCategory } from './player-chart-config.js';
import { mountPlayerRadar, createRadarAxes, createRadarScaleNote } from './player-radar-chart.js?v=scale-zoom';
import { mountPlayerTimeline } from './player-timeline-chart.js';
import { predictedValue, profileValues, timelineGamesForPlayer } from './player-baseline.js';

function createSelect(options, value) {
  return h(
    'select',
    { class: 'chart-select' },
    options.map((option) =>
      h('option', { value: option.id, selected: option.id === value }, [option.label]),
    ),
  );
}

function createMetricPicks(metrics, selectedIds, onChange) {
  const root = h('div', { class: 'metric-picks', 'aria-label': t('common.metrics') });

  function render() {
    root.replaceChildren(
      ...metrics.map((metric) => {
        const on = selectedIds.has(metric.id);
        return h(
          'button',
          {
            class: on ? 'metric-chip is-on' : 'metric-chip',
            type: 'button',
            'aria-pressed': on ? 'true' : 'false',
            onClick: () => {
              if (on) {
                if (selectedIds.size === 1) return;
                selectedIds.delete(metric.id);
              } else {
                selectedIds.add(metric.id);
              }
              render();
              onChange([...selectedIds]);
            },
          },
          [metric.label],
        );
      }),
    );
  }

  render();
  return root;
}

function selectedFields(category, selectedIds) {
  return category.metrics.filter((metric) => selectedIds.has(metric.id)).map((metric) => metric.field);
}

function createPanel({ index, title, controls, stageClass, vizId, chromeClass }) {
  const stage = h('div', { class: `viz-stage ${stageClass}` });
  return {
    stage,
    node: h('article', { class: 'viz-placeholder panel player-viz-panel', dataset: { viz: vizId } }, [
      h('div', { class: `viz-placeholder__chrome player-viz-chrome ${chromeClass ?? ''}`.trim() }, [
        h('div', { class: 'player-viz-chrome__titles' }, [
          h('span', {}, [index]),
          h('span', {}, [title]),
        ]),
        controls,
      ]),
      stage,
    ]),
  };
}

export function renderPlayerVisualizations({ player, games, players = [] }) {
  let category = PLAYER_CHART_CATEGORIES[0];
  const selectedIds = new Set(category.metrics.slice(0, 3).map((metric) => metric.id));

  const categorySelect = createSelect(PLAYER_CHART_CATEGORIES, category.id);
  const metricWrap = h('div', { class: 'chart-control' }, [t('common.metrics')]);
  const baselineToggle = h('label', { class: 'chart-toggle' }, [
    h('input', { type: 'checkbox' }),
    t('chart.baseline'),
  ]);
  const predictedToggle = h('label', { class: 'chart-toggle' }, [
    h('input', { type: 'checkbox' }),
    t('chart.predicted'),
  ]);

  let timelineChart;
  function syncMetrics(picks) {
    metricWrap.replaceChildren(t('common.metrics'), picks);
  }

  function mountPicks() {
    const picks = createMetricPicks(category.metrics, selectedIds, (ids) => {
      timelineChart?.update(selectedFields(category, new Set(ids)));
    });
    syncMetrics(picks);
  }

  const timeline = createPanel({
    index: t('chart.viz1'),
    title: t('chart.timeline'),
    vizId: 'player-timeline',
    stageClass: 'player-timeline-stage',
    chromeClass: 'player-viz-chrome--stacked',
    controls: h('div', { class: 'chart-controls' }, [
      h('label', { class: 'chart-control' }, [t('chart.category'), categorySelect]),
      metricWrap,
    ]),
  });

  const radarAxes = createRadarAxes([...players, player]);
  const radar = createPanel({
    index: t('chart.viz2'),
    title: t('chart.profile'),
    vizId: 'player-radar',
    stageClass: 'player-radar-stage',
    controls: h('div', { class: 'chart-controls' }, [
      baselineToggle,
      predictedToggle,
    ]),
  });
  const scaleNoteHost = h('div', { class: 'radar-scale-note-host' });
  scaleNoteHost.replaceChildren(createRadarScaleNote(radarAxes));
  radar.node.append(scaleNoteHost);

  const baselineInput = baselineToggle.querySelector('input');
  const predictedInput = predictedToggle.querySelector('input');
  const hasBaseline = profileValues(player.stats, radarAxes, true).some(Number.isFinite);
  const hasPredicted = radarAxes.some((axis) => predictedValue(player.stats, axis.key) != null);
  if (!hasBaseline) {
    baselineInput.disabled = true;
    baselineToggle.classList.add('is-disabled');
    baselineToggle.title = t('chart.noBaseline');
  } else {
    baselineInput.checked = true;
  }
  if (!hasPredicted) {
    predictedInput.disabled = true;
    predictedToggle.classList.add('is-disabled');
    predictedToggle.title = t('chart.noPredicted');
  } else {
    predictedInput.checked = true;
  }

  const root = h('div', { class: 'viz-grid player-viz-grid' }, [timeline.node, radar.node]);
  mountPicks();

  queueMicrotask(() => {
    timelineChart = mountPlayerTimeline(timeline.stage, { games: timelineGamesForPlayer(player, games) });
    const radarChart = mountPlayerRadar(radar.stage, {
      stats: player.stats ?? {},
      axes: radarAxes,
    });
    timelineChart.update(selectedFields(category, selectedIds));
    if (baselineInput.checked) radarChart.setBaseline(true);
    if (predictedInput.checked) radarChart.setPredicted(true);

    categorySelect.addEventListener('change', () => {
      category = findCategory(categorySelect.value);
      selectedIds.clear();
      const defaults = category.id === 'dpm' ? category.metrics : [category.metrics[0]];
      for (const metric of defaults) selectedIds.add(metric.id);
      mountPicks();
      timelineChart.update(selectedFields(category, selectedIds));
    });
    baselineInput.addEventListener('change', (event) => {
      radarChart.setBaseline(event.target.checked);
    });
    predictedInput.addEventListener('change', (event) => {
      radarChart.setPredicted(event.target.checked);
    });
  });

  return root;
}
