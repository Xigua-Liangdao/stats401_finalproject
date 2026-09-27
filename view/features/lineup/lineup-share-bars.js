import { ROLE_COLORS, ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCompactDate, formatPercent, formatRole } from '../../utils/formatting.js';
import { href } from '../../utils/navigation.js';
import { createGameMark } from './lineup-range-dock.js';
import { mixValue, roleValue } from './lineup-playback.js';

const SHARE_METRICS = [
  { id: 'damage_share', label: 'Damage share' },
  { id: 'gold_share', label: 'Gold share' },
];

function rosterRows(lineup, games) {
  const roster = Object.fromEntries((lineup.players ?? []).map((player) => [player.role, player]));
  return ROLE_ORDER.map((role) => {
    const player = roster[role] ?? null;
    const slot = games.find((game) => game.roles?.[role])?.roles?.[role];
    return {
      role,
      player,
      name: player?.name ?? slot?.name ?? formatRole(role),
    };
  });
}

function metricMax(games, field) {
  const values = games.flatMap((game) => ROLE_ORDER.map((role) => roleValue(game, role, field)));
  return Math.max(0.2, d3.max(values.filter((value) => value != null)) ?? 0.2);
}

export function createLineupShareBarsPanel({ lineup, games = [], playback }) {
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
      rows: rosterRows(lineup, games),
      games,
      playback,
      metric: SHARE_METRICS.find((item) => item.id === select.value),
    });
    select.addEventListener('change', () => {
      chart.update({
        metric: SHARE_METRICS.find((item) => item.id === select.value),
      });
    });
  });

  return node;
}

export function mountLineupShareBars(stage, { rows = [], games = [], playback, metric } = {}) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const frameLabel = h('p', { class: 'timeline-range lineup-frame-label' });
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text('Player shares for the same game as the scatter');
  stage.append(frameLabel, svg.node(), tooltip);

  let activeMetric = metric;
  let frameState = null;
  let x = null;
  let y = null;
  let innerHeight = 1;
  const margin = { top: 16, right: 16, bottom: 48, left: 52 };
  const observer = new ResizeObserver(() => layout());
  observer.observe(stage);

  function hideTip() {
    tooltip.hidden = true;
  }

  function shownValue(row) {
    if (!frameState || !activeMetric) return null;
    if (frameState.mode !== 'dynamic') {
      const values = [];
      for (let index = frameState.from; index <= frameState.to; index += 1) {
        const value = roleValue(frameState.games[index], row.role, activeMetric.id);
        if (value != null) values.push(value);
      }
      return values.length ? d3.mean(values) : null;
    }
    return mixValue(
      roleValue(frameState.games[frameState.previous], row.role, activeMetric.id),
      roleValue(frameState.games[frameState.index], row.role, activeMetric.id),
      frameState.progress,
    );
  }

  function showTip(event, row) {
    const game = frameState?.games?.[frameState.landed ?? frameState.index];
    const count = frameState ? frameState.to - frameState.from + 1 : 0;
    tooltip.innerHTML = [
      `<div>${row.name} · ${formatRole(row.role)}</div>`,
      frameState?.mode === 'dynamic' && game
        ? `<div class="lineup-tip-game">${createGameMark(game).outerHTML}<span>${formatCompactDate(game.date)}</span></div>`
        : `<div>Mean · ${count} ${count === 1 ? 'game' : 'games'}</div>`,
      `<div>${activeMetric?.label ?? 'Share'}: ${formatPercent(shownValue(row))}</div>`,
    ].filter(Boolean).join('');
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

  function layout() {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, 280);
    if (width < 40) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    svg.append('title').text(activeMetric ? `Player ${activeMetric.label.toLowerCase()}` : 'Player shares');

    const field = activeMetric?.id ?? 'damage_share';
    const hasShare = games.some((game) => rows.some((row) => roleValue(game, row.role, field) != null));
    if (!rows.length || !hasShare) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('No related-game shares for this lineup.');
      return;
    }

    const innerWidth = Math.max(40, width - margin.left - margin.right);
    innerHeight = height - margin.top - margin.bottom;
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    x = d3.scaleBand().domain(rows.map((row) => row.role)).range([0, innerWidth]).padding(0.28);
    y = d3.scaleLinear().domain([0, metricMax(games, field)]).nice().range([innerHeight, 0]);

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => ''))
      .select('.domain')
      .remove();
    plot.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickFormat((role) => rows.find((row) => row.role === role)?.name ?? formatRole(role)).tickSizeOuter(0))
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
      .text(activeMetric?.label ?? 'Share');

    const marks = plot.selectAll('.share-mark').data(rows).join('g').attr('class', 'share-mark');
    marks.append('rect')
      .attr('class', 'share-bar')
      .attr('x', (row) => x(row.role))
      .attr('width', x.bandwidth())
      .attr('rx', 2)
      .attr('fill', (row) => ROLE_COLORS[row.role] ?? '#7adfff')
      .attr('tabindex', 0)
      .attr('role', 'link')
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
    marks.append('text')
      .attr('class', 'chart-bar-count')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle');
    paint(frameState);
  }

  function paint(state) {
    frameState = state;
    const game = state?.games?.[state.landed ?? state.index];
    frameLabel.replaceChildren();
    if (state?.mode === 'dynamic' && game) {
      frameLabel.append(createGameMark(game), formatCompactDate(game.date));
    } else {
      frameLabel.textContent = 'Mean of selected games';
    }
    if (!x || !y || !state) return;
    const settled = state.mode === 'dynamic' && state.phase === 'hold';
    svg.selectAll('.share-mark').each(function mark(row) {
      const value = shownValue(row);
      const node = d3.select(this);
      const top = value == null ? innerHeight : y(value);
      node.select('.share-bar')
        .attr('y', top)
        .attr('height', value == null ? 0 : Math.max(0, innerHeight - top))
        .classed('is-settled', settled && value != null)
        .attr('aria-label', `${row.name}, ${formatRole(row.role)}, ${activeMetric?.label ?? 'share'} ${formatPercent(value)}`);
      node.select('.chart-bar-count')
        .attr('x', x(row.role) + x.bandwidth() / 2)
        .attr('y', value == null ? innerHeight : top - 6)
        .text(value == null ? '' : formatPercent(value));
    });
  }

  let unsubscribe = () => {};
  unsubscribe = playback?.subscribe((state) => {
    if (!stage.isConnected) {
      unsubscribe();
      return;
    }
    paint(state);
  }) ?? unsubscribe;

  layout();
  return {
    update(next) {
      if (next.metric) activeMetric = next.metric;
      hideTip();
      x = null;
      layout();
    },
    destroy() {
      unsubscribe();
      observer.disconnect();
    },
  };
}
