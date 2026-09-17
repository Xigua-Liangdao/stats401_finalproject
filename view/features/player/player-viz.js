import { h } from '../../utils/dom.js';
import { PLAYER_CHART_CATEGORIES, findCategory } from './player-chart-config.js';
import { mountPlayerRadar, createRadarAxes, createRadarScaleNote } from './player-radar-chart.js?v=scale-zoom';
import { mountPlayerTimeline } from './player-timeline-chart.js';

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
  const root = h('div', { class: 'metric-picks', 'aria-label': 'Metrics' });

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
  const metricWrap = h('div', { class: 'chart-control' }, ['Metrics']);
  const expectedToggle = h('label', { class: 'chart-toggle' }, [
    h('input', { type: 'checkbox' }),
    'Show Expected DPM',
  ]);

  let timelineChart;
  function syncMetrics(picks) {
    metricWrap.replaceChildren('Metrics', picks);
  }

  function mountPicks() {
    const picks = createMetricPicks(category.metrics, selectedIds, (ids) => {
      timelineChart?.update(selectedFields(category, new Set(ids)));
    });
    syncMetrics(picks);
  }

  const timeline = createPanel({
    index: 'VIZ 01',
    title: 'Performance over time',
    vizId: 'player-timeline',
    stageClass: 'player-timeline-stage',
    chromeClass: 'player-viz-chrome--stacked',
    controls: h('div', { class: 'chart-controls' }, [
      h('label', { class: 'chart-control' }, ['Category', categorySelect]),
      metricWrap,
    ]),
  });

  const radarAxes = createRadarAxes(players);
  const radar = createPanel({
    index: 'VIZ 02',
    title: 'Player profile',
    vizId: 'player-radar',
    stageClass: 'player-radar-stage',
    controls: h('div', { class: 'chart-controls' }, [
      expectedToggle,
      h('div', { class: 'radar-zoom-controls', role: 'group', 'aria-label': 'Radar scale zoom' }, [
        h('button', { class: 'radar-zoom-btn', type: 'button', 'aria-label': 'Tighten scale', dataset: { zoom: 'in' } }, ['+']),
        h('button', { class: 'radar-zoom-btn', type: 'button', 'aria-label': 'Widen scale', dataset: { zoom: 'out' } }, ['−']),
        h('button', { class: 'radar-zoom-btn', type: 'button', 'aria-label': 'Reset scale', dataset: { zoom: 'reset' } }, ['Reset']),
      ]),
    ]),
  });
  const scaleNoteHost = h('div', { class: 'radar-scale-note-host' });
  const zoomInBtn = radar.node.querySelector('[data-zoom="in"]');
  const zoomOutBtn = radar.node.querySelector('[data-zoom="out"]');
  const renderScaleNote = (span = 1, floor = 0.25) => {
    scaleNoteHost.replaceChildren(createRadarScaleNote(radarAxes, span));
    if (zoomInBtn) zoomInBtn.disabled = span <= floor + 1e-9;
    if (zoomOutBtn) zoomOutBtn.disabled = span >= 1 - 1e-9;
  };
  renderScaleNote();
  radar.node.append(scaleNoteHost);

  const expectedInput = expectedToggle.querySelector('input');
  const expected = player.stats?.mean_expected_dpm;
  if (expected == null || !Number.isFinite(expected)) {
    expectedInput.disabled = true;
    expectedToggle.classList.add('is-disabled');
  } else {
    expectedInput.checked = true;
  }

  const root = h('div', { class: 'viz-grid player-viz-grid' }, [timeline.node, radar.node]);
  mountPicks();

  queueMicrotask(() => {
    timelineChart = mountPlayerTimeline(timeline.stage, { games });
    const radarChart = mountPlayerRadar(radar.stage, {
      stats: player.stats ?? {},
      axes: radarAxes,
      onSpanChange: renderScaleNote,
    });
    timelineChart.update(selectedFields(category, selectedIds));
    if (expectedInput.checked) radarChart.setExpected(true);

    radar.node.querySelector('[data-zoom="in"]')?.addEventListener('click', () => radarChart.zoomIn());
    radar.node.querySelector('[data-zoom="out"]')?.addEventListener('click', () => radarChart.zoomOut());
    radar.node.querySelector('[data-zoom="reset"]')?.addEventListener('click', () => radarChart.resetZoom());

    categorySelect.addEventListener('change', () => {
      category = findCategory(categorySelect.value);
      selectedIds.clear();
      const defaults = category.id === 'dpm' ? category.metrics : [category.metrics[0]];
      for (const metric of defaults) selectedIds.add(metric.id);
      mountPicks();
      timelineChart.update(selectedFields(category, selectedIds));
    });
    expectedInput.addEventListener('change', (event) => {
      radarChart.setExpected(event.target.checked);
    });
  });

  return root;
}
