import {
  AXIS_EPSILON,
  AXIS_TICKS,
  CHART_MIN_HEIGHT,
  CHART_MIN_WIDTH,
} from '../../utils/chart-layout.js';
import { d3 } from '../../utils/d3.js';
import { formatCompactDate, formatDate } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { colorForSeries, formatChartValue, SERIES_META, yTickFormat } from './player-chart-config.js';

const LEGEND_TOP = 16;
const LEGEND_SWATCH = 8;
const LEGEND_SWATCH_Y = -7;
const LEGEND_LABEL_X = 12;
const LEGEND_FONT = 10;
const LEGEND_LINE_DY = 13;
const LEGEND_ROW_HEIGHT = 18;
const LEGEND_ITEM_GAP = 20;
const LEGEND_ROW_PAD = 8;
const TICK_LABEL_WIDTH = 108;
const MIN_TICK_BUDGET = 2;
const MIN_TICK_STEP = 1;
const MARGIN = { top: 28, right: 16, bottom: 42, left: 52 };
const MIN_INNER = 1;
const MIN_VIEW_SPAN = 1;
const MIN_SERIES_POINTS = 2;
const DOMAIN_PAD_RATIO = 0.04;
const SINGLE_GAME_PAD = 0.5;
const LINE_WIDTH = 2.2;
const POINT_RADIUS_MIN = 1.8;
const POINT_RADIUS_MAX = 3.4;
const POINT_RADIUS_SPAN = 120;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function seriesFromGames(games, fields) {
  return fields.map((field, index) => ({
    field,
    label: SERIES_META[field]?.label ?? field,
    color: colorForSeries(index),
    values: games.map((game, gameIndex) => {
      const raw = game[field];
      const value = raw == null || raw === '' ? null : Number(raw);
      return {
        game,
        index: gameIndex,
        value: Number.isFinite(value) ? value : null,
      };
    }),
  }));
}

export function tooltipLines(game, field, value) {
  const team = game.opponent?.short ?? game.opponent?.name;
  return [
    formatDate(game.date),
    game.champion ? t('chart.champion', { name: game.champion }) : null,
    team ? t('chart.opponentTeam', { name: team }) : null,
    game.opponentChampion ? t('chart.opponentChampion', { name: game.opponentChampion }) : null,
    t('chart.series', { label: SERIES_META[field]?.label ?? field, value: formatChartValue(field, value) }),
  ].filter(Boolean);
}

function drawLegend(svg, series, left, width) {
  const legend = svg.append('g').attr('class', 'chart-legend').attr('transform', `translate(${left},${LEGEND_TOP})`);
  let x = 0;
  let y = 0;
  let rowHeight = LEGEND_ROW_HEIGHT;
  for (const item of series) {
    const entry = legend.append('g');
    entry.append('rect').attr('width', LEGEND_SWATCH).attr('height', LEGEND_SWATCH).attr('y', LEGEND_SWATCH_Y).attr('fill', item.color);
    const label = entry.append('text').attr('x', LEGEND_LABEL_X).attr('font-size', LEGEND_FONT);
    let words = [];
    let line = label.append('tspan').attr('x', LEGEND_LABEL_X).attr('dy', 0);
    for (const word of item.label.split(' ')) {
      words.push(word);
      line.text(words.join(' '));
      if (words.length > 1 && line.node().getComputedTextLength() > width - LEGEND_LABEL_X) {
        words.pop();
        line.text(words.join(' '));
        words = [word];
        line = label.append('tspan').attr('x', LEGEND_LABEL_X).attr('dy', LEGEND_LINE_DY).text(word);
      }
    }
    const bounds = entry.node().getBBox();
    if (x > 0 && x + bounds.width > width) {
      x = 0;
      y += rowHeight;
      rowHeight = LEGEND_ROW_HEIGHT;
    }
    entry.attr('transform', `translate(${x},${y})`);
    x += bounds.width + LEGEND_ITEM_GAP;
    rowHeight = Math.max(rowHeight, bounds.height + LEGEND_ROW_PAD);
  }
  return LEGEND_TOP + y + rowHeight;
}
function clipSeries(values, start, end) {
  const last = Math.floor(end);
  const fraction = end - last;
  const points = values.filter((point) => point.index >= start && point.index <= last);
  const leadIndex = Math.floor(start);
  const lead = values[leadIndex];
  const leadNext = values[leadIndex + 1];
  if (
    lead?.value != null
    && leadNext?.value != null
    && start > lead.index
    && start < leadNext.index
  ) {
    points.unshift({
      game: leadNext.game,
      index: start,
      value: lead.value + (leadNext.value - lead.value) * (start - lead.index),
      partial: true,
    });
  }
  const previous = values[last];
  const next = values[last + 1];
  if (fraction > 0.02 && previous?.value != null && next?.value != null && next.index >= start) {
    points.push({
      game: next.game,
      index: last + fraction,
      value: previous.value + (next.value - previous.value) * fraction,
      partial: true,
    });
  }
  return points;
}

function xTickIndexes(start, end, innerWidth, labelAt = () => '') {
  const first = Math.ceil(start);
  const last = Math.floor(end);
  if (last <= first) return [first];
  const budget = Math.max(MIN_TICK_BUDGET, Math.floor(innerWidth / TICK_LABEL_WIDTH));
  const step = Math.max(MIN_TICK_STEP, Math.ceil((last - first) / budget));
  const ticks = [];
  let previousLabel = null;
  for (let index = first; index <= last; index += step) {
    const label = labelAt(index);
    if (label && label === previousLabel) continue;
    ticks.push(index);
    previousLabel = label;
  }
  if (ticks.at(-1) !== last) {
    const label = labelAt(last);
    const previous = ticks.at(-1);
    if (label !== previousLabel && last - previous >= step) ticks.push(last);
  }
  return ticks.length ? ticks : [first];
}

export function drawPlayerTimeline({
  svg, plotHost, stage, sorted, fields, from, to, lastIndex, showTip, hideTip, rangeText,
}) {
  let plotMetrics = null;
  function cameraBounds() {
    return [from, to];
  }

  function windowIsNarrow() {
    return sorted.length > 1 && to - from < lastIndex - AXIS_EPSILON;
  }

    const width = plotHost.clientWidth;
    const height = Math.max(plotHost.clientHeight, CHART_MIN_HEIGHT);
    if (width < CHART_MIN_WIDTH) return;

    const series = seriesFromGames(sorted, fields);
    const defined = series.flatMap((item) => item.values.filter((point) => point.value != null));
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    if (!sorted.length || !defined.length) {
      stage.classList.remove('is-zoomed', 'is-panning');
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text(t('chart.noMetric'));
      svg.attr('aria-label', t('chart.noMetric'));
      return { plotMetrics: null };
    }

    const margin = { ...MARGIN };
    const innerWidth = Math.max(MIN_INNER, width - margin.left - margin.right);
    if (series.length > 1) margin.top = drawLegend(svg, series, margin.left, innerWidth);
    const innerHeight = Math.max(MIN_INNER, height - margin.top - margin.bottom);
    plotMetrics = { left: margin.left, top: margin.top, width: innerWidth, height: innerHeight };
    stage.classList.toggle('is-zoomed', windowIsNarrow());
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const [viewStart, viewEnd] = cameraBounds();
    const viewSpan = Math.max(viewEnd - viewStart, MIN_VIEW_SPAN);
    const pad = viewSpan * DOMAIN_PAD_RATIO;
    const x = d3.scaleLinear()
      .domain(sorted.length < MIN_SERIES_POINTS ? [-SINGLE_GAME_PAD, SINGLE_GAME_PAD] : [viewStart - pad, viewEnd + pad])
      .range([0, innerWidth]);
    const yValues = defined.map((point) => point.value);
    const y = d3.scaleLinear()
      .domain([Math.min(0, d3.min(yValues)), d3.max(yValues)])
      .nice()
      .range([innerHeight, 0]);

    const xAxis = d3.axisBottom(x)
      .tickValues(sorted.length < MIN_SERIES_POINTS ? [0] : xTickIndexes(
        viewStart,
        viewEnd,
        innerWidth,
        (index) => formatCompactDate(sorted[clamp(index, 0, lastIndex)]?.date),
      ))
      .tickFormat((index) => formatCompactDate(sorted[clamp(index, 0, lastIndex)]?.date))
      .tickSizeOuter(0);
    const yAxis = d3.axisLeft(y).ticks(AXIS_TICKS).tickFormat(yTickFormat(fields)).tickSizeOuter(0);

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(AXIS_TICKS).tickSize(-innerWidth).tickFormat(() => ''))
      .select('.domain')
      .remove();

    plot.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    plot.append('g').attr('class', 'chart-axis').call(yAxis);

    const line = d3.line()
      .defined((point) => point.value != null)
      .x((point) => x(point.index))
      .y((point) => y(point.value));

    for (const item of series) {
      const visible = clipSeries(item.values, viewStart, viewEnd);
      plot.append('path')
        .attr('class', 'chart-line')
        .attr('fill', 'none')
        .attr('stroke', item.color)
        .attr('stroke-width', LINE_WIDTH)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', line(visible));

      plot.selectAll(null)
        .data(visible.filter((point) => point.value != null && !point.partial))
        .join('circle')
        .attr('class', 'chart-point')
        .attr('cx', (point) => x(point.index))
        .attr('cy', (point) => y(point.value))
        .attr('r', Math.max(POINT_RADIUS_MIN, Math.min(POINT_RADIUS_MAX, POINT_RADIUS_SPAN / viewSpan)))
        .attr('fill', item.color)
        .on('mousemove', (event, point) => showTip(event, point, item.field))
        .on('mouseleave', hideTip);
    }

    svg.attr('aria-label', t('chart.timelineAria', { range: rangeText() }));
    return { plotMetrics };
  }
