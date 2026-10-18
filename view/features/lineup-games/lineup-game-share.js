import {
  CHART_MIN_WIDTH,
  COARSE_AXIS_TICKS,
  SHARE_DOMAIN_FLOOR,
  SHARE_DOT_RADIUS,
  TOOLTIP_RESERVE,
  VERTICAL_LABEL,
  placeTooltip,
} from '../../utils/chart-layout.js';
import { ROLE_COLORS, ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { h } from '../../utils/dom.js';
import { formatPercent, formatRole } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { createTooltipWatch } from '../../utils/track.js';
import { roleValue } from '../lineup/lineup-playback.js';

const MARGIN = { top: 16, right: 12, bottom: 36, left: 58 };
const MIN_HEIGHT = 240;
const X_LABEL_OFFSET = 28;
const Y_LABEL_OFFSET = -44;
const HIGHLIGHT_DOT_PAD = 1.6;
const FALLBACK_ROLE_COLOR = '#7adfff';
const MISSING_SHARE_DISTANCE = 1;
const DATE_KEY_LENGTH = 10;

function dayKey(value) {
  return value ? String(value).slice(0, DATE_KEY_LENGTH) : '';
}

function shareDistance(game, playerGame, role) {
  const slot = game.roles?.[role];
  const gold = Number.isFinite(slot?.gold_share) && Number.isFinite(playerGame.gold_share)
    ? Math.abs(slot.gold_share - playerGame.gold_share)
    : MISSING_SHARE_DISTANCE;
  const damage = Number.isFinite(slot?.damage_share) && Number.isFinite(playerGame.damage_share)
    ? Math.abs(slot.damage_share - playerGame.damage_share)
    : MISSING_SHARE_DISTANCE;
  return gold + damage;
}

function gamePoints(game) {
  const points = [];
  for (const role of ROLE_ORDER) {
    const gold = roleValue(game, role, 'gold_share');
    const damage = roleValue(game, role, 'damage_share');
    if (gold == null || damage == null) continue;
    points.push({
      role,
      name: game.roles?.[role]?.name,
      gold,
      damage,
    });
  }
  return points;
}

function axisMax(games, field) {
  let max = SHARE_DOMAIN_FLOOR;
  for (const game of games) {
    for (const role of ROLE_ORDER) {
      const value = roleValue(game, role, field);
      if (value != null) max = Math.max(max, value);
    }
  }
  return d3.scaleLinear().domain([0, max]).nice().domain()[1];
}

export function findLineupGameSlice(playerGame, lineupGames = []) {
  const role = playerGame?.role ?? playerGame?.player?.role;
  const playerId = playerGame?.playerId ?? playerGame?.player?.id;
  const day = dayKey(playerGame?.date);
  const candidates = lineupGames.filter((game) => {
    if (day && dayKey(game.date) !== day) return false;
    if (playerGame?.result != null && game.result != null && game.result !== playerGame.result) return false;
    const slot = role ? game.roles?.[role] : null;
    if (playerId && slot?.id && slot.id !== playerId) return false;
    return Boolean(slot);
  });
  if (!candidates.length) return null;
  return candidates.reduce((best, game) => (
    shareDistance(game, playerGame, role) < shareDistance(best, playerGame, role) ? game : best
  ));
}

function createRoleLegend() {
  return h('div', { class: 'share-legend', 'aria-label': t('lineup.colorRole') }, [
    h('div', { class: 'share-legend__kicker' }, [t('common.role')]),
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

export function createLineupGameShareChart({ game, games = [], highlightRole = null } = {}) {
  const stage = h('div', { class: 'viz-stage lineup-game-share', role: 'presentation' });
  const node = h('article', { class: 'viz-placeholder panel lineup-game-share-panel', dataset: { viz: 'lineup-game-shares' } }, [
    stage,
    createRoleLegend(),
  ]);
  queueMicrotask(() => mountGameShareSlice(stage, { game, games, highlightRole }));
  return node;
}

export function mountGameShareSlice(stage, { game, games = [], highlightRole = null } = {}) {
  stage.classList.add('is-mounted');
  stage.replaceChildren();
  const points = gamePoints(game);
  const scaleGames = games.length ? games : [game];
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  const tooltipWatch = createTooltipWatch('lineup-game-shares');
  const svg = d3.create('svg').attr('class', 'chart-svg').attr('role', 'img');
  svg.append('title').text(t('lineup.gameShare'));
  stage.append(svg.node(), tooltip);
  const margin = MARGIN;
  const observer = new ResizeObserver(() => layout());
  observer.observe(stage);

  function hideTip() {
    tooltip.hidden = true;
    tooltipWatch.hide();
  }

  function layout() {
    if (!stage.isConnected) {
      observer.disconnect();
      return;
    }
    const width = stage.clientWidth;
    const height = Math.max(stage.clientHeight, MIN_HEIGHT);
    if (width < CHART_MIN_WIDTH) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    svg.append('title').text(t('lineup.gameShare'));
    if (!points.length) {
      svg.append('text')
        .attr('class', 'chart-empty')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text(t('lineup.noGameShares'));
      return;
    }

    const innerWidth = Math.max(CHART_MIN_WIDTH, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([0, axisMax(scaleGames, 'gold_share')]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([0, axisMax(scaleGames, 'damage_share')]).range([innerHeight, 0]);

    plot.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(COARSE_AXIS_TICKS).tickSize(-innerWidth).tickFormat(() => ''))
      .select('.domain')
      .remove();
    plot.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(COARSE_AXIS_TICKS).tickFormat((value) => formatPercent(value)).tickSizeOuter(0));
    plot.append('g')
      .attr('class', 'chart-axis')
      .call(d3.axisLeft(y).ticks(COARSE_AXIS_TICKS).tickFormat((value) => formatPercent(value)).tickSizeOuter(0));
    plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('x', innerWidth)
      .attr('y', innerHeight + X_LABEL_OFFSET)
      .attr('text-anchor', 'end')
      .text(t('common.goldShare'));
    plot.append('text')
      .attr('class', 'chart-axis-label')
      .attr('transform', VERTICAL_LABEL)
      .attr('x', 0)
      .attr('y', Y_LABEL_OFFSET)
      .attr('text-anchor', 'end')
      .text(t('common.damageShare'));

    plot.selectAll('.share-dot')
      .data(points)
      .join('circle')
      .attr('class', 'share-dot is-settled')
      .classed('is-linked', (point) => highlightRole && point.role === highlightRole)
      .attr('cx', (point) => x(point.gold))
      .attr('cy', (point) => y(point.damage))
      .attr('r', (point) => (highlightRole && point.role === highlightRole ? SHARE_DOT_RADIUS + HIGHLIGHT_DOT_PAD : SHARE_DOT_RADIUS))
      .attr('fill', (point) => ROLE_COLORS[point.role] ?? FALLBACK_ROLE_COLOR)
      .attr('tabindex', 0)
      .attr('role', 'img')
      .attr('aria-label', (point) => `${point.name ?? point.role}, ${formatRole(point.role)}`)
      .on('mousemove', (event, point) => {
        tooltipWatch.show(`${game.id}|${point.role}`);
        tooltip.innerHTML = [
          `<div>${point.name ?? point.role} · ${formatRole(point.role)}</div>`,
          `<div>${t('lineup.tipShare', { label: t('common.goldShare'), value: formatPercent(point.gold) })}</div>`,
          `<div>${t('lineup.tipShare', { label: t('common.damageShare'), value: formatPercent(point.damage) })}</div>`,
        ].join('');
        tooltip.hidden = false;
        placeTooltip(tooltip, event, stage, TOOLTIP_RESERVE);
      })
      .on('mouseleave', hideTip)
      .on('blur', hideTip);
  }

  layout();
  return {
    destroy() {
      observer.disconnect();
    },
  };
}
