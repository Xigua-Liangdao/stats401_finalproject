import { d3 } from '../../utils/d3.js';
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

export function mountPlayerTimeline(stage, { games }) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const sorted = sortByDate(games);
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  stage.append(svg.node(), tooltip);

  let fields = ['kills', 'deaths', 'assists'];
  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

  function hideTip() {
    tooltip.hidden = true;
  }

  function showTip(event, point, field) {
    tooltip.innerHTML = tooltipLines(point.game, field, point.value)
      .map((line) => `<div>${line}</div>`)
      .join('');
    tooltip.hidden = false;
    const bounds = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 12, bounds.width - 180)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 12)}px`;
  }

  function draw() {
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, 280);
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
      return;
    }

    const margin = { top: 28, right: 16, bottom: 42, left: 52 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scalePoint()
      .domain(sorted.map((_, index) => index))
      .range([0, innerWidth])
      .padding(0.2);
    const yValues = defined.map((point) => point.value);
    const y0 = Math.min(0, d3.min(yValues));
    const y1 = d3.max(yValues);
    const y = d3.scaleLinear()
      .domain([y0, y1])
      .nice()
      .range([innerHeight, 0]);

    const tickStep = Math.max(1, Math.ceil(sorted.length / Math.max(4, Math.floor(innerWidth / 72))));
    const xAxis = d3.axisBottom(x)
      .tickValues(sorted.map((_, index) => index).filter((index) => index % tickStep === 0 || index === sorted.length - 1))
      .tickFormat((index) => formatCompactDate(sorted[index].date))
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
      plot.append('path')
        .attr('class', 'chart-line')
        .attr('fill', 'none')
        .attr('stroke', item.color)
        .attr('stroke-width', 1.8)
        .attr('d', line(item.values));

      plot.selectAll(null)
        .data(item.values.filter((point) => point.value != null))
        .join('circle')
        .attr('class', 'chart-point')
        .attr('cx', (point) => x(point.index))
        .attr('cy', (point) => y(point.value))
        .attr('r', 3.4)
        .attr('fill', item.color)
        .on('mousemove', (event, point) => showTip(event, point, item.field))
        .on('mouseleave', hideTip);
    }

    if (series.length > 1) {
      const legend = svg.append('g').attr('class', 'chart-legend').attr('transform', `translate(${margin.left},${14})`);
      series.forEach((item, index) => {
        const entry = legend.append('g').attr('transform', `translate(${index * 128},0)`);
        entry.append('rect').attr('width', 8).attr('height', 8).attr('y', -7).attr('fill', item.color);
        entry.append('text').attr('x', 12).attr('font-size', 10).text(item.label);
      });
    }
  }

  draw();
  return {
    update(nextFields) {
      fields = nextFields;
      draw();
    },
    destroy() {
      observer.disconnect();
    },
  };
}
