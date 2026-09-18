import { openLineupGameInfo } from '../lineup-games/lineup-game-info.js?v=game-stats';
import { ROLE_COLORS, ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCompactDate, formatDate, formatPercent, formatResult, formatRole, parseGameDate } from '../../utils/formatting.js';

function datedGames(games) {
  return [...games]
    .map((game) => ({ game, time: parseGameDate(game.date)?.getTime() ?? 0 }))
    .sort((a, b) => a.time - b.time || String(a.game.id).localeCompare(String(b.game.id)));
}

function pointsFromGames(games) {
  const dated = datedGames(games);
  const last = Math.max(1, dated.length - 1);
  const points = [];

  dated.forEach(({ game }, index) => {
    const recency = dated.length === 1 ? 1 : index / last;
    for (const role of ROLE_ORDER) {
      const slot = game.roles?.[role];
      if (!slot) continue;
      const goldShare = slot.gold_share;
      const damageShare = slot.damage_share;
      if (goldShare == null || damageShare == null || !Number.isFinite(goldShare) || !Number.isFinite(damageShare)) {
        continue;
      }
      points.push({
        game,
        role,
        playerId: slot.id,
        name: slot.name,
        goldShare,
        damageShare,
        recency,
      });
    }
  });

  return points;
}

function radiusFor(recency) {
  return 2.8 + recency * 6.2;
}

function createShareLegend(games) {
  const dated = datedGames(games);
  const oldest = dated[0]?.game.date;
  const newest = dated[dated.length - 1]?.game.date;
  const stops = [
    { recency: 0, label: oldest ? formatCompactDate(oldest) : 'Oldest' },
    { recency: 0.5, label: '→' },
    { recency: 1, label: newest ? formatCompactDate(newest) : 'Newest' },
  ];

  return h('div', { class: 'share-legend', 'aria-label': 'Size encodes recency; color encodes role' }, [
    h('div', { class: 'share-legend__kicker' }, ['Size · recency']),
    h('div', { class: 'share-legend__kicker' }, ['Role']),
    h(
      'div',
      { class: 'share-legend__sizes' },
      stops.map((stop) => {
        const diameter = `${Math.round(radiusFor(stop.recency) * 2)}px`;
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

export function createLineupShareScatterPanel({ games = [] }) {
  const stage = h('div', { class: 'viz-stage lineup-share-stage', role: 'presentation' });
  const node = h('article', { class: 'viz-placeholder panel lineup-share-panel', dataset: { viz: 'lineup-share-scatter' } }, [
    h('div', { class: 'viz-placeholder__chrome' }, [
      h('span', {}, ['VIZ 01']),
      h('span', {}, ['Gold share vs damage share']),
    ]),
    stage,
    createShareLegend(games),
  ]);

  queueMicrotask(() => {
    mountLineupShareScatter(stage, { games });
  });

  return node;
}

export function mountLineupShareScatter(stage, { games = [] }) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const points = pointsFromGames(games);
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text('Related-game gold share versus damage share');
  stage.append(svg.node(), tooltip);

  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

  function hideTip() {
    tooltip.hidden = true;
  }

  function showTip(event, point) {
    const opponent = point.game.opponent?.name ?? point.game.opponent?.short;
    tooltip.innerHTML = [
      `<div>${point.name ?? point.playerId} · ${formatRole(point.role)}</div>`,
      `<div>${formatDate(point.game.date)} · ${formatResult(point.game.result)}</div>`,
      opponent ? `<div>vs ${opponent}</div>` : null,
      `<div>Gold share: ${formatPercent(point.goldShare)}</div>`,
      `<div>Damage share: ${formatPercent(point.damageShare)}</div>`,
    ]
      .filter(Boolean)
      .join('');
    tooltip.hidden = false;
    const bounds = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 12, bounds.width - 180)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 12)}px`;
  }

  function setActiveGame(gameId) {
    svg.selectAll('.share-dot').classed('is-linked', (point) => Boolean(gameId && point.game.id === gameId));
  }

  function draw() {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, 320);
    if (width < 40) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    svg.append('title').text('Related-game gold share versus damage share');

    if (!points.length) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('No related games with gold and damage shares.');
      return;
    }

    const margin = { top: 18, right: 18, bottom: 44, left: 58 };
    const innerWidth = Math.max(40, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const xMax = Math.max(0.2, d3.max(points, (point) => point.goldShare));
    const yMax = Math.max(0.2, d3.max(points, (point) => point.damageShare));
    const x = d3.scaleLinear().domain([0, xMax]).nice().range([0, innerWidth]);
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => ''))
      .select('.domain')
      .remove();

    plot.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((value) => formatPercent(value)).tickSizeOuter(0));

    plot.append('g')
      .attr('class', 'chart-axis')
      .call(d3.axisLeft(y).ticks(5).tickFormat((value) => formatPercent(value)).tickSizeOuter(0));

    plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('x', innerWidth)
      .attr('y', innerHeight + 32)
      .attr('text-anchor', 'end')
      .text('Gold share');

    plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', 0)
      .attr('y', -44)
      .attr('text-anchor', 'end')
      .text('Damage share');

    plot
      .selectAll('.share-dot')
      .data(points)
      .join('circle')
      .attr('class', 'share-dot')
      .attr('cx', (point) => x(point.goldShare))
      .attr('cy', (point) => y(point.damageShare))
      .attr('r', (point) => radiusFor(point.recency))
      .attr('fill', (point) => ROLE_COLORS[point.role] ?? '#7adfff')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr(
        'aria-label',
        (point) =>
          `${point.name ?? point.playerId}, ${formatRole(point.role)}, ${formatDate(point.game.date)}. Gold ${formatPercent(point.goldShare)}, damage ${formatPercent(point.damageShare)}.`,
      )
      .on('mousemove', (event, point) => {
        setActiveGame(point.game.id);
        showTip(event, point);
      })
      .on('mouseleave', () => {
        setActiveGame(null);
        hideTip();
      })
      .on('focus', (event, point) => {
        setActiveGame(point.game.id);
        showTip(event, point);
      })
      .on('blur', () => {
        setActiveGame(null);
        hideTip();
      })
      .on('click', (_, point) => openLineupGameInfo(point.game))
      .on('keydown', (event, point) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLineupGameInfo(point.game);
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
