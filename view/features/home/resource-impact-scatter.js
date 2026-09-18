import { ROLE_COLORS, ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCount, formatFixed, formatImpact, formatPercent, formatRole } from '../../utils/formatting.js';
import { href, navigate } from '../../utils/navigation.js';

function eligiblePoints(players = []) {
  return players.filter((player) => {
    const gold = player.stats?.mean_gold_share;
    const impact = player.stats?.mean_impact;
    return (
      player.stats?.eligible &&
      gold != null &&
      impact != null &&
      Number.isFinite(gold) &&
      Number.isFinite(impact)
    );
  });
}

function radiusFor(nGames) {
  return 3.1 + Math.sqrt(20 + 1.4 * (nGames || 0)) * 0.42;
}

function createLegend(points) {
  const games = points.map((player) => player.stats.n_games || 0);
  const minGames = games.length ? Math.min(...games) : 10;
  const maxGames = games.length ? Math.max(...games) : 40;
  const sizes = [
    { n: minGames, label: `${formatCount(minGames)} games` },
    { n: maxGames, label: `${formatCount(maxGames)} games` },
  ];

  return h('div', { class: 'share-legend', 'aria-label': 'Size encodes game count; color encodes role' }, [
    h('div', { class: 'share-legend__kicker' }, ['Size · games']),
    h('div', { class: 'share-legend__kicker' }, ['Role']),
    h(
      'div',
      { class: 'share-legend__sizes' },
      sizes.map((stop) => {
        const diameter = `${Math.round(radiusFor(stop.n) * 2)}px`;
        return h('div', { class: 'share-legend__size' }, [
          h('span', {
            class: 'share-legend__ring',
            style: { width: diameter, height: diameter },
          }),
          h('span', { class: 'share-legend__caption' }, [stop.label]),
        ]);
      }),
    ),
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

export function createResourceImpactPanel({ players = [] }) {
  const points = eligiblePoints(players);
  const stage = h('div', { class: 'viz-stage home-scatter-stage', role: 'presentation' });
  const node = h('article', { class: 'viz-placeholder panel home-scatter-panel', dataset: { viz: 'resource-impact' } }, [
    h('div', { class: 'viz-placeholder__chrome' }, [
      h('span', {}, ['VIZ 01']),
      h('span', {}, ['Resource share and adjusted damage']),
    ]),
    stage,
    createLegend(points),
    h('p', { class: 'viz-placeholder__desc' }, [
      '2025 LPL · each point is one player, team and role with at least 10 evaluated games on 3 days. Point area increases with game count.',
    ]),
  ]);

  queueMicrotask(() => mountResourceImpactScatter(stage, { points }));
  return node;
}

export function mountResourceImpactScatter(stage, { points = [] }) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text('Mean gold share versus mean adjusted damage for eligible 2025 LPL players');
  stage.append(svg.node(), tooltip);

  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

  function hideTip() {
    tooltip.hidden = true;
  }

  function showTip(event, player) {
    tooltip.innerHTML = [
      `<div>${player.name} · ${formatRole(player.role)}</div>`,
      player.team?.name ? `<div>${player.team.name}</div>` : null,
      `<div>${formatCount(player.stats.n_games)} evaluated games</div>`,
      `<div>Gold share: ${formatPercent(player.stats.mean_gold_share)}</div>`,
      `<div>Adjusted damage: ${formatImpact(player.stats.mean_impact)}</div>`,
    ]
      .filter(Boolean)
      .join('');
    tooltip.hidden = false;
    const bounds = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 12, bounds.width - 180)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 12)}px`;
  }

  function openPlayer(player) {
    navigate(href.player(player.id, player.teamId, player.season));
  }

  function draw() {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, 380);
    if (width < 40) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    svg.append('title').text('Mean gold share versus mean adjusted damage for eligible 2025 LPL players');

    if (!points.length) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('No eligible players with gold share and adjusted damage.');
      return;
    }

    const margin = { top: 18, right: 18, bottom: 44, left: 64 };
    const innerWidth = Math.max(40, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const xMax = Math.max(0.2, d3.max(points, (player) => player.stats.mean_gold_share));
    const yExtent = d3.extent(points, (player) => player.stats.mean_impact);
    const yPad = Math.max(0.15, (yExtent[1] - yExtent[0]) * 0.08);
    const x = d3.scaleLinear().domain([0, xMax]).nice().range([0, innerWidth]);
    const y = d3.scaleLinear()
      .domain([Math.min(0, yExtent[0] - yPad), Math.max(0, yExtent[1] + yPad)])
      .nice()
      .range([innerHeight, 0]);

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(() => ''))
      .select('.domain')
      .remove();

    plot.append('line')
      .attr('class', 'chart-zero')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', y(0))
      .attr('y2', y(0));

    plot.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat((value) => formatPercent(value)).tickSizeOuter(0));

    plot.append('g')
      .attr('class', 'chart-axis')
      .call(d3.axisLeft(y).ticks(6).tickFormat((value) => formatFixed(value, 2)).tickSizeOuter(0));

    plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('x', innerWidth)
      .attr('y', innerHeight + 32)
      .attr('text-anchor', 'end')
      .text('Mean gold share');

    plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', 0)
      .attr('y', -50)
      .attr('text-anchor', 'end')
      .text('Mean adjusted damage');

    plot
      .selectAll('.home-scatter-dot')
      .data(points)
      .join('circle')
      .attr('class', 'home-scatter-dot')
      .attr('cx', (player) => x(player.stats.mean_gold_share))
      .attr('cy', (player) => y(player.stats.mean_impact))
      .attr('r', (player) => radiusFor(player.stats.n_games))
      .attr('fill', (player) => ROLE_COLORS[player.role] ?? '#7adfff')
      .attr('tabindex', 0)
      .attr('role', 'link')
      .attr(
        'aria-label',
        (player) =>
          `${player.name}, ${formatRole(player.role)}, ${player.team?.name ?? ''}. Gold ${formatPercent(player.stats.mean_gold_share)}, adjusted damage ${formatImpact(player.stats.mean_impact)}.`,
      )
      .on('mousemove', (event, player) => showTip(event, player))
      .on('mouseleave', hideTip)
      .on('focus', (event, player) => showTip(event, player))
      .on('blur', hideTip)
      .on('click', (_, player) => openPlayer(player))
      .on('keydown', (event, player) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPlayer(player);
        }
      });
  }

  draw();
  return {
    destroy() {
      observer.disconnect();
    },
  };
}
