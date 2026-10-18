import { CHART_MIN_HEIGHT, CHART_MIN_WIDTH } from '../../utils/chart-layout.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCount, formatImpact, formatPercent, formatRole } from '../../utils/formatting.js';
import { PLACEHOLDER } from '../../utils/constants.js';
import { t } from '../../utils/i18n.js';
import { createTooltipWatch } from '../../utils/track.js';
import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';
import { PAIR_HEATMAP_COLORS } from './pair-impact-scale.js';

const SPLIT_PLAYER_COUNT = 5;
const LABEL_WIDTH_MAX = 108;
const LABEL_WIDTH_MIN = 72;
const LABEL_WIDTH_RATIO = 0.22;
const LABEL_HEIGHT = 72;
const LEGEND_GUTTER_SPLIT = 64;
const LEGEND_GUTTER = 28;
const LEGEND_GUTTER_NONE = 8;
const SPLIT_MIN_SIZE = 160;
const SPLIT_HEIGHT_PAD = 12;
const COMPACT_HEIGHT_PAD = 8;
const LEGEND_WIDTH = 12;
const ORIGIN_Y = 6;
const CELL_TEXT_MIN = 34;
const CELL_DETAIL_MIN = 46;
const CELL_LABEL_LIFT = 6;
const CELL_COUNT_DROP = 8;
const TICK_GAP = 8;
const COLUMN_LABEL_DROP = 10;
const COLUMN_LABEL_ANGLE = -48;
const CELL_INSET = 1;
const CELL_GAP = 2;
const CELL_RADIUS = 2;
const EMPTY_CELL_FILL = 'rgba(18, 28, 46, 0.92)';
const LABEL_CONTRAST = 0.65;
const LEGEND_GAP = 8;
const LEGEND_TICK_GAP = 4;
const SHARED_LEGEND_WIDTH = 600;
const SHARED_LEGEND_HEIGHT = 12;
const SHARED_LEGEND_STOP = 50;
const GRADIENT_START = '0%';
const GRADIENT_MID = '50%';
const GRADIENT_END = '100%';

function playerLabel(player) {
  const role = player.role ? formatRole(player.role) : PLACEHOLDER;
  return `${player.name} · ${role}`;
}

function hasScore(cell) {
  return cell.value != null && Number.isFinite(cell.value);
}

function colorScale(limit) {
  return d3
    .scaleLinear()
    .domain([-limit, 0, limit])
    .range(PAIR_HEATMAP_COLORS)
    .clamp(true);
}

function kindCopy(kind) {
  if (kind === 'self') return t('heat.self');
  if (kind === 'missing') return t('heat.missing');
  if (kind === 'sparse') return t('heat.sparse');
  return t('heat.eligible');
}

function idleDetail() {
  return [
    h('div', { class: 'heatmap-detail__title coord' }, [t('heat.inspect')]),
    h('p', { class: 'heatmap-detail__lead' }, [t('heat.hover')]),
    h('p', { class: 'heatmap-detail__note' }, [t('heat.scale')]),
  ];
}

function detailRows(cell) {
  const pair = cell.pair;
  const stats = pair?.stats ?? {};
  const interval =
    stats.ci_low != null && stats.ci_high != null
      ? `${formatImpact(stats.ci_low)} – ${formatImpact(stats.ci_high)}`
      : t('heat.unavailable');

  return [
    { label: t('lineup.gamesTogether'), value: pair ? formatCount(stats.n_games) : PLACEHOLDER },
    { label: t('heat.matchDays'), value: pair ? formatCount(stats.n_days) : PLACEHOLDER },
    { label: t('common.winRate'), value: pair ? formatPercent(stats.win_rate) : PLACEHOLDER },
    { label: t('common.meanImpact'), value: pair ? formatImpact(stats.mean_impact) : PLACEHOLDER },
    { label: t('common.shrunkImpact'), value: pair ? formatImpact(stats.shrunk_impact) : PLACEHOLDER },
    { label: t('heat.interval'), value: pair ? interval : PLACEHOLDER },
  ];
}

function renderDetail(detail, cell, players) {
  if (!cell) {
    detail.replaceChildren(...idleDetail());
    return;
  }
  const row = players[cell.row];
  const col = players[cell.col];
  detail.replaceChildren(
    h('div', { class: 'heatmap-detail__title coord' }, [
      cell.kind === 'self' || cell.kind === 'missing' ? t('heat.unavailableCell') : t('heat.pair'),
    ]),
    h('p', { class: 'heatmap-detail__pair' }, [`${playerLabel(row)}  ×  ${playerLabel(col)}`]),
    h('p', { class: 'heatmap-detail__lead' }, [kindCopy(cell.kind)]),
    h(
      'dl',
      { class: 'heatmap-detail__list' },
      detailRows(cell).map((rowItem) =>
        h('div', { class: 'heatmap-detail__row' }, [
          h('dt', {}, [rowItem.label]),
          h('dd', {}, [rowItem.value]),
        ]),
      ),
    ),
    h('p', { class: 'heatmap-detail__note' }, [
      t('heat.scoreNote'),
    ]),
  );
}

let heatmapSerial = 0;

export function createSharedPairHeatmapLegend(limit) {
  const gradientId = `heatmap-shared-scale-${heatmapSerial += 1}`;
  const strip = d3.create('svg')
    .attr('class', 'heatmap-shared-legend__strip')
    .attr('viewBox', `0 0 ${SHARED_LEGEND_WIDTH} ${SHARED_LEGEND_HEIGHT}`)
    .attr('preserveAspectRatio', 'none')
    .attr('aria-hidden', 'true');
  const gradient = strip.append('defs').append('linearGradient')
    .attr('id', gradientId).attr('color-interpolation', 'sRGB');
  PAIR_HEATMAP_COLORS.forEach((color, index) => {
    gradient.append('stop').attr('offset', `${index * SHARED_LEGEND_STOP}%`).attr('stop-color', color);
  });
  strip.append('rect').attr('width', SHARED_LEGEND_WIDTH).attr('height', SHARED_LEGEND_HEIGHT).attr('fill', `url(#${gradientId})`);

  return h('figure', { class: 'heatmap-shared-legend panel', dataset: { colorLimit: limit } }, [
    h('figcaption', { class: 'heatmap-shared-legend__title' }, [t('heat.sharedScale')]),
    strip.node(),
    h('div', { class: 'heatmap-shared-legend__ticks' }, [
      h('span', {}, [formatImpact(-limit)]),
      h('span', {}, ['0']),
      h('span', {}, [formatImpact(limit)]),
    ]),
    h('p', { class: 'heatmap-shared-legend__note' }, [t('heat.sharedScaleNote')]),
  ]);
}

export function createPairHeatmapPanel({ heatmap, selectedIds = [], teamName, onInspect, bind, colorLimit, showLegend = true }) {
  const { players, hasEligiblePair } = heatmap;
  const stage = h('div', { class: 'viz-stage pair-heatmap-stage', role: 'presentation' });
  const detail = h('div', { class: 'heatmap-detail', 'aria-live': 'polite' });
  renderDetail(detail, null, players);
  const split = players.length > 5;

  const node = h('article', { class: 'viz-placeholder panel pair-heatmap-panel', dataset: { viz: 'pair-impact' } }, [
    h('div', { class: 'viz-placeholder__chrome' }, [
      h('span', {}, [t('common.viz')]),
      h('span', {}, [teamName ? t('heat.titleTeam', { team: teamName }) : t('heat.title')]),
    ]),
    h('div', { class: split ? 'pair-heatmap-stack is-split' : 'pair-heatmap-stack' }, [
      createEligibilityNotice(hasEligiblePair, 'pair'),
      stage,
      detail,
    ]),
  ]);

  queueMicrotask(() => {
    if (!stage.isConnected) return;
    const api = mountPairHeatmap(stage, detail, { heatmap, selectedIds, onInspect, colorLimit, showLegend });
    bind?.(api);
  });

  return node;
}

export function mountPairHeatmap(stage, detail, { heatmap, selectedIds = [], onInspect, colorLimit, showLegend = true } = {}) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const { players, cells } = heatmap;
  const limit = colorLimit ?? heatmap.limit;
  stage.dataset.colorLimit = String(limit);
  const tooltipWatch = createTooltipWatch('pair-impact');
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text(t('heat.svg'));
  stage.append(svg.node());

  const selected = new Set(selectedIds);
  const n = players.length;
  const fill = colorScale(limit);

  let pinned = null;
  let hovered = null;
  let drawnWidth = -1;
  const gradientId = `heatmap-scale-${heatmapSerial += 1}`;
  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

  function findCell(row, col) {
    if (row == null || col == null) return null;
    return cells.find((cell) => cell.row === row && cell.col === col) ?? null;
  }

  function activeCell() {
    return hovered ?? pinned;
  }

  function syncDetail() {
    renderDetail(detail, activeCell(), players);
  }

  function applyActive() {
    const active = activeCell();
    svg.selectAll('.heatmap-cell').each(function apply(cell) {
      const node = d3.select(this);
      const on = Boolean(active && cell.row === active.row && cell.col === active.col);
      const isPinned = Boolean(pinned && cell.row === pinned.row && cell.col === pinned.col);
      node.classed('is-active', on);
      node.attr('aria-pressed', isPinned ? 'true' : 'false');
    });
  }

  function publish() {
    onInspect?.({
      row: hovered?.row ?? null,
      col: hovered?.col ?? null,
      pinnedRow: pinned?.row ?? null,
      pinnedCol: pinned?.col ?? null,
    });
  }

  function selectCell(cell) {
    hovered = cell;
    syncDetail();
    applyActive();
    publish();
  }

  function clearHover() {
    hovered = null;
    tooltipWatch.hide();
    syncDetail();
    applyActive();
    publish();
  }

  function togglePin(cell) {
    pinned = pinned && pinned.row === cell.row && pinned.col === cell.col ? null : cell;
    syncDetail();
    applyActive();
    publish();
  }

  function highlight(state) {
    pinned = findCell(state?.pinnedRow, state?.pinnedCol);
    hovered = findCell(state?.row, state?.col);
    syncDetail();
    applyActive();
  }

  function draw() {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    const width = stage.clientWidth;
    if (width < CHART_MIN_WIDTH || width === drawnWidth) return;
    drawnWidth = width;
    const split = n > SPLIT_PLAYER_COUNT;
    const labelW = Math.min(LABEL_WIDTH_MAX, Math.max(LABEL_WIDTH_MIN, width * LABEL_WIDTH_RATIO));
    const labelH = LABEL_HEIGHT;
    const legendGutter = showLegend ? (split ? LEGEND_GUTTER_SPLIT : LEGEND_GUTTER) : LEGEND_GUTTER_NONE;
    const size = split
      ? Math.max(SPLIT_MIN_SIZE, width - labelW - legendGutter)
      : Math.min(width - labelW - legendGutter, Math.max(stage.clientHeight, CHART_MIN_HEIGHT) - labelH - COMPACT_HEIGHT_PAD);
    const height = split ? size + labelH + SPLIT_HEIGHT_PAD : Math.max(stage.clientHeight, CHART_MIN_HEIGHT);
    if (split) stage.style.height = `${height}px`;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    svg.append('title').text(t('heat.svg'));

    if (!n) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text(t('heat.empty'));
      return;
    }

    const legendW = LEGEND_WIDTH;
    const originX = labelW;
    const originY = ORIGIN_Y;
    const cellSize = size / n;
    const showCellText = cellSize >= CELL_TEXT_MIN;
    const root = svg.append('g');

    players.forEach((player, index) => {
      const isSelected = selected.has(player.id);
      root.append('text')
        .attr('class', isSelected ? 'heatmap-tick heatmap-tick--selected' : 'heatmap-tick')
        .attr('x', originX - TICK_GAP)
        .attr('y', originY + (index + 0.5) * cellSize)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .text(playerLabel(player));
      root.append('text')
        .attr('class', isSelected ? 'heatmap-tick heatmap-tick--selected' : 'heatmap-tick')
        .attr('transform', `translate(${originX + (index + 0.5) * cellSize}, ${originY + size + COLUMN_LABEL_DROP}) rotate(${COLUMN_LABEL_ANGLE})`)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'hanging')
        .text(playerLabel(player));
    });

    root
      .append('g')
      .selectAll('rect')
      .data(cells)
      .join('rect')
      .attr('class', (cell) => `heatmap-cell heatmap-cell--${cell.kind}`)
      .attr('x', (cell) => originX + cell.col * cellSize + CELL_INSET)
      .attr('y', (cell) => originY + cell.row * cellSize + CELL_INSET)
      .attr('width', Math.max(0, cellSize - CELL_GAP))
      .attr('height', Math.max(0, cellSize - CELL_GAP))
      .attr('rx', CELL_RADIUS)
      .attr('fill', (cell) => (hasScore(cell) ? fill(cell.value) : EMPTY_CELL_FILL))
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-pressed', 'false')
      .attr(
        'aria-label',
        (cell) => t('heat.cell', {
          row: playerLabel(players[cell.row]),
          col: playerLabel(players[cell.col]),
          kind: kindCopy(cell.kind),
        }),
      )
      .on('mouseenter', (_, cell) => {
        selectCell(cell);
        const ids = [players[cell.row]?.id, players[cell.col]?.id].filter(Boolean).sort();
        tooltipWatch.show(ids.join('|'));
      })
      .on('mouseleave', (event) => {
        if (event.relatedTarget && stage.contains(event.relatedTarget)) return;
        clearHover();
      })
      .on('focus', (_, cell) => selectCell(cell))
      .on('blur', clearHover)
      .on('click', (_, cell) => togglePin(cell))
      .on('keydown', (event, cell) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          togglePin(cell);
        }
      });

    cells.forEach((cell) => {
      const x = originX + cell.col * cellSize;
      const y = originY + cell.row * cellSize;
      if (showCellText && hasScore(cell)) {
        const abs = Math.abs(cell.value);
        root.append('text')
          .attr('class', abs > LABEL_CONTRAST * limit ? 'heatmap-cell-label heatmap-cell-label--on' : 'heatmap-cell-label')
          .attr('pointer-events', 'none')
          .attr('x', x + cellSize / 2)
          .attr('y', y + cellSize / 2 - (cellSize >= CELL_DETAIL_MIN ? CELL_LABEL_LIFT : 0))
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(formatImpact(cell.value));
        if (cellSize >= CELL_DETAIL_MIN) {
          root.append('text')
            .attr('class', abs > LABEL_CONTRAST * limit ? 'heatmap-cell-label heatmap-cell-label--on' : 'heatmap-cell-label')
            .attr('pointer-events', 'none')
            .attr('x', x + cellSize / 2)
            .attr('y', y + cellSize / 2 + CELL_COUNT_DROP)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .text(`n=${formatCount(cell.pair.stats.n_games)}`);
        }
      }
    });
    applyActive();

    if (!showLegend) return;

    const legendX = originX + size + LEGEND_GAP;
    const legendY = originY;
    const legendH = size;
    const legendScale = d3.scaleLinear().domain([limit, -limit]).range([legendY, legendY + legendH]);
    const ticks = [limit, 0, -limit];
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient').attr('id', gradientId).attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    gradient.append('stop').attr('offset', GRADIENT_START).attr('stop-color', fill(limit));
    gradient.append('stop').attr('offset', GRADIENT_MID).attr('stop-color', fill(0));
    gradient.append('stop').attr('offset', GRADIENT_END).attr('stop-color', fill(-limit));
    root.append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendW)
      .attr('height', legendH)
      .attr('fill', `url(#${gradientId})`);
    ticks.forEach((tick) => {
      root.append('text')
        .attr('class', 'heatmap-legend-tick')
        .attr('x', legendX + legendW + LEGEND_TICK_GAP)
        .attr('y', legendScale(tick))
        .attr('dominant-baseline', tick === limit ? 'hanging' : tick === -limit ? 'auto' : 'middle')
        .text(formatImpact(tick));
    });
  }

  draw();
  return {
    highlight,
    destroy() {
      observer.disconnect();
    },
  };
}
