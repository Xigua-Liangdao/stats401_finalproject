import { openLineupGameInfo } from '../lineup-games/lineup-game-info.js?v=game-stats';
import { ROLE_COLORS, ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatDate, formatPercent, formatRole } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { createGameMark } from './lineup-range-dock.js';
import { mixValue, roleValue } from './lineup-playback.js';

const SPAN_STEP = 0.1;
const MIN_SPAN = 0.4;
const DOT_RADIUS = 5.6;
const SHARE_ORIGIN_STEP = 0.05;

function shareOrigin(minValue, step = SHARE_ORIGIN_STEP) {
  if (!Number.isFinite(minValue) || minValue <= step) return 0;
  const snapped = Math.floor((minValue - 1e-6) / step) * step;
  const origin = minValue - snapped < step * 0.2 ? snapped - step : snapped;
  return Math.max(0, Number(origin.toFixed(4)));
}

function snapSpan(span) {
  return Number((Math.round(span / SPAN_STEP) * SPAN_STEP).toFixed(2));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sharePoints(games) {
  const points = [];
  for (const game of games) {
    for (const role of ROLE_ORDER) {
      const goldShare = roleValue(game, role, 'gold_share');
      const damageShare = roleValue(game, role, 'damage_share');
      if (goldShare == null || damageShare == null) continue;
      points.push({ goldShare, damageShare });
    }
  }
  return points;
}

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
        if (input.checked) visibleRoles.add(role);
        else visibleRoles.delete(role);
        label.classList.toggle('is-on', input.checked);
        chart?.setVisibleRoles();
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
    zoomInBtn.disabled = span <= floor + 1e-9;
    zoomOutBtn.disabled = span >= 1 - 1e-9;
    resetBtn.disabled = span >= 1 - 1e-9;
  };

  queueMicrotask(() => {
    chart = mountLineupShareScatter(stage, { games, playback, onSpanChange: syncZoom, visibleRoles });
    zoomInBtn.addEventListener('click', () => chart.zoomIn());
    zoomOutBtn.addEventListener('click', () => chart.zoomOut());
    resetBtn.addEventListener('click', () => chart.resetZoom());
  });

  return node;
}

function gameTip(game) {
  return `<div class="lineup-tip-game">${createGameMark(game).outerHTML}<span>${formatDate(game.date)}</span></div>`;
}

export function mountLineupShareScatter(stage, { games = [], playback, onSpanChange, visibleRoles = new Set(ROLE_ORDER) } = {}) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const ordered = playback?.games ?? games;
  const points = sharePoints(ordered);
  const dataMax = Math.max(0.2, d3.max(points, (point) => point.goldShare) ?? 0.2);
  const xOrigin = shareOrigin(d3.min(points, (point) => point.goldShare));
  const fullMax = d3.scaleLinear().domain([0, dataMax]).nice().domain()[1];
  const fullSpan = Math.max(SHARE_ORIGIN_STEP, fullMax - xOrigin);
  const floor = points.length ? MIN_SPAN : 1;
  const desktopMargin = { top: 18, right: 18, bottom: 44, left: 58 };
  let margin = { ...desktopMargin };
  let span = 1;
  let xStart = xOrigin;
  let plotWidth = 1;
  let panning = false;
  let panStartX = 0;
  let lastPanX = 0;
  let suppressClick = false;
  let frameState = null;
  let paintKey = '';
  let x = null;
  let y = null;

  const plotHost = h('div', { class: 'lineup-share-plot' });
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text(t('lineup.oneGame'));
  plotHost.append(svg.node(), tooltip);
  stage.append(plotHost);
  const svgNode = svg.node();

  svgNode.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || span >= 1 - 1e-9 || !points.length) return;
    const localX = event.clientX - svgNode.getBoundingClientRect().left;
    if (localX < margin.left || localX > margin.left + plotWidth) return;
    panning = true;
    panStartX = event.clientX;
    lastPanX = event.clientX;
    hideTip();
    svgNode.setPointerCapture(event.pointerId);
    stage.classList.add('is-panning');
  });
  svgNode.addEventListener('pointermove', (event) => {
    if (!panning) return;
    const dx = event.clientX - lastPanX;
    lastPanX = event.clientX;
    if (!dx || plotWidth <= 0) return;
    xStart = clampStart(xStart - (dx / plotWidth) * windowWidth());
    layout();
  });
  svgNode.addEventListener('pointerup', (event) => {
    if (!panning) return;
    const moved = Math.abs(event.clientX - panStartX) > 4;
    panning = false;
    stage.classList.remove('is-panning');
    if (moved) {
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
  });
  svgNode.addEventListener('pointercancel', () => {
    panning = false;
    stage.classList.remove('is-panning');
  });

  const observer = new ResizeObserver(() => layout());
  observer.observe(plotHost);

  function windowWidth() {
    return fullSpan * span;
  }

  function clampStart(start) {
    return clamp(start, xOrigin, Math.max(xOrigin, fullMax - windowWidth()));
  }

  function setSpan(next) {
    const clamped = Math.min(1, Math.max(floor, snapSpan(next)));
    if (clamped !== span) {
      const center = xStart + windowWidth() / 2;
      span = clamped;
      xStart = clampStart(center - windowWidth() / 2);
      layout();
    }
    return span;
  }

  function hideTip() {
    tooltip.hidden = true;
  }

  function currentGame() {
    if (!frameState) return ordered[0] ?? null;
    return frameState.games[frameState.landed ?? frameState.index] ?? ordered[0] ?? null;
  }

  function showTip(event, role) {
    const game = currentGame();
    const slot = game?.roles?.[role];
    if (!game || !slot) return;
    const opponent = game.opponent?.name ?? game.opponent?.short;
    tooltip.innerHTML = [
      `<div>${slot.name ?? slot.id} · ${formatRole(role)}</div>`,
      gameTip(game),
      opponent ? `<div>${t('lineup.vs', { name: opponent })}</div>` : null,
      `<div>${t('lineup.tipShare', { label: t('common.goldShare'), value: formatPercent(roleValue(game, role, 'gold_share')) })}</div>`,
      `<div>${t('lineup.tipShare', { label: t('common.damageShare'), value: formatPercent(roleValue(game, role, 'damage_share')) })}</div>`,
    ].filter(Boolean).join('');
    tooltip.hidden = false;
    const bounds = plotHost.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 12, bounds.width - 180)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 12)}px`;
  }

  function rotatedBox(text, { fontSize, anchor, axis = false }) {
    const host = svg.append('g').attr('class', axis ? 'chart-axis' : null).style('visibility', 'hidden');
    const probe = host.append('text')
      .attr('class', axis ? null : 'chart-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', anchor)
      .attr('x', 0)
      .attr('y', 0)
      .style('font-size', `${fontSize}px`)
      .text(text);
    const box = probe.node().getBoundingClientRect();
    const origin = svg.node().getBoundingClientRect().left;
    host.remove();
    return { width: box.width, right: box.right - origin, left: origin - box.left };
  }

  function compactYAxis(scale) {
    const axis = d3.axisLeft(scale).ticks(5).tickFormat((value) => formatPercent(value)).tickSizeOuter(0);
    if (!window.matchMedia('(max-width: 640px)').matches) {
      return { left: desktopMargin.left, offset: -44, font: null, rotateTicks: false, axis };
    }
    const font = 9;
    const tickSize = 3;
    const titleGap = 3;
    const pad = 2;
    axis.tickPadding(2).tickSizeInner(tickSize);
    const tickBox = scale.ticks(5)
      .map((value) => rotatedBox(formatPercent(value), { fontSize: font, anchor: 'middle', axis: true }))
      .reduce((widest, box) => (box.width > widest.width ? box : widest), { width: 0, right: 0, left: 0 });
    const titleBox = rotatedBox(t('common.damageShare'), { fontSize: font, anchor: 'end' });
    const axisGap = tickSize + 2;
    const tickY = -(axisGap + tickBox.right);
    const offset = -(axisGap + tickBox.width + titleGap + titleBox.right);
    const left = Math.ceil(-(offset - titleBox.left) + pad);
    return { left, offset, tickY, font, rotateTicks: true, axis };
  }

  function xTickValues(scale) {
    const [start, end] = scale.domain();
    const generated = scale.ticks(5);
    if (start <= 1e-6) return generated;
    const values = [start];
    generated.forEach((value) => {
      if (value <= start + 1e-6 || value >= end - 1e-6) return;
      const previous = values[values.length - 1];
      if (Math.abs(scale(value) - scale(previous)) >= 44) values.push(value);
    });
    const last = values[values.length - 1];
    if (Math.abs(scale(end) - scale(last)) < 44) values[values.length - 1] = end;
    else values.push(end);
    return values;
  }

  function layout() {
    if (!plotHost.isConnected) {
      observer.disconnect();
      playback?.destroy();
      return;
    }
    const width = plotHost.clientWidth;
    const height = Math.max(plotHost.clientHeight, 280);
    if (width < 40) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    svg.append('title').text(t('lineup.oneGame'));

    if (!points.length) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text(t('lineup.noShareGames'));
      onSpanChange?.(1, 1, 0, fullMax);
      stage.classList.remove('is-zoomed');
      return;
    }

    const yMax = Math.max(0.2, d3.max(points, (point) => point.damageShare));
    const innerHeight = height - margin.top - margin.bottom;
    y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);
    const yTitle = compactYAxis(y);
    margin = { ...desktopMargin, left: yTitle.left };
    const innerWidth = Math.max(40, width - margin.left - margin.right);
    plotWidth = innerWidth;
    xStart = clampStart(xStart);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    x = d3.scaleLinear().domain([xStart, xStart + windowWidth()]).range([0, innerWidth]);

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => ''))
      .select('.domain')
      .remove();
    plot.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickValues(xTickValues(x)).tickFormat((value) => formatPercent(value)).tickSizeOuter(0));
    plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('x', innerWidth)
      .attr('y', innerHeight + 32)
      .attr('text-anchor', 'end')
      .text(t('common.goldShare'));
    const yLabel = plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', 0)
      .attr('y', yTitle.offset)
      .attr('text-anchor', 'end')
      .text(t('common.damageShare'));
    if (yTitle.font) yLabel.style('font-size', `${yTitle.font}px`);

    const clipId = `lineup-share-clip-${Math.round(innerWidth)}-${Math.round(innerHeight)}`;
    svg.append('clipPath').attr('id', clipId).append('rect').attr('width', innerWidth).attr('height', innerHeight);
    plot.append('g').attr('class', 'share-dots').attr('clip-path', `url(#${clipId})`);
    paintKey = '';

    const yAxis = plot.append('g')
      .attr('class', 'chart-axis chart-axis--y')
      .call(yTitle.axis);
    if (yTitle.font) yAxis.selectAll('text').style('font-size', `${yTitle.font}px`);
    if (yTitle.rotateTicks) {
      yAxis.selectAll('text')
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle')
        .attr('x', 0)
        .attr('dx', null)
        .attr('dy', null)
        .attr('y', yTitle.tickY);
      const xTop = Math.min(...plot.selectAll('.chart-axis:not(.chart-axis--y) .tick text').nodes()
        .map((node) => node.getBoundingClientRect().top));
      yAxis.selectAll('text').each(function liftClear() {
        const overlap = this.getBoundingClientRect().bottom - xTop + 6;
        if (overlap > 0) this.setAttribute('x', overlap);
      });
    }

    onSpanChange?.(span, floor, xStart, xStart + windowWidth());
    stage.classList.toggle('is-zoomed', span < 1 - 1e-9);
    paint(frameState);
  }

  function pointsInRange(state) {
    const slice = state.games.slice(state.from, state.to + 1);
    const last = Math.max(1, slice.length - 1);
    const cloud = [];
    slice.forEach((game, index) => {
      const recency = slice.length === 1 ? 1 : index / last;
      for (const role of ROLE_ORDER) {
        if (!visibleRoles.has(role)) continue;
        const gold = roleValue(game, role, 'gold_share');
        const damage = roleValue(game, role, 'damage_share');
        if (gold == null || damage == null) continue;
        cloud.push({
          game,
          role,
          gold,
          damage,
          recency,
          name: game.roles?.[role]?.name,
        });
      }
    });
    return cloud;
  }

  function paint(state) {
    frameState = state;
    if (!x || !y || !state) return;
    const layer = svg.select('.share-dots');
    if (layer.empty()) return;
    const roles = ROLE_ORDER.filter((role) => visibleRoles.has(role)).join(',');
    const key = state.mode === 'static' ? `static:${state.from}:${state.to}:${roles}` : `dynamic:${roles}`;
    if (key !== paintKey) {
      layer.selectAll('*').remove();
      paintKey = key;
      if (state.mode === 'static') buildStatic(layer, state);
      else buildDynamic(layer);
    }
    if (state.mode === 'dynamic') updateDynamic(layer, state);
  }

  function buildStatic(layer, state) {
    layer.selectAll('.share-dot')
      .data(pointsInRange(state), (point) => `${point.game.id}|${point.role}`)
      .join('circle')
      .attr('class', 'share-dot')
      .attr('cx', (point) => x(point.gold))
      .attr('cy', (point) => y(point.damage))
      .attr('r', (point) => 2.8 + point.recency * 6.2)
      .attr('fill', (point) => ROLE_COLORS[point.role] ?? '#7adfff')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (point) => `${point.name ?? point.role}, ${formatRole(point.role)}, ${formatDate(point.game.date)}`)
      .on('mousemove', (event, point) => {
        layer.selectAll('.share-dot').classed('is-linked', (item) => item.game.id === point.game.id);
        const opponent = point.game.opponent?.name ?? point.game.opponent?.short;
        tooltip.innerHTML = [
          `<div>${point.name ?? point.role} · ${formatRole(point.role)}</div>`,
          gameTip(point.game),
          opponent ? `<div>vs ${opponent}</div>` : null,
          `<div>Gold share: ${formatPercent(point.gold)}</div>`,
          `<div>Damage share: ${formatPercent(point.damage)}</div>`,
        ].filter(Boolean).join('');
        tooltip.hidden = false;
        const bounds = plotHost.getBoundingClientRect();
        tooltip.style.left = `${Math.min(event.clientX - bounds.left + 12, bounds.width - 180)}px`;
        tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 12)}px`;
      })
      .on('mouseleave', () => {
        layer.selectAll('.share-dot').classed('is-linked', false);
        hideTip();
      })
      .on('click', (event, point) => {
        if (suppressClick) {
          suppressClick = false;
          event.stopPropagation();
          return;
        }
        openLineupGameInfo(point.game, ordered);
      });
  }

  function buildDynamic(layer) {
    const marks = layer.selectAll('.share-mark').data(ROLE_ORDER).join('g').attr('class', 'share-mark');
    marks.append('circle').attr('class', 'share-dot-ring').attr('r', DOT_RADIUS + 4);
    marks.append('circle')
      .attr('class', 'share-dot')
      .attr('r', DOT_RADIUS)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .on('mousemove', (event, role) => showTip(event, role))
      .on('mouseleave', hideTip)
      .on('click', (event, role) => {
        if (suppressClick) {
          suppressClick = false;
          event.stopPropagation();
          return;
        }
        const game = currentGame();
        if (game?.roles?.[role]) openLineupGameInfo(game, ordered);
      });
  }

  function updateDynamic(layer, state) {
    const settled = state.phase === 'hold';
    layer.selectAll('.share-mark').each(function mark(role) {
      const node = d3.select(this);
      const fromGame = state.games[state.previous];
      const toGame = state.games[state.index];
      const gold = mixValue(
        roleValue(fromGame, role, 'gold_share'),
        roleValue(toGame, role, 'gold_share'),
        state.progress,
      );
      const damage = mixValue(
        roleValue(fromGame, role, 'damage_share'),
        roleValue(toGame, role, 'damage_share'),
        state.progress,
      );
      const visible = visibleRoles.has(role) && gold != null && damage != null;
      const color = ROLE_COLORS[role] ?? '#7adfff';
      node.select('.share-dot')
        .attr('cx', visible ? x(gold) : 0)
        .attr('cy', visible ? y(damage) : 0)
        .attr('fill', color)
        .attr('display', visible ? null : 'none')
        .classed('is-settled', settled && visible)
        .attr('aria-label', visible
          ? `${toGame?.roles?.[role]?.name ?? role}, ${formatRole(role)}, ${formatDate(toGame?.date)}`
          : formatRole(role));
      node.select('.share-dot-ring')
        .attr('cx', visible ? x(gold) : 0)
        .attr('cy', visible ? y(damage) : 0)
        .attr('stroke', color)
        .attr('display', visible && settled ? null : 'none');
    });
  }

  let unsubscribe = () => {};
  unsubscribe = playback?.subscribe((state) => {
    if (!plotHost.isConnected) {
      unsubscribe();
      playback.destroy();
      return;
    }
    paint(state);
  }) ?? unsubscribe;

  layout();
  return {
    zoomIn() {
      setSpan(span - SPAN_STEP);
    },
    zoomOut() {
      setSpan(span + SPAN_STEP);
    },
    resetZoom() {
      setSpan(1);
    },
    setVisibleRoles() {
      paintKey = '';
      paint(frameState);
    },
    destroy() {
      unsubscribe?.();
      playback?.destroy();
      observer.disconnect();
    },
  };
}
