import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCount, formatImpact, formatPercent, formatRole } from '../../utils/formatting.js';
import { PLACEHOLDER } from '../../utils/constants.js';
import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';

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
    .range(['#c35264', '#1c2a40', '#3ec8ff'])
    .clamp(true);
}

function kindCopy(kind) {
  if (kind === 'self') return 'Self-pair. Diagonal cells are not scores.';
  if (kind === 'missing') return 'No shared evaluated games in this snapshot.';
  if (kind === 'sparse') {
    return 'Score is computed, but this pair is below the default display rule (10 evaluated games and 3 match days). Shown for inspection only.';
  }
  return 'Eligible pair. Color encodes shrunk co-performance.';
}

function idleDetail() {
  return [
    h('div', { class: 'heatmap-detail__title coord' }, ['Inspect a cell']),
    h('p', { class: 'heatmap-detail__lead' }, [
      'Hover or focus a pair. Detail stays here instead of a floating label.',
    ]),
    h('p', { class: 'heatmap-detail__note' }, [
      'Color is shrunk co-performance on a fixed diverging scale centered at 0. Grey cells are self-pairs or pairs with no computed score (no shared evaluated games). Ineligible scores are still colored and labeled.',
    ]),
  ];
}

function detailRows(cell) {
  const pair = cell.pair;
  const stats = pair?.stats ?? {};
  const interval =
    stats.ci_low != null && stats.ci_high != null
      ? `${formatImpact(stats.ci_low)} – ${formatImpact(stats.ci_high)}`
      : 'Unavailable · needs 3 match days';

  return [
    { label: 'Games together', value: pair ? formatCount(stats.n_games) : PLACEHOLDER },
    { label: 'Match days', value: pair ? formatCount(stats.n_days) : PLACEHOLDER },
    { label: 'Win rate', value: pair ? formatPercent(stats.win_rate) : PLACEHOLDER },
    { label: 'Mean impact', value: pair ? formatImpact(stats.mean_impact) : PLACEHOLDER },
    { label: 'Shrunk impact', value: pair ? formatImpact(stats.shrunk_impact) : PLACEHOLDER },
    { label: '95% interval', value: pair ? interval : PLACEHOLDER },
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
      cell.kind === 'self' || cell.kind === 'missing' ? 'Unavailable cell' : 'Pair',
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
      'Score = mean of both players\' adjusted damage × n/(n+10). Shared match context can affect both players. This is descriptive co-performance, not causal synergy.',
    ]),
  );
}

export function createPairHeatmapPanel({ heatmap, selectedIds = [], teamName }) {
  const { players, hasEligiblePair } = heatmap;
  const stage = h('div', { class: 'viz-stage pair-heatmap-stage', role: 'presentation' });
  const detail = h('div', { class: 'heatmap-detail', 'aria-live': 'polite' });
  renderDetail(detail, null, players);

  const node = h('article', { class: 'viz-placeholder panel pair-heatmap-panel', dataset: { viz: 'pair-impact' } }, [
    h('div', { class: 'viz-placeholder__chrome' }, [
      h('span', {}, ['VIZ']),
      h('span', {}, [teamName ? `Teammate co-performance · ${teamName}` : 'Teammate co-performance']),
    ]),
    h('div', { class: 'pair-heatmap-stack' }, [
      createEligibilityNotice(hasEligiblePair, 'pair heatmap'),
      stage,
      detail,
    ]),
  ]);

  queueMicrotask(() => {
    mountPairHeatmap(stage, detail, { heatmap, selectedIds });
  });

  return node;
}

export function mountPairHeatmap(stage, detail, { heatmap, selectedIds = [] }) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const { players, cells, limit } = heatmap;
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text('Teammate co-performance heatmap');
  stage.append(svg.node());

  const selected = new Set(selectedIds);
  const n = players.length;
  const fill = colorScale(limit);

  let pinned = null;
  let hovered = null;
  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

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

  function selectCell(cell) {
    hovered = cell;
    syncDetail();
    applyActive();
  }

  function clearHover() {
    hovered = null;
    syncDetail();
    applyActive();
  }

  function togglePin(cell) {
    pinned = pinned && pinned.row === cell.row && pinned.col === cell.col ? null : cell;
    syncDetail();
    applyActive();
  }

  function draw() {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, 280);
    if (width < 40) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    svg.append('title').text('Teammate co-performance heatmap');

    if (!n) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('No teammates available for this heatmap.');
      return;
    }

    const labelW = Math.min(108, Math.max(72, width * 0.22));
    const labelH = 72;
    const legendW = 12;
    const padR = 28;
    const size = Math.min(width - labelW - padR, height - labelH - 8);
    const originX = labelW;
    const originY = 6;
    const cellSize = size / n;
    const showCellText = cellSize >= 34;
    const root = svg.append('g');

    players.forEach((player, index) => {
      const isSelected = selected.has(player.id);
      root.append('text')
        .attr('class', isSelected ? 'heatmap-tick heatmap-tick--selected' : 'heatmap-tick')
        .attr('x', originX - 8)
        .attr('y', originY + (index + 0.5) * cellSize)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .text(playerLabel(player));
      root.append('text')
        .attr('class', isSelected ? 'heatmap-tick heatmap-tick--selected' : 'heatmap-tick')
        .attr('transform', `translate(${originX + (index + 0.5) * cellSize}, ${originY + size + 10}) rotate(-48)`)
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
      .attr('x', (cell) => originX + cell.col * cellSize + 1)
      .attr('y', (cell) => originY + cell.row * cellSize + 1)
      .attr('width', Math.max(0, cellSize - 2))
      .attr('height', Math.max(0, cellSize - 2))
      .attr('rx', 2)
      .attr('fill', (cell) => (hasScore(cell) ? fill(cell.value) : 'rgba(18, 28, 46, 0.92)'))
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-pressed', 'false')
      .attr(
        'aria-label',
        (cell) => `${playerLabel(players[cell.row])} and ${playerLabel(players[cell.col])}. ${kindCopy(cell.kind)}`,
      )
      .on('mouseenter', (_, cell) => selectCell(cell))
      .on('mouseleave', clearHover)
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
          .attr('class', abs > 0.65 * limit ? 'heatmap-cell-label heatmap-cell-label--on' : 'heatmap-cell-label')
          .attr('pointer-events', 'none')
          .attr('x', x + cellSize / 2)
          .attr('y', y + cellSize / 2 - (cellSize >= 46 ? 6 : 0))
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(formatImpact(cell.value));
        if (cellSize >= 46) {
          root.append('text')
            .attr('class', abs > 0.65 * limit ? 'heatmap-cell-label heatmap-cell-label--on' : 'heatmap-cell-label')
            .attr('pointer-events', 'none')
            .attr('x', x + cellSize / 2)
            .attr('y', y + cellSize / 2 + 8)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .text(`n=${formatCount(cell.pair.stats.n_games)}`);
        }
      }
    });
    applyActive();

    const legendX = originX + size + 8;
    const legendY = originY;
    const legendH = size;
    const legendScale = d3.scaleLinear().domain([limit, -limit]).range([legendY, legendY + legendH]);
    const ticks = [limit, 0, -limit];
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient').attr('id', 'heatmap-scale').attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', fill(limit));
    gradient.append('stop').attr('offset', '50%').attr('stop-color', fill(0));
    gradient.append('stop').attr('offset', '100%').attr('stop-color', fill(-limit));
    root.append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendW)
      .attr('height', legendH)
      .attr('fill', 'url(#heatmap-scale)');
    ticks.forEach((tick) => {
      root.append('text')
        .attr('class', 'heatmap-legend-tick')
        .attr('x', legendX + legendW + 4)
        .attr('y', legendScale(tick))
        .attr('dominant-baseline', tick === limit ? 'hanging' : tick === -limit ? 'auto' : 'middle')
        .text(formatImpact(tick));
    });
  }

  draw();
  return {
    destroy() {
      observer.disconnect();
    },
  };
}
