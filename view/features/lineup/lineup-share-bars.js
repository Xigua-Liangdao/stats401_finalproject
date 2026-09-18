import { ROLE_COLORS, ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCount, formatPercent, formatRole } from '../../utils/formatting.js';
import { href } from '../../utils/navigation.js';

const SHARE_METRICS = [
  { id: 'damage_share', label: 'Damage share' },
  { id: 'gold_share', label: 'Gold share' },
];

function mean(values) {
  return values.length ? d3.mean(values) : null;
}

function playerBars(games, lineup, field) {
  const roster = Object.fromEntries((lineup.players ?? []).map((player) => [player.role, player]));
  return ROLE_ORDER.map((role) => {
    const player = roster[role] ?? null;
    const slot = games.find((game) => game.roles?.[role])?.roles?.[role];
    const values = games
      .map((game) => game.roles?.[role]?.[field])
      .filter((value) => value != null && Number.isFinite(value));
    return {
      role,
      player,
      name: player?.name ?? slot?.name ?? formatRole(role),
      value: mean(values),
      n: values.length,
    };
  });
}

export function createLineupShareBarsPanel({ lineup, games = [] }) {
  const stage = h('div', { class: 'viz-stage lineup-share-bars-stage', role: 'presentation' });
  const select = h(
    'select',
    { class: 'chart-select', 'aria-label': 'Share metric' },
    SHARE_METRICS.map((metric) => h('option', { value: metric.id }, [metric.label])),
  );

  const node = h('article', { class: 'viz-placeholder panel lineup-share-bars-panel', dataset: { viz: 'lineup-share-bars' } }, [
    h('div', { class: 'viz-placeholder__chrome player-viz-chrome player-viz-chrome--stacked' }, [
      h('div', { class: 'player-viz-chrome__titles' }, [
        h('span', {}, ['VIZ 02']),
        h('span', {}, ['Player shares']),
      ]),
      h('div', { class: 'chart-controls' }, [
        h('label', { class: 'chart-control' }, ['Metric', select]),
      ]),
    ]),
    stage,
  ]);

  queueMicrotask(() => {
    const chart = mountLineupShareBars(stage, {
      rows: playerBars(games, lineup, select.value),
      metric: SHARE_METRICS.find((item) => item.id === select.value),
    });
    select.addEventListener('change', () => {
      chart.update({
        rows: playerBars(games, lineup, select.value),
        metric: SHARE_METRICS.find((item) => item.id === select.value),
      });
    });
  });

  return node;
}

export function mountLineupShareBars(stage, { rows = [], metric } = {}) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text('Player gold or damage share');
  stage.append(svg.node(), tooltip);

  let current = { rows, metric };
  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

  function hideTip() {
    tooltip.hidden = true;
  }

  function showTip(event, row) {
    tooltip.innerHTML = [
      `<div>${row.name} · ${formatRole(row.role)}</div>`,
      `<div>${current.metric?.label ?? 'Share'}: ${formatPercent(row.value)}</div>`,
      `<div>Games: ${formatCount(row.n)}</div>`,
    ].join('');
    tooltip.hidden = false;
    const bounds = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 12, bounds.width - 160)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 12)}px`;
  }

  function openPlayer(row) {
    const player = row.player;
    if (!player) return;
    window.location.hash = href.player(player.id, player.teamId, player.season);
  }

  function draw() {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    const { rows: data, metric: active } = current;
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, 280);
    if (width < 40) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    svg.append('title').text(active ? `Player ${active.label.toLowerCase()}` : 'Player shares');

    const scored = data.filter((row) => row.value != null && Number.isFinite(row.value));
    if (!scored.length) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('No related-game shares for this lineup.');
      return;
    }

    const margin = { top: 16, right: 16, bottom: 48, left: 52 };
    const innerWidth = Math.max(40, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scaleBand()
      .domain(data.map((row) => row.role))
      .range([0, innerWidth])
      .padding(0.28);
    const yMax = Math.max(0.2, d3.max(scored, (row) => row.value));
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => ''))
      .select('.domain')
      .remove();

    plot.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(x)
          .tickFormat((role) => data.find((row) => row.role === role)?.name ?? formatRole(role))
          .tickSizeOuter(0),
      )
      .selectAll('text')
      .attr('transform', 'rotate(-28)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.3em')
      .attr('dy', '0.4em');

    plot.append('g')
      .attr('class', 'chart-axis')
      .call(d3.axisLeft(y).ticks(5).tickFormat((value) => formatPercent(value)).tickSizeOuter(0));

    plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', 0)
      .attr('y', -40)
      .attr('text-anchor', 'end')
      .text(active?.label ?? 'Share');

    plot
      .selectAll('.share-bar')
      .data(data)
      .join('rect')
      .attr('class', 'share-bar')
      .attr('x', (row) => x(row.role))
      .attr('y', (row) => (row.value == null ? innerHeight : y(row.value)))
      .attr('width', x.bandwidth())
      .attr('height', (row) => (row.value == null ? 0 : Math.max(0, innerHeight - y(row.value))))
      .attr('rx', 2)
      .attr('fill', (row) => ROLE_COLORS[row.role] ?? '#7adfff')
      .attr('tabindex', 0)
      .attr('role', 'link')
      .attr(
        'aria-label',
        (row) => `${row.name}, ${formatRole(row.role)}, ${active?.label ?? 'share'} ${formatPercent(row.value)}`,
      )
      .on('mousemove', (event, row) => showTip(event, row))
      .on('mouseleave', hideTip)
      .on('focus', (event, row) => showTip(event, row))
      .on('blur', hideTip)
      .on('click', (_, row) => openPlayer(row))
      .on('keydown', (event, row) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPlayer(row);
        }
      });

    plot
      .selectAll('.share-bar-value')
      .data(scored)
      .join('text')
      .attr('class', 'chart-bar-count')
      .attr('pointer-events', 'none')
      .attr('x', (row) => x(row.role) + x.bandwidth() / 2)
      .attr('y', (row) => y(row.value) - 6)
      .attr('text-anchor', 'middle')
      .text((row) => formatPercent(row.value));
  }

  draw();
  return {
    update(next) {
      current = { rows: next.rows ?? [], metric: next.metric };
      hideTip();
      draw();
    },
    destroy() {
      observer.disconnect();
    },
  };
}
