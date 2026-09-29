import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCompactDate, formatDate, parseGameDate } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { createTooltipWatch, trackUi } from '../../utils/track.js';
import { colorForSeries, formatChartValue, SERIES_META, yTickFormat } from './player-chart-config.js';

function sortByDate(games) {
  return [...games].sort((a, b) => {
    const aTime = parseGameDate(a.date)?.getTime() ?? 0;
    const bTime = parseGameDate(b.date)?.getTime() ?? 0;
    return aTime - bTime || String(a.id).localeCompare(String(b.id));
  });
}

function seriesFromGames(games, fields) {
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

function tooltipLines(game, field, value) {
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
  const legend = svg.append('g').attr('class', 'chart-legend').attr('transform', `translate(${left},16)`);
  let x = 0;
  let y = 0;
  let rowHeight = 18;
  for (const item of series) {
    const entry = legend.append('g');
    entry.append('rect').attr('width', 8).attr('height', 8).attr('y', -7).attr('fill', item.color);
    const label = entry.append('text').attr('x', 12).attr('font-size', 10);
    let words = [];
    let line = label.append('tspan').attr('x', 12).attr('dy', 0);
    for (const word of item.label.split(' ')) {
      words.push(word);
      line.text(words.join(' '));
      if (words.length > 1 && line.node().getComputedTextLength() > width - 12) {
        words.pop();
        line.text(words.join(' '));
        words = [word];
        line = label.append('tspan').attr('x', 12).attr('dy', 13).text(word);
      }
    }
    const bounds = entry.node().getBBox();
    if (x > 0 && x + bounds.width > width) {
      x = 0;
      y += rowHeight;
      rowHeight = 18;
    }
    entry.attr('transform', `translate(${x},${y})`);
    x += bounds.width + 20;
    rowHeight = Math.max(rowHeight, bounds.height + 8);
  }
  return 16 + y + rowHeight;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function windowFromSelection(rawStart, rawEnd, count) {
  const last = Math.max(0, count - 1);
  let start = clamp(Math.round(Math.min(rawStart, rawEnd)), 0, last);
  let end = clamp(Math.round(Math.max(rawStart, rawEnd)), 0, last);
  if (count > 1 && end <= start) {
    if (start >= last) start = last - 1;
    end = start + 1;
  }
  return [start, end];
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
  const budget = Math.max(2, Math.floor(innerWidth / 108));
  const step = Math.max(1, Math.ceil((last - first) / budget));
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

export function mountPlayerTimeline(stage, { games }) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const sorted = sortByDate(games);
  const lastIndex = Math.max(0, sorted.length - 1);
  const plotHost = h('div', { class: 'timeline-plot' });
  const rangeLabel = h('p', { class: 'timeline-range' });
  const brushSvg = d3.create('svg')
    .attr('class', 'timeline-brush-svg')
    .attr('role', 'slider')
    .attr('aria-label', t('lineup.gameRange'))
    .attr('aria-orientation', 'horizontal');
  const dock = h('div', { class: 'timeline-dock' }, [
    rangeLabel,
    brushSvg.node(),
  ]);
  const tooltip = h('div', { class: 'chart-tooltip', hidden: true });
  const tooltipWatch = createTooltipWatch('player-timeline');
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  plotHost.append(svg.node(), tooltip);
  stage.append(plotHost, dock);

  let fields = ['kills', 'deaths', 'assists'];
  let from = 0;
  let to = lastIndex;
  let userBrushing = false;
  let movingBrush = false;
  let brushGesture = null;
  let brushWidth = 0;
  let xIndex = null;
  const brush = d3.brushX().on('start brush end', onBrush);
  const brushG = brushSvg.append('g').attr('class', 'timeline-brush');

  const observer = new ResizeObserver(() => render());
  observer.observe(plotHost);
  observer.observe(dock);

  function hideTip() {
    tooltip.hidden = true;
    tooltipWatch.hide();
  }

  function showTip(event, point, field) {
    tooltipWatch.show(`${point.game?.id ?? point.index}|${field}`);
    tooltip.innerHTML = tooltipLines(point.game, field, point.value)
      .map((line) => `<div>${line}</div>`)
      .join('');
    tooltip.hidden = false;
    const bounds = plotHost.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 12, bounds.width - 180)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 12)}px`;
  }

  function cameraBounds() {
    return [from, to];
  }

  function visibleEnd() {
    return to;
  }

  function rangeText() {
    if (!sorted.length) return t('common.noGames');
    const end = visibleEnd();
    const count = end - from + 1;
    return t('chart.range', {
      start: formatCompactDate(sorted[from].date),
      end: formatCompactDate(sorted[end].date),
      count,
      unit: count === 1 ? t('common.game') : t('common.gamesWord'),
    });
  }

  function syncControls() {
    const text = rangeText();
    if (rangeLabel.textContent !== text) rangeLabel.textContent = text;
    brushSvg.attr('aria-valuetext', text);
    brushSvg.attr('aria-valuemin', 0);
    brushSvg.attr('aria-valuemax', lastIndex);
    brushSvg.attr('aria-valuenow', visibleEnd());
  }

  function trackAxis(gesture) {
    if (!gesture || (gesture.from === from && gesture.to === to)) return;
    const targetType = gesture.mode === 'drag'
      ? 'axis_move'
      : gesture.mode === 'handle' ? 'axis_resize' : null;
    if (!targetType) return;
    const metadata = {
      from: { start: gesture.from, end: gesture.to },
      to: { start: from, end: to },
    };
    if (targetType === 'axis_resize') {
      const startMoved = gesture.from !== from;
      const endMoved = gesture.to !== to;
      metadata.edge = startMoved && endMoved ? 'both' : startMoved ? 'start' : 'end';
    }
    trackUi({
      event_name: 'filter_change',
      target_type: targetType,
      target_id: 'player-timeline',
      metadata,
    });
  }

  function onBrush(event) {
    if (movingBrush || !event.sourceEvent) return;
    if (event.type === 'start') {
      userBrushing = true;
      brushGesture = { mode: event.mode, from, to };
      return;
    }
    if (!userBrushing || !event.selection || !xIndex) {
      userBrushing = false;
      brushGesture = null;
      syncBrush();
      return;
    }
    const [start, end] = windowFromSelection(
      xIndex.invert(event.selection[0]),
      xIndex.invert(event.selection[1]),
      sorted.length,
    );
    from = start;
    to = end;
    drawChart();
    syncControls();
    if (event.type === 'end') {
      const gesture = brushGesture;
      brushGesture = null;
      userBrushing = false;
      syncBrush();
      trackAxis(gesture);
    }
  }

  function syncBrush() {
    if (userBrushing || !xIndex || sorted.length < 2) return;
    const x0 = xIndex(from);
    const x1 = xIndex(to);
    if (!Number.isFinite(x0) || !Number.isFinite(x1)) return;
    movingBrush = true;
    brushG.call(brush.move, x1 - x0 < 1 ? [x0, x0 + 1] : [x0, x1]);
    movingBrush = false;
  }

  function layoutBrush(width) {
    const height = 36;
    const margin = 10;
    brushSvg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    xIndex = d3.scaleLinear().domain([0, Math.max(1, lastIndex)]).range([margin, Math.max(margin + 1, width - margin)]);
    let backdrop = brushSvg.select('.timeline-brush-back');
    if (backdrop.empty()) backdrop = brushSvg.insert('g', '.timeline-brush').attr('class', 'timeline-brush-back');
    backdrop.selectAll('*').remove();
    const series = seriesFromGames(sorted, fields);
    const spark = series[0]?.values.filter((point) => point.value != null) ?? [];
    const sparkExtent = spark.length ? d3.extent(spark, (point) => point.value) : [0, 1];
    const ySpark = d3.scaleLinear()
      .domain(sparkExtent[0] === sparkExtent[1] ? [sparkExtent[0] - 1, sparkExtent[1] + 1] : sparkExtent)
      .range([height - 6, 6]);
    backdrop.append('line')
      .attr('class', 'timeline-track')
      .attr('x1', xIndex(0))
      .attr('x2', xIndex(lastIndex))
      .attr('y1', height / 2)
      .attr('y2', height / 2);
    if (spark.length > 1) {
      const sparkLine = d3.line()
        .x((point) => xIndex(point.index))
        .y((point) => ySpark(point.value));
      backdrop.append('path')
        .attr('class', 'timeline-spark')
        .attr('fill', 'none')
        .attr('d', sparkLine(spark));
    }
    brush.extent([[margin, 3], [Math.max(margin + 1, width - margin), height - 3]]);
    brushG.call(brush);
    brushWidth = width;
    syncBrush();
  }

  function drawChart() {
    const width = plotHost.clientWidth;
    const height = Math.max(plotHost.clientHeight, 280);
    if (width < 40) return;

    const series = seriesFromGames(sorted, fields);
    const defined = series.flatMap((item) => item.values.filter((point) => point.value != null));
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    if (!sorted.length || !defined.length) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text(t('chart.noMetric'));
      svg.attr('aria-label', t('chart.noMetric'));
      return;
    }

    const margin = { top: 28, right: 16, bottom: 42, left: 52 };
    const innerWidth = Math.max(1, width - margin.left - margin.right);
    if (series.length > 1) margin.top = drawLegend(svg, series, margin.left, innerWidth);
    const innerHeight = Math.max(1, height - margin.top - margin.bottom);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const [viewStart, viewEnd] = cameraBounds();
    const viewSpan = Math.max(viewEnd - viewStart, 1);
    const pad = viewSpan * 0.04;
    const x = d3.scaleLinear()
      .domain(sorted.length < 2 ? [-0.5, 0.5] : [viewStart - pad, viewEnd + pad])
      .range([0, innerWidth]);
    const yValues = defined.map((point) => point.value);
    const y = d3.scaleLinear()
      .domain([Math.min(0, d3.min(yValues)), d3.max(yValues)])
      .nice()
      .range([innerHeight, 0]);

    const xAxis = d3.axisBottom(x)
      .tickValues(sorted.length < 2 ? [0] : xTickIndexes(
        viewStart,
        viewEnd,
        innerWidth,
        (index) => formatCompactDate(sorted[clamp(index, 0, lastIndex)]?.date),
      ))
      .tickFormat((index) => formatCompactDate(sorted[clamp(index, 0, lastIndex)]?.date))
      .tickSizeOuter(0);
    const yAxis = d3.axisLeft(y).ticks(5).tickFormat(yTickFormat(fields)).tickSizeOuter(0);

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => ''))
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
        .attr('stroke-width', 2.2)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', line(visible));

      plot.selectAll(null)
        .data(visible.filter((point) => point.value != null && !point.partial))
        .join('circle')
        .attr('class', 'chart-point')
        .attr('cx', (point) => x(point.index))
        .attr('cy', (point) => y(point.value))
        .attr('r', Math.max(1.8, Math.min(3.4, 120 / viewSpan)))
        .attr('fill', item.color)
        .on('mousemove', (event, point) => showTip(event, point, item.field))
        .on('mouseleave', hideTip);
    }

    svg.attr('aria-label', t('chart.timelineAria', { range: rangeText() }));
  }

  function render() {
    if (!plotHost.isConnected) {
      observer.disconnect();
      return;
    }
    drawChart();
    const width = Math.round(dock.clientWidth);
    if (width > 40 && width !== brushWidth) layoutBrush(width);
    else syncBrush();
    syncControls();
  }

  render();
  return {
    update(nextFields) {
      fields = nextFields;
      brushWidth = 0;
      render();
    },
    destroy() {
      observer.disconnect();
    },
  };
}
