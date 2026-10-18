import {
  AXIS_TICKS,
  CHART_MIN_HEIGHT,
  CHART_MIN_WIDTH,
  SHARE_DOMAIN_FLOOR,
  COARSE_AXIS_TICKS,
  PHONE_MEDIA,
  TOOLTIP_RESERVE,
  AXIS_TURN_DEG,
  VERTICAL_LABEL,
  placeTooltip,
} from '../../utils/chart-layout.js';
import { ROLE_COLORS, ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatCompactDate, formatPercent, formatRole } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { href } from '../../utils/navigation.js';
import { createTooltipWatch, trackUi } from '../../utils/track.js';
import { createGameMark } from './lineup-range-dock.js';
import { mixValue, roleValue } from './lineup-playback.js';

const PHONE_MARGIN = { top: 12, right: 8, bottom: 58, left: 34 };
const DESKTOP_MARGIN = { top: 16, right: 16, bottom: 48, left: 52 };
const PHONE_BAND_PADDING = 0.18;
const DESKTOP_BAND_PADDING = 0.28;
const SERIES_BAND_PADDING = 0.12;
const BAR_LABEL_MIN = 36;
const BAR_LABEL_MIN_WIDTH = 12;
const PHONE_NAME_ANGLE = -40;
const DESKTOP_NAME_ANGLE = -28;
const PHONE_LABEL_FONT = 8;
const PHONE_TICK_PADDING = 2;
const DESKTOP_TICK_PADDING = 3;
const PHONE_AXIS_FONT = 9;
const PHONE_TICK_Y = -8;
const PHONE_Y_LABEL_OFFSET = -24;
const DESKTOP_Y_LABEL_OFFSET = -40;
const BAR_RADIUS = 2;
const COUNT_ABOVE_GAP = 4;
const COUNT_DY = '0.32em';
const COUNT_FILL = '#102033';
const NAME_DX = '-0.2em';
const NAME_DY = '0.35em';

const SHARE_SERIES = [
  { id: 'gold_share', tone: 'gold', get label() { return t('common.goldShare'); } },
  { id: 'damage_share', tone: 'damage', get label() { return t('common.damageShare'); } },
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

function shareMax(games) {
  const values = games.flatMap((game) => SHARE_SERIES.flatMap((series) => (
    ROLE_ORDER.map((role) => roleValue(game, role, series.id))
  )));
  return Math.max(SHARE_DOMAIN_FLOOR, d3.max(values.filter((value) => value != null)) ?? SHARE_DOMAIN_FLOOR);
}

function shareLegend() {
  return h('div', { class: 'share-pair-legend', 'aria-label': t('lineup.vizShares') }, SHARE_SERIES.map((series) => (
    h('span', {}, [
      h('i', { class: `share-pair-legend__swatch share-pair-legend__swatch--${series.tone}`, 'aria-hidden': 'true' }),
      series.label,
    ])
  )));
}

export function createLineupShareBarsPanel({ lineup, games = [], playback }) {
  const stage = h('div', { class: 'viz-stage lineup-share-bars-stage', role: 'presentation' });
  const node = h('article', { class: 'viz-placeholder panel lineup-share-bars-panel', dataset: { viz: 'lineup-share-bars' } }, [
    h('div', { class: 'viz-placeholder__chrome player-viz-chrome player-viz-chrome--stacked' }, [
      h('div', { class: 'player-viz-chrome__titles' }, [
        h('span', {}, [t('lineup.vizMark2')]),
        h('span', {}, [t('lineup.vizShares')]),
      ]),
      shareLegend(),
    ]),
    stage,
  ]);

  queueMicrotask(() => {
    mountLineupShareBars(stage, {
      rows: rosterRows(lineup, games),
      games,
      playback,
    });
  });

  return node;
}

export function mountLineupShareBars(stage, { rows = [], games = [], playback } = {}) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();

  const frameLabel = h('p', { class: 'timeline-range lineup-frame-label' });
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const tooltipWatch = createTooltipWatch('lineup-share-bars');
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text(t('lineup.sameGame'));
  stage.append(frameLabel, svg.node(), tooltip);

  let frameState = null;
  let x = null;
  let xSeries = null;
  let y = null;
  let innerHeight = 1;
  let labelBars = true;
  const observer = new ResizeObserver(() => layout());
  observer.observe(stage);

  function hideTip() {
    tooltip.hidden = true;
    tooltipWatch.hide();
  }

  function shownValue(row, field) {
    if (!frameState) return null;
    if (frameState.mode !== 'dynamic') {
      const values = [];
      for (let index = frameState.from; index <= frameState.to; index += 1) {
        const value = roleValue(frameState.games[index], row.role, field);
        if (value != null) values.push(value);
      }
      return values.length ? d3.mean(values) : null;
    }
    return mixValue(
      roleValue(frameState.games[frameState.previous], row.role, field),
      roleValue(frameState.games[frameState.index], row.role, field),
      frameState.progress,
    );
  }

  function showTip(event, row) {
    const game = frameState?.games?.[frameState.landed ?? frameState.index];
    const subject = row.player?.id || row.role;
    const shownGame = frameState?.mode === 'dynamic' && game ? game.id : 'range';
    tooltipWatch.show(`${subject}|${shownGame}`);
    const count = frameState ? frameState.to - frameState.from + 1 : 0;
    tooltip.innerHTML = [
      `<div>${row.name} · ${formatRole(row.role)}</div>`,
      frameState?.mode === 'dynamic' && game
        ? `<div class="lineup-tip-game">${createGameMark(game).outerHTML}<span>${formatCompactDate(game.date)}</span></div>`
        : `<div>${t('lineup.meanOf', { count, unit: count === 1 ? t('common.game') : t('common.gamesWord') })}</div>`,
      ...SHARE_SERIES.map((series) => `<div>${t('lineup.tipShare', { label: series.label, value: formatPercent(shownValue(row, series.id)) })}</div>`),
    ].filter(Boolean).join('');
    tooltip.hidden = false;
    placeTooltip(tooltip, event, stage, TOOLTIP_RESERVE);
  }

  function openPlayer(row, series) {
    const player = row.player;
    if (!player) return;
    trackUi({
      event_name: 'click',
      target_type: 'share_bar',
      target_id: `${player.id}|${series?.id || row.role}`,
    });
    window.location.hash = href.player(player.id, player.teamId, player.season);
  }

  function layout() {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, CHART_MIN_HEIGHT);
    if (width < CHART_MIN_WIDTH) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    svg.append('title').text(t('lineup.vizShares'));

    const hasShare = games.some((game) => rows.some((row) => (
      SHARE_SERIES.some((series) => roleValue(game, row.role, series.id) != null)
    )));
    if (!rows.length || !hasShare) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text(t('lineup.noShares'));
      return;
    }

    const phone = window.matchMedia(PHONE_MEDIA).matches;
    const margin = phone ? PHONE_MARGIN : DESKTOP_MARGIN;
    const innerWidth = Math.max(CHART_MIN_WIDTH, width - margin.left - margin.right);
    innerHeight = height - margin.top - margin.bottom;
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    x = d3.scaleBand().domain(rows.map((row) => row.role)).range([0, innerWidth]).padding(phone ? PHONE_BAND_PADDING : DESKTOP_BAND_PADDING);
    xSeries = d3.scaleBand().domain(SHARE_SERIES.map((series) => series.id)).range([0, x.bandwidth()]).padding(SERIES_BAND_PADDING);
    y = d3.scaleLinear().domain([0, shareMax(games)]).nice().range([innerHeight, 0]);
    labelBars = xSeries.bandwidth() >= BAR_LABEL_MIN;

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(AXIS_TICKS).tickSize(-innerWidth).tickFormat(() => ''))
      .select('.domain')
      .remove();
    const names = plot.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickFormat((role) => rows.find((row) => row.role === role)?.name ?? formatRole(role)).tickSizeOuter(0));
    names.selectAll('text')
      .attr('transform', phone ? `rotate(${PHONE_NAME_ANGLE})` : `rotate(${DESKTOP_NAME_ANGLE})`)
      .style('font-size', phone ? `${PHONE_LABEL_FONT}px` : null)
      .style('fill', (role) => ROLE_COLORS[role] ?? null)
      .attr('text-anchor', 'end')
      .attr('dx', NAME_DX)
      .attr('dy', NAME_DY);
    const yAxis = plot.append('g')
      .attr('class', 'chart-axis chart-axis--y')
      .call(d3.axisLeft(y).ticks(COARSE_AXIS_TICKS).tickFormat((value) => formatPercent(value)).tickSizeOuter(0).tickPadding(phone ? PHONE_TICK_PADDING : DESKTOP_TICK_PADDING));
    if (phone) {
      yAxis.selectAll('text')
        .style('font-size', `${PHONE_AXIS_FONT}px`)
        .attr('transform', VERTICAL_LABEL)
        .attr('text-anchor', 'middle')
        .attr('x', 0)
        .attr('dx', null)
        .attr('dy', null)
        .attr('y', PHONE_TICK_Y);
    }
    const yLabel = plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('transform', VERTICAL_LABEL)
      .attr('x', 0)
      .attr('y', phone ? PHONE_Y_LABEL_OFFSET : DESKTOP_Y_LABEL_OFFSET)
      .attr('text-anchor', 'end')
      .text(t('common.share'));
    if (phone) yLabel.style('font-size', `${PHONE_AXIS_FONT}px`);

    const marks = plot.selectAll('.share-mark').data(rows).join('g')
      .attr('class', 'share-mark')
      .attr('transform', (row) => `translate(${x(row.role)},0)`);
    marks.selectAll('.share-bar')
      .data((row) => SHARE_SERIES.map((series) => ({ row, series })))
      .join('rect')
      .attr('class', (item) => `share-bar share-bar--${item.series.tone}`)
      .attr('x', (item) => xSeries(item.series.id))
      .attr('width', xSeries.bandwidth())
      .attr('rx', BAR_RADIUS)
      .attr('tabindex', 0)
      .attr('role', 'link')
      .on('mousemove', (event, item) => showTip(event, item.row))
      .on('mouseleave', hideTip)
      .on('focus', (event, item) => showTip(event, item.row))
      .on('blur', hideTip)
      .on('click', (_, item) => openPlayer(item.row, item.series))
      .on('keydown', (event, item) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPlayer(item.row, item.series);
        }
      });
    marks.selectAll('.chart-bar-count')
      .data((row) => SHARE_SERIES.map((series) => ({ row, series })))
      .join('text')
      .attr('class', 'chart-bar-count')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .style('font-size', phone ? `${PHONE_LABEL_FONT}px` : null);
    paint(frameState);
  }

  function paint(state) {
    frameState = state;
    const game = state?.games?.[state.landed ?? state.index];
    frameLabel.replaceChildren();
    if (state?.mode === 'dynamic' && game) {
      frameLabel.append(createGameMark(game), formatCompactDate(game.date));
    } else {
      frameLabel.textContent = t('lineup.meanSelected');
    }
    if (!x || !xSeries || !y || !state) return;
    const settled = state.mode === 'dynamic' && state.phase === 'hold';
    svg.selectAll('.share-bar').each(function bar(item) {
      const value = shownValue(item.row, item.series.id);
      const top = value == null ? innerHeight : y(value);
      d3.select(this)
        .attr('y', top)
        .attr('height', value == null ? 0 : Math.max(0, innerHeight - top))
        .classed('is-settled', settled && value != null)
        .attr('aria-label', `${item.row.name}, ${formatRole(item.row.role)}, ${item.series.label} ${formatPercent(value)}`);
    });
    svg.selectAll('.chart-bar-count').each(function label(item) {
      const value = shownValue(item.row, item.series.id);
      const text = d3.select(this);
      if (value == null) {
        text.text('');
        return;
      }
      const top = y(value);
      const barHeight = Math.max(0, innerHeight - top);
      const barWidth = xSeries.bandwidth();
      const center = xSeries(item.series.id) + barWidth / 2;
      const caption = formatPercent(value);
      if (labelBars) {
        text.attr('transform', null)
          .attr('x', center)
          .attr('y', top - COUNT_ABOVE_GAP)
          .style('fill', null)
          .text(caption);
        return;
      }
      if (barHeight >= BAR_LABEL_MIN && barWidth >= BAR_LABEL_MIN_WIDTH) {
        text.attr('transform', `rotate(${AXIS_TURN_DEG}, ${center}, ${top + barHeight / 2})`)
          .attr('x', center)
          .attr('y', top + barHeight / 2)
          .attr('dy', COUNT_DY)
          .style('fill', COUNT_FILL)
          .text(caption);
        return;
      }
      text.text('');
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
    destroy() {
      unsubscribe();
      observer.disconnect();
    },
  };
}
