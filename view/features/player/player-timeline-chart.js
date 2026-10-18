import {
  AXIS_EPSILON,
  BRUSH_EDGE,
  BRUSH_HEIGHT,
  BRUSH_MIN_SPAN,
  BRUSH_PAD,
  CHART_MIN_WIDTH,
  PAN_DRAG_PX,
  SPARK_INSET,
  TOOLTIP_RESERVE_WIDE,
  placeTooltip,
} from '../../utils/chart-layout.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCompactDate, parseGameDate } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { createTooltipWatch, trackUi } from '../../utils/track.js';
import { drawPlayerTimeline, seriesFromGames, tooltipLines } from './player-timeline-draw.js';

function sortByDate(games) {
  return [...games].sort((a, b) => {
    const aTime = parseGameDate(a.date)?.getTime() ?? 0;
    const bTime = parseGameDate(b.date)?.getTime() ?? 0;
    return aTime - bTime || String(a.id).localeCompare(String(b.id));
  });
}

const MIN_BRUSH_SELECTION = 1;
const SPARK_FLAT_PAD = 1;

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
  let plotMetrics = null;
  let panning = false;
  let panStartX = 0;
  let lastPanX = 0;
  let panOrigin = null;
  const svgNode = svg.node();

  svgNode.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !windowIsNarrow() || !plotMetrics) return;
    const bounds = svgNode.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    if (localX < plotMetrics.left || localX > plotMetrics.left + plotMetrics.width) return;
    if (localY < plotMetrics.top || localY > plotMetrics.top + plotMetrics.height) return;
    panning = true;
    panStartX = event.clientX;
    lastPanX = event.clientX;
    panOrigin = { mode: 'drag', from, to };
    hideTip();
    svgNode.setPointerCapture(event.pointerId);
    stage.classList.add('is-panning');
  });
  svgNode.addEventListener('pointermove', (event) => {
    if (!panning || !plotMetrics || plotMetrics.width <= 0) return;
    const dx = event.clientX - lastPanX;
    lastPanX = event.clientX;
    if (!dx) return;
    const windowSize = to - from;
    const nextFrom = clamp(from - (dx / plotMetrics.width) * windowSize, 0, Math.max(0, lastIndex - windowSize));
    from = nextFrom;
    to = nextFrom + windowSize;
    drawChart();
    syncBrush();
    syncControls();
  });
  function endPan() {
    if (!panning) return;
    panning = false;
    panOrigin = null;
    stage.classList.remove('is-panning');
  }
  svgNode.addEventListener('pointerup', (event) => {
    if (!panning) return;
    const moved = Math.abs(event.clientX - panStartX) > PAN_DRAG_PX;
    const gesture = panOrigin;
    endPan();
    if (!moved) return;
    hideTip();
    trackAxis(gesture);
  });
  svgNode.addEventListener('pointercancel', endPan);

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
    if (panning) return;
    tooltipWatch.show(`${point.game?.id ?? point.index}|${field}`);
    tooltip.innerHTML = tooltipLines(point.game, field, point.value)
      .map((line) => `<div>${line}</div>`)
      .join('');
    tooltip.hidden = false;
    placeTooltip(tooltip, event, plotHost, TOOLTIP_RESERVE_WIDE);
  }

  function cameraBounds() {
    return [from, to];
  }

  function visibleEnd() {
    return to;
  }

  function indexAt(value) {
    return clamp(Math.round(value), 0, lastIndex);
  }

  function windowIsNarrow() {
    return sorted.length > 1 && to - from < lastIndex - AXIS_EPSILON;
  }

  function rangeText() {
    if (!sorted.length) return t('common.noGames');
    const startIndex = indexAt(from);
    const endIndex = indexAt(to);
    const count = Math.max(1, endIndex - startIndex + 1);
    return t('chart.range', {
      start: formatCompactDate(sorted[startIndex].date),
      end: formatCompactDate(sorted[endIndex].date),
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
    brushG.call(brush.move, x1 - x0 < MIN_BRUSH_SELECTION ? [x0, x0 + MIN_BRUSH_SELECTION] : [x0, x1]);
    movingBrush = false;
  }

  function layoutBrush(width) {
    const height = BRUSH_HEIGHT;
    const margin = BRUSH_PAD;
    brushSvg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    xIndex = d3.scaleLinear().domain([0, Math.max(BRUSH_MIN_SPAN, lastIndex)]).range([margin, Math.max(margin + BRUSH_MIN_SPAN, width - margin)]);
    let backdrop = brushSvg.select('.timeline-brush-back');
    if (backdrop.empty()) backdrop = brushSvg.insert('g', '.timeline-brush').attr('class', 'timeline-brush-back');
    backdrop.selectAll('*').remove();
    const series = seriesFromGames(sorted, fields);
    const spark = series[0]?.values.filter((point) => point.value != null) ?? [];
    const sparkExtent = spark.length ? d3.extent(spark, (point) => point.value) : [0, 1];
    const ySpark = d3.scaleLinear()
      .domain(sparkExtent[0] === sparkExtent[1] ? [sparkExtent[0] - SPARK_FLAT_PAD, sparkExtent[1] + SPARK_FLAT_PAD] : sparkExtent)
      .range([height - SPARK_INSET, SPARK_INSET]);
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
    brush.extent([[margin, BRUSH_EDGE], [Math.max(margin + BRUSH_MIN_SPAN, width - margin), height - BRUSH_EDGE]]);
    brushG.call(brush);
    brushWidth = width;
    syncBrush();
  }

  function drawChart() {
    const drawn = drawPlayerTimeline({
      svg, plotHost, stage, sorted, fields, from, to, lastIndex, showTip, hideTip, rangeText,
    });
    if (drawn) plotMetrics = drawn.plotMetrics;
  }

  function render() {
    if (!plotHost.isConnected) {
      observer.disconnect();
      return;
    }
    drawChart();
    const width = Math.round(dock.clientWidth);
    if (width > CHART_MIN_WIDTH && width !== brushWidth) layoutBrush(width);
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
