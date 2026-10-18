import {
  AXIS_EPSILON,
  AXIS_TICKS,
  CHART_MIN_HEIGHT,
  CHART_MIN_WIDTH,
  FULL_SPAN,
  PAN_DRAG_PX,
  PHONE_MEDIA,
  SHARE_DOMAIN_FLOOR,
  SPAN_EPSILON,
  VERTICAL_LABEL,
} from '../../utils/chart-layout.js';
import { ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatPercent } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { createTooltipWatch, trackUi } from '../../utils/track.js';
import { createShareMarks } from './lineup-share-marks.js';
import { roleValue } from './lineup-playback.js';

const SPAN_STEP = 0.1;
const MIN_SPAN = 0.4;
const SHARE_ORIGIN_STEP = 0.05;
const ORIGIN_EDGE_RATIO = 0.2;
const ORIGIN_DIGITS = 4;
const SPAN_DIGITS = 2;
const INITIAL_PLOT_WIDTH = 1;
const DESKTOP_MARGIN = { top: 18, right: 18, bottom: 44, left: 58 };
const DESKTOP_Y_LABEL_OFFSET = -44;
const PHONE_AXIS_FONT = 9;
const PHONE_TICK_SIZE = 3;
const PHONE_TICK_PADDING = 2;
const PHONE_TITLE_GAP = 3;
const PHONE_AXIS_PAD = 2;
const X_TICK_MIN_GAP = 44;
const X_LABEL_OFFSET = 32;
const Y_TICK_CLEARANCE = 6;

function shareOrigin(minValue, step = SHARE_ORIGIN_STEP) {
  if (!Number.isFinite(minValue) || minValue <= step) return 0;
  const snapped = Math.floor((minValue - AXIS_EPSILON) / step) * step;
  const origin = minValue - snapped < step * ORIGIN_EDGE_RATIO ? snapped - step : snapped;
  return Math.max(0, Number(origin.toFixed(ORIGIN_DIGITS)));
}

function snapSpan(span) {return Number((Math.round(span / SPAN_STEP) * SPAN_STEP).toFixed(SPAN_DIGITS));}

function clamp(value, min, max) {return Math.min(max, Math.max(min, value));}

function sharePoints(games) {
  const points = [];
  for (const game of games) {
    for (const role of ROLE_ORDER) {
      const goldShare = roleValue(game, role, 'gold_share');
      const damageShare = roleValue(game, role, 'damage_share');
      if (goldShare == null || damageShare == null) continue;
      points.push({ goldShare, damageShare });
    }
  }return points;}

export function mountLineupShareScatter(stage, { games = [], playback, onSpanChange, visibleRoles = new Set(ROLE_ORDER) } = {}) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const ordered = playback?.games ?? games;
  const points = sharePoints(ordered);
  const dataMax = Math.max(SHARE_DOMAIN_FLOOR, d3.max(points, (point) => point.goldShare) ?? SHARE_DOMAIN_FLOOR);
  const xOrigin = shareOrigin(d3.min(points, (point) => point.goldShare));
  const fullMax = d3.scaleLinear().domain([0, dataMax]).nice().domain()[1];
  const fullSpan = Math.max(SHARE_ORIGIN_STEP, fullMax - xOrigin);
  const floor = points.length ? MIN_SPAN : FULL_SPAN;
  let margin = { ...DESKTOP_MARGIN };
  let span = FULL_SPAN;
  let xStart = xOrigin;
  let plotWidth = INITIAL_PLOT_WIDTH;
  let panning = false;
  let panStartX = 0;
  let lastPanX = 0;
  let panOrigin = null;
  let x = null;
  let y = null;

  const plotHost = h('div', { class: 'lineup-share-plot' });
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const tooltipWatch = createTooltipWatch('lineup-share-scatter');
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text(t('lineup.oneGame'));
  plotHost.append(svg.node(), tooltip);
  stage.append(plotHost);
  const svgNode = svg.node();
  const marks = createShareMarks({ svg, tooltip, tooltipWatch, plotHost, ordered, visibleRoles });

  svgNode.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || span >= FULL_SPAN - SPAN_EPSILON || !points.length) return;
    const localX = event.clientX - svgNode.getBoundingClientRect().left;
    if (localX < margin.left || localX > margin.left + plotWidth) return;
    panning = true;
    panStartX = event.clientX;
    lastPanX = event.clientX;
    panOrigin = { start: xStart, end: xStart + windowWidth() };
    marks.hideTip();
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
    const moved = Math.abs(event.clientX - panStartX) > PAN_DRAG_PX;
    const origin = panOrigin;
    panning = false;
    panOrigin = null;
    stage.classList.remove('is-panning');
    if (!moved || !origin) return;
    marks.armSuppressClick();
    const end = xStart + windowWidth();
    if (origin.start === xStart && origin.end === end) return;
    trackUi({
      event_name: 'filter_change',
      target_type: 'axis_move',
      target_id: 'lineup-share-scatter',
      metadata: {
        from: { start: origin.start, end: origin.end },
        to: { start: xStart, end },
      },
    });
  });
  svgNode.addEventListener('pointercancel', () => {
    panning = false;
    panOrigin = null;
    stage.classList.remove('is-panning');
  });

  const observer = new ResizeObserver(() => layout());
  observer.observe(plotHost);

  function windowWidth() {return fullSpan * span;}

  function clampStart(start) {return clamp(start, xOrigin, Math.max(xOrigin, fullMax - windowWidth()));}

  function setSpan(next) {
    const clamped = Math.min(FULL_SPAN, Math.max(floor, snapSpan(next)));
    if (clamped !== span) {
      const center = xStart + windowWidth() / 2;
      span = clamped;
      xStart = clampStart(center - windowWidth() / 2);
      layout();
    }return span;}

  function rotatedBox(text, { fontSize, anchor, axis = false }) {
    const host = svg.append('g').attr('class', axis ? 'chart-axis' : null).style('visibility', 'hidden');
    const probe = host.append('text')
      .attr('class', axis ? null : 'chart-axis-label')
      .attr('transform', VERTICAL_LABEL)
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
    const axis = d3.axisLeft(scale).ticks(AXIS_TICKS).tickFormat((value) => formatPercent(value)).tickSizeOuter(0);
    if (!window.matchMedia(PHONE_MEDIA).matches) {return { left: DESKTOP_MARGIN.left, offset: DESKTOP_Y_LABEL_OFFSET, font: null, rotateTicks: false, axis };}
    const font = PHONE_AXIS_FONT;
    axis.tickPadding(PHONE_TICK_PADDING).tickSizeInner(PHONE_TICK_SIZE);
    const tickBox = scale.ticks(AXIS_TICKS)
      .map((value) => rotatedBox(formatPercent(value), { fontSize: font, anchor: 'middle', axis: true }))
      .reduce((widest, box) => (box.width > widest.width ? box : widest), { width: 0, right: 0, left: 0 });
    const titleBox = rotatedBox(t('common.damageShare'), { fontSize: font, anchor: 'end' });
    const axisGap = PHONE_TICK_SIZE + PHONE_TICK_PADDING;
    const tickY = -(axisGap + tickBox.right);
    const offset = -(axisGap + tickBox.width + PHONE_TITLE_GAP + titleBox.right);
    const left = Math.ceil(-(offset - titleBox.left) + PHONE_AXIS_PAD);
    return { left, offset, tickY, font, rotateTicks: true, axis };
  }

  function xTickValues(scale) {
    const [start, end] = scale.domain();
    const generated = scale.ticks(AXIS_TICKS);
    if (start <= AXIS_EPSILON) return generated;
    const values = [start];
    generated.forEach((value) => {
      if (value <= start + AXIS_EPSILON || value >= end - AXIS_EPSILON) return;
      const previous = values[values.length - 1];
      if (Math.abs(scale(value) - scale(previous)) >= X_TICK_MIN_GAP) values.push(value);
    });const last = values[values.length - 1];
    if (Math.abs(scale(end) - scale(last)) < X_TICK_MIN_GAP) values[values.length - 1] = end;
    else values.push(end);
    return values;
  }

  function layout() {
    if (!plotHost.isConnected) {
      observer.disconnect();
      playback?.destroy();
      return;
    }const width = plotHost.clientWidth;
    const height = Math.max(plotHost.clientHeight, CHART_MIN_HEIGHT);
    if (width < CHART_MIN_WIDTH) return;
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
      onSpanChange?.(FULL_SPAN, FULL_SPAN, 0, fullMax);
      stage.classList.remove('is-zoomed');
      return;
    }

    const yMax = Math.max(SHARE_DOMAIN_FLOOR, d3.max(points, (point) => point.damageShare));
    const innerHeight = height - margin.top - margin.bottom;
    y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);
    const yTitle = compactYAxis(y);
    margin = { ...DESKTOP_MARGIN, left: yTitle.left };
    const innerWidth = Math.max(CHART_MIN_WIDTH, width - margin.left - margin.right);
    plotWidth = innerWidth;
    xStart = clampStart(xStart);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    x = d3.scaleLinear().domain([xStart, xStart + windowWidth()]).range([0, innerWidth]);

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(AXIS_TICKS).tickSize(-innerWidth).tickFormat(() => ''))
      .select('.domain')
      .remove();
    plot.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickValues(xTickValues(x)).tickFormat((value) => formatPercent(value)).tickSizeOuter(0));
    plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('x', innerWidth)
      .attr('y', innerHeight + X_LABEL_OFFSET)
      .attr('text-anchor', 'end')
      .text(t('common.goldShare'));
    const yLabel = plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('transform', VERTICAL_LABEL)
      .attr('x', 0)
      .attr('y', yTitle.offset)
      .attr('text-anchor', 'end')
      .text(t('common.damageShare'));
    if (yTitle.font) yLabel.style('font-size', `${yTitle.font}px`);

    const clipId = `lineup-share-clip-${Math.round(innerWidth)}-${Math.round(innerHeight)}`;
    svg.append('clipPath').attr('id', clipId).append('rect').attr('width', innerWidth).attr('height', innerHeight);
    const [x0, x1] = x.domain();
    const [y0, y1] = y.domain();
    const guideStart = Math.max(x0, y0);
    const guideEnd = Math.min(x1, y1);
    if (guideEnd > guideStart) {
      plot.append('line')
        .attr('class', 'share-guide')
        .attr('x1', x(guideStart))
        .attr('y1', y(guideStart))
        .attr('x2', x(guideEnd))
        .attr('y2', y(guideEnd))
        .attr('clip-path', `url(#${clipId})`);
    }
    plot.append('g').attr('class', 'share-dots').attr('clip-path', `url(#${clipId})`);
    marks.setScales(x, y);
    marks.invalidate();

    const yAxis = plot.append('g')
      .attr('class', 'chart-axis chart-axis--y')
      .call(yTitle.axis);
    if (yTitle.font) yAxis.selectAll('text').style('font-size', `${yTitle.font}px`);
    if (yTitle.rotateTicks) {
      yAxis.selectAll('text')
        .attr('transform', VERTICAL_LABEL)
        .attr('text-anchor', 'middle')
        .attr('x', 0)
        .attr('dx', null)
        .attr('dy', null)
        .attr('y', yTitle.tickY);
      const xTop = Math.min(...plot.selectAll('.chart-axis:not(.chart-axis--y) .tick text').nodes()
        .map((node) => node.getBoundingClientRect().top));
      yAxis.selectAll('text').each(function liftClear() {
        const overlap = this.getBoundingClientRect().bottom - xTop + Y_TICK_CLEARANCE;
        if (overlap > 0) this.setAttribute('x', overlap);
      });
    }

    onSpanChange?.(span, floor, xStart, xStart + windowWidth());
    stage.classList.toggle('is-zoomed', span < FULL_SPAN - SPAN_EPSILON);
    marks.repaint();
  }


  let unsubscribe = () => {};
  unsubscribe = playback?.subscribe((state) => {
    if (!plotHost.isConnected) {
      unsubscribe();
      playback.destroy();
      return;
    }marks.paint(state);
  }) ?? unsubscribe;

  layout();
  return {
    zoomIn() {setSpan(span - SPAN_STEP);},
    zoomOut() {setSpan(span + SPAN_STEP);},
    resetZoom() {setSpan(FULL_SPAN);},
    setVisibleRoles() {
      marks.invalidate();
      marks.repaint();
    },
    destroy() {
      unsubscribe?.();
      playback?.destroy();
      observer.disconnect();
    },};
}
