import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCompactDate, formatDate, parseGameDate } from '../../utils/formatting.js';
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
    game.champion ? `Champion: ${game.champion}` : null,
    team ? `Opponent team: ${team}` : null,
    game.opponentChampion ? `Opponent champion: ${game.opponentChampion}` : null,
    `${SERIES_META[field]?.label ?? field}: ${formatChartValue(field, value)}`,
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

function xTickIndexes(start, end, innerWidth) {
  const first = Math.ceil(start);
  const last = Math.floor(end);
  if (last <= first) return [first];
  const budget = Math.max(2, Math.floor(innerWidth / 84));
  const step = Math.max(1, Math.ceil((last - first) / budget));
  const ticks = [];
  for (let index = first; index <= last; index += step) ticks.push(index);
  if (ticks[ticks.length - 1] !== last) ticks.push(last);
  return ticks;
}

export function mountPlayerTimeline(stage, { games }) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const sorted = sortByDate(games);
  const lastIndex = Math.max(0, sorted.length - 1);
  const plotHost = h('div', { class: 'timeline-plot' });
  const rangeLabel = h('p', { class: 'timeline-range' });
  const playButton = h('button', { class: 'timeline-btn', type: 'button', dataset: { action: 'play' } }, ['Play']);
  const pauseButton = h('button', { class: 'timeline-btn', type: 'button', dataset: { action: 'pause' } }, ['Pause']);
  const restartButton = h('button', { class: 'timeline-btn', type: 'button', dataset: { action: 'restart' } }, ['Restart']);
  const brushSvg = d3.create('svg')
    .attr('class', 'timeline-brush-svg')
    .attr('role', 'slider')
    .attr('aria-label', 'Game range')
    .attr('aria-orientation', 'horizontal');
  const dock = h('div', { class: 'timeline-dock' }, [
    h('div', { class: 'timeline-transport', role: 'group', 'aria-label': 'Timeline playback' }, [
      playButton,
      pauseButton,
      restartButton,
    ]),
    rangeLabel,
    brushSvg.node(),
  ]);
  const tooltip = h('div', { class: 'chart-tooltip', hidden: true });
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  plotHost.append(svg.node(), tooltip);
  stage.append(plotHost, dock);

  let fields = ['kills', 'deaths', 'assists'];
  let from = 0;
  let to = lastIndex;
  let cursor = lastIndex;
  let finished = true;
  let playing = false;
  let userBrushing = false;
  let movingBrush = false;
  let raf = 0;
  let lastFrame = 0;
  let brushWidth = 0;
  let xIndex = null;
  const brush = d3.brushX().on('start brush end', onBrush);
  const brushG = brushSvg.append('g').attr('class', 'timeline-brush');

  const observer = new ResizeObserver(() => render());
  observer.observe(plotHost);
  observer.observe(dock);

  function hideTip() {
    tooltip.hidden = true;
  }

  function showTip(event, point, field) {
    tooltip.innerHTML = tooltipLines(point.game, field, point.value)
      .map((line) => `<div>${line}</div>`)
      .join('');
    tooltip.hidden = false;
    const bounds = plotHost.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 12, bounds.width - 180)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 12)}px`;
  }

  function stopPlayback() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function paceMs() {
    const steps = Math.max(1, to - from);
    return Math.min(260, Math.max(70, 8000 / steps));
  }

  function frame(now) {
    if (!playing || !plotHost.isConnected) {
      if (!plotHost.isConnected) stopPlayback();
      return;
    }
    const dt = lastFrame ? Math.min(48, now - lastFrame) : 16;
    lastFrame = now;
    cursor = Math.min(to, cursor + dt / paceMs());
    if (!playing) return;
    drawChart();
    syncBrush();
    syncControls();
    if (!playing) return;
    if (cursor >= to - 1e-3) {
      cursor = to;
      finished = true;
      stopPlayback();
      drawChart();
      syncBrush();
      syncControls();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (sorted.length < 2) return;
    if (raf) cancelAnimationFrame(raf);
    if (finished) cursor = Math.min(to, from + 1);
    finished = false;
    playing = true;
    lastFrame = 0;
    drawChart();
    syncBrush();
    syncControls();
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    stopPlayback();
    syncControls();
  }

  function restart() {
    if (sorted.length < 2) return;
    stopPlayback();
    cursor = Math.min(to, from + 1);
    drawChart();
    syncBrush();
    play();
  }

  function visibleEnd() {
    return clamp(Math.round(cursor), from, to);
  }

  function rangeText() {
    if (!sorted.length) return 'No games';
    const end = visibleEnd();
    const count = end - from + 1;
    return `${formatCompactDate(sorted[from].date)} – ${formatCompactDate(sorted[end].date)} · ${count} ${count === 1 ? 'game' : 'games'}`;
  }

  function syncControls() {
    const canPlay = sorted.length > 1;
    playButton.disabled = !canPlay || playing;
    pauseButton.disabled = !playing;
    restartButton.disabled = !canPlay;
    playButton.setAttribute('aria-pressed', playing ? 'true' : 'false');
    const text = rangeText();
    if (rangeLabel.textContent !== text) rangeLabel.textContent = text;
    brushSvg.attr('aria-valuetext', text);
    brushSvg.attr('aria-valuemin', 0);
    brushSvg.attr('aria-valuemax', lastIndex);
    brushSvg.attr('aria-valuenow', visibleEnd());
  }

  function onBrush(event) {
    if (movingBrush || !event.sourceEvent) return;
    if (event.type === 'start') {
      userBrushing = true;
      pause();
      return;
    }
    if (!userBrushing || !event.selection || !xIndex) {
      userBrushing = false;
      syncBrush();
      return;
    }
    const [start, end] = windowFromSelection(
      xIndex.invert(event.selection[0]),
      xIndex.invert(event.selection[1]),
      sorted.length,
    );
    if (finished) {
      from = start;
      to = end;
      cursor = end;
    } else {
      from = start;
      cursor = end;
      if (cursor > to) to = cursor;
      if (cursor >= to - 1e-3) {
        cursor = to;
        finished = true;
      }
    }
    drawChart();
    syncControls();
    if (event.type === 'end') {
      userBrushing = false;
      syncBrush();
    }
  }

  function syncBrush() {
    if (userBrushing || !xIndex || sorted.length < 2) return;
    const x0 = xIndex(from);
    const x1 = xIndex(clamp(cursor, from, to));
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
        .text('No values available for this metric.');
      svg.attr('aria-label', 'No values available for this metric');
      return;
    }

    const margin = { top: 28, right: 16, bottom: 42, left: 52 };
    const innerWidth = Math.max(1, width - margin.left - margin.right);
    if (series.length > 1) margin.top = drawLegend(svg, series, margin.left, innerWidth);
    const innerHeight = Math.max(1, height - margin.top - margin.bottom);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const span = Math.max(cursor - from, 1);
    const pad = span * 0.04;
    const x = d3.scaleLinear()
      .domain(sorted.length < 2 ? [-0.5, 0.5] : [from - pad, cursor + pad])
      .range([0, innerWidth]);
    const yValues = defined.map((point) => point.value);
    const y = d3.scaleLinear()
      .domain([Math.min(0, d3.min(yValues)), d3.max(yValues)])
      .nice()
      .range([innerHeight, 0]);

    const xAxis = d3.axisBottom(x)
      .tickValues(sorted.length < 2 ? [0] : xTickIndexes(from, cursor, innerWidth))
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

    if (playing || cursor < to - 0.02) {
      plot.append('line')
        .attr('class', 'timeline-playhead')
        .attr('x1', x(cursor))
        .attr('x2', x(cursor))
        .attr('y1', 0)
        .attr('y2', innerHeight);
    }

    const line = d3.line()
      .defined((point) => point.value != null)
      .x((point) => x(point.index))
      .y((point) => y(point.value));

    for (const item of series) {
      const visible = clipSeries(item.values, from, cursor);
      plot.append('path')
        .attr('class', 'chart-line')
        .attr('fill', 'none')
        .attr('stroke', item.color)
        .attr('stroke-width', 1.8)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', line(visible));

      plot.selectAll(null)
        .data(visible.filter((point) => point.value != null && !point.partial))
        .join('circle')
        .attr('class', 'chart-point')
        .attr('cx', (point) => x(point.index))
        .attr('cy', (point) => y(point.value))
        .attr('r', 3.4)
        .attr('fill', item.color)
        .on('mousemove', (event, point) => showTip(event, point, item.field))
        .on('mouseleave', hideTip);
    }

    svg.attr('aria-label', `Performance over time, ${rangeText()}`);
  }

  function render() {
    if (!plotHost.isConnected) {
      stopPlayback();
      observer.disconnect();
      return;
    }
    drawChart();
    const width = Math.round(dock.clientWidth);
    if (width > 40 && width !== brushWidth) layoutBrush(width);
    else syncBrush();
    syncControls();
  }

  playButton.addEventListener('click', play);
  pauseButton.addEventListener('click', pause);
  restartButton.addEventListener('click', restart);

  render();
  return {
    update(nextFields) {
      fields = nextFields;
      brushWidth = 0;
      render();
    },
    destroy() {
      stopPlayback();
      observer.disconnect();
    },
  };
}
