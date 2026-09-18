import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCount, formatRole } from '../../utils/formatting.js';
import { PLACEHOLDER } from '../../utils/constants.js';
import { isEligible } from '../../utils/stats.js';

export function championPickCounts(games) {
  const counts = new Map();
  for (const game of games) {
    const champion = game.champion;
    if (!champion) continue;
    counts.set(champion, (counts.get(champion) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([champion, n]) => ({ champion, n }))
    .sort((a, b) => b.n - a.n || a.champion.localeCompare(b.champion));
}

function playerLabel(player) {
  const role = player.role ? formatRole(player.role) : PLACEHOLDER;
  return `${player.name} · ${role}`;
}

function gamesByPlayer(games) {
  const grouped = new Map();
  for (const game of games) {
    if (!game.playerId) continue;
    const list = grouped.get(game.playerId);
    if (list) list.push(game);
    else grouped.set(game.playerId, [game]);
  }
  return grouped;
}

export function createTeamChampionPanel({ players = [], games = [], teamName }) {
  const grouped = gamesByPlayer(games);
  const defaultPlayer =
    players.find((player) => championPickCounts(grouped.get(player.id) ?? []).length) ?? players[0] ?? null;

  const stage = h('div', { class: 'viz-stage team-champion-stage', role: 'presentation' });
  const noticeHost = h('div', { class: 'team-champion-notice' });
  const select = h(
    'select',
    { class: 'chart-select', 'aria-label': 'Player' },
    players.map((player) =>
      h('option', { value: player.id, selected: defaultPlayer && player.id === defaultPlayer.id }, [
        playerLabel(player),
      ]),
    ),
  );

  function playerById(id) {
    return players.find((player) => player.id === id) ?? null;
  }

  function syncNotice(player) {
    const notice = createEligibilityNotice(isEligible(player?.stats), 'player');
    noticeHost.replaceChildren(...(notice ? [notice] : []));
  }

  const node = h('article', { class: 'viz-placeholder panel team-champion-panel', dataset: { viz: 'team-champions' } }, [
    h('div', { class: 'viz-placeholder__chrome player-viz-chrome player-viz-chrome--stacked' }, [
      h('div', { class: 'player-viz-chrome__titles' }, [
        h('span', {}, ['VIZ 01']),
        h('span', {}, [teamName ? `Champion picks · ${teamName}` : 'Champion picks']),
      ]),
      h('div', { class: 'chart-controls' }, [
        h('label', { class: 'chart-control' }, ['Player', select]),
      ]),
    ]),
    noticeHost,
    stage,
  ]);

  syncNotice(defaultPlayer);

  queueMicrotask(() => {
    const chart = mountTeamChampionChart(stage, {
      rows: championPickCounts(grouped.get(select.value) ?? []),
      playerName: playerById(select.value)?.name,
    });
    select.addEventListener('change', () => {
      const player = playerById(select.value);
      syncNotice(player);
      chart.update({
        rows: championPickCounts(grouped.get(select.value) ?? []),
        playerName: player?.name,
      });
    });
  });

  return node;
}

export function mountTeamChampionChart(stage, { rows = [], playerName } = {}) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text('Champion pick frequency');
  stage.append(svg.node(), tooltip);

  let current = { rows, playerName };
  const observer = new ResizeObserver(() => draw());
  observer.observe(stage);

  function hideTip() {
    tooltip.hidden = true;
  }

  function showTip(event, row, total) {
    const share = total ? Math.round((row.n / total) * 100) : 0;
    tooltip.innerHTML = [
      `<div>${row.champion}</div>`,
      `<div>Games: ${formatCount(row.n)}</div>`,
      `<div>Share: ${share}%</div>`,
    ].join('');
    tooltip.hidden = false;
    const bounds = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX - bounds.left + 12, bounds.width - 160)}px`;
    tooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 12)}px`;
  }

  function draw() {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    const { rows: data, playerName: name } = current;
    const width = stage.clientWidth;
    if (width < 40) return;
    const height = Math.max(280, 52 + data.length * 28 + 36);
    stage.style.minHeight = `${height}px`;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    svg.append('title').text(
      name ? `Champion pick frequency for ${name}` : 'Champion pick frequency',
    );

    if (!data.length) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('No champion picks for this player.');
      return;
    }

    const margin = { top: 12, right: 44, bottom: 36, left: 128 };
    const innerWidth = Math.max(40, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const maxCount = d3.max(data, (row) => row.n) || 1;
    const total = d3.sum(data, (row) => row.n);
    const y = d3.scaleBand()
      .domain(data.map((row) => row.champion))
      .range([0, innerHeight])
      .padding(0.22);
    const x = d3.scaleLinear().domain([0, maxCount]).range([0, innerWidth]);
    const xTicks = x.ticks(Math.min(8, maxCount)).filter((tick) => Number.isInteger(tick));

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisBottom(x).tickValues(xTicks).tickSize(innerHeight).tickFormat(() => ''))
      .select('.domain')
      .remove();

    plot.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickValues(xTicks).tickFormat(d3.format('d')).tickSizeOuter(0));

    plot.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).tickSize(0).tickPadding(8));

    plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('x', innerWidth)
      .attr('y', innerHeight + 30)
      .attr('text-anchor', 'end')
      .text('Games');

    plot
      .selectAll('.chart-bar')
      .data(data)
      .join('rect')
      .attr('class', 'chart-bar')
      .attr('x', 0)
      .attr('y', (row) => y(row.champion))
      .attr('width', (row) => Math.max(0, x(row.n)))
      .attr('height', y.bandwidth())
      .attr('rx', 2)
      .attr('tabindex', 0)
      .attr('role', 'img')
      .attr('aria-label', (row) => `${row.champion}, ${formatCount(row.n)} games`)
      .on('mousemove', (event, row) => showTip(event, row, total))
      .on('mouseleave', hideTip)
      .on('focus', (event, row) => showTip(event, row, total))
      .on('blur', hideTip);

    plot
      .selectAll('.chart-bar-count')
      .data(data)
      .join('text')
      .attr('class', 'chart-bar-count')
      .attr('pointer-events', 'none')
      .attr('x', (row) => x(row.n) + 6)
      .attr('y', (row) => y(row.champion) + y.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .text((row) => formatCount(row.n));
  }

  draw();
  return {
    update(next) {
      current = { rows: next.rows ?? [], playerName: next.playerName };
      hideTip();
      draw();
    },
    destroy() {
      observer.disconnect();
    },
  };
}
