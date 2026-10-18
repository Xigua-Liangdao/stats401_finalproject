import { FULL_SPAN, SPAN_EPSILON } from '../../utils/chart-layout.js';
import { ROLE_COLORS, ROLE_ORDER } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { formatPercent, formatRole } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { trackUi } from '../../utils/track.js';
import { mountLineupShareScatter } from './lineup-share-scatter.js';

function createShareLegend() {
  return h('div', { class: 'share-legend', 'aria-label': t('lineup.colorRole') }, [
    h('div', { class: 'share-legend__kicker' }, [t('common.role')]),
    h(
      'div',
      { class: 'share-legend__roles' },
      ROLE_ORDER.map((role) =>
        h('div', { class: 'share-legend__role' }, [
          h('span', {
            class: 'share-legend__swatch',
            style: { background: ROLE_COLORS[role] },
          }),
          h('span', { class: 'share-legend__caption' }, [formatRole(role)]),
        ]),
      ),
    ),
  ]);
}

export function createLineupShareScatterPanel({ games = [], playback }) {
  const stage = h('div', { class: 'viz-stage lineup-share-stage', role: 'presentation' });
  const rangeLabel = h('span', { class: 'lineup-share-zoom__range' }, ['0–100%']);
  const zoomInBtn = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-label': t('lineup.tighten'), dataset: { zoom: 'in' },
  }, ['+']);
  const zoomOutBtn = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-label': t('lineup.widen'), dataset: { zoom: 'out' },
  }, ['−']);
  const resetBtn = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-label': t('lineup.resetScale'), dataset: { zoom: 'reset' },
  }, [t('lineup.reset')]);
  const visibleRoles = new Set(ROLE_ORDER);
  let chart = null;
  const roleFilters = h(
    'div',
    { class: 'lineup-role-filters', role: 'group', 'aria-label': t('lineup.rolesShown') },
    ROLE_ORDER.map((role) => {
      const input = h('input', { type: 'checkbox' });
      input.checked = true;
      const label = h('label', { class: 'lineup-role-filter is-on' }, [
        input,
        h('span', { class: 'lineup-role-filter__swatch', style: { background: ROLE_COLORS[role] } }),
        formatRole(role),
      ]);
      input.addEventListener('change', () => {
        const to = input.checked;
        if (to) visibleRoles.add(role);
        else visibleRoles.delete(role);
        label.classList.toggle('is-on', to);
        chart?.setVisibleRoles();
        trackUi({
          event_name: 'filter_change',
          target_type: 'role_filter',
          target_id: `lineup-share-scatter|${role}`,
          metadata: { from: !to, to },
        });
      });
      return label;
    }),
  );
  const node = h('article', { class: 'viz-placeholder panel lineup-share-panel', dataset: { viz: 'lineup-share-scatter' } }, [
    h('div', { class: 'viz-placeholder__chrome' }, [
      h('div', { class: 'lineup-share-heading' }, [
        h('span', {}, [t('lineup.vizMark')]),
        h('span', {}, [t('lineup.vizGold')]),
      ]),
      h('div', { class: 'lineup-share-zoom' }, [
        rangeLabel,
        h('div', { class: 'radar-zoom-controls', role: 'group', 'aria-label': t('lineup.axisScale') }, [
          zoomInBtn,
          zoomOutBtn,
          resetBtn,
        ]),
      ]),
    ]),
    roleFilters,
    stage,
    createShareLegend(),
  ]);

  const syncZoom = (span, floor, start, end) => {
    rangeLabel.textContent = `${formatPercent(start)}–${formatPercent(end)}`;
    zoomInBtn.disabled = span <= floor + SPAN_EPSILON;
    zoomOutBtn.disabled = span >= FULL_SPAN - SPAN_EPSILON;
    resetBtn.disabled = span >= FULL_SPAN - SPAN_EPSILON;
  };

  queueMicrotask(() => {
    chart = mountLineupShareScatter(stage, { games, playback, onSpanChange: syncZoom, visibleRoles });
    zoomInBtn.addEventListener('click', () => {
      trackUi({ event_name: 'click', target_type: 'chart_zoom', target_id: 'lineup-share-scatter|in' });
      chart.zoomIn();
    });
    zoomOutBtn.addEventListener('click', () => {
      trackUi({ event_name: 'click', target_type: 'chart_zoom', target_id: 'lineup-share-scatter|out' });
      chart.zoomOut();
    });
    resetBtn.addEventListener('click', () => {
      trackUi({ event_name: 'click', target_type: 'chart_zoom', target_id: 'lineup-share-scatter|reset' });
      chart.resetZoom();
    });
  });

  return node;
}
