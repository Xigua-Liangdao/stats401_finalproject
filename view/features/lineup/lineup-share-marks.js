import { openLineupGameInfo } from '../lineup-games/lineup-game-info.js?v=game-stats';
import { placeTooltip, SHARE_DOT_RADIUS, TOOLTIP_RESERVE_WIDE } from '../../utils/chart-layout.js';
import { ROLE_COLORS, ROLE_ORDER } from '../../utils/constants.js';
import { d3 } from '../../utils/d3.js';
import { formatDate, formatPercent, formatRole } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { createGameMark } from './lineup-range-dock.js';
import { mixValue, roleValue } from './lineup-playback.js';

const DOT_RING_PAD = 4;
const STATIC_DOT_MIN = 2.8;
const STATIC_DOT_GROWTH = 6.2;
const FALLBACK_ROLE_COLOR = '#7adfff';

function gameTip(game) {
  return `<div class="lineup-tip-game">${createGameMark(game).outerHTML}<span>${formatDate(game.date)}</span></div>`;
}

export function createShareMarks({ svg, tooltip, tooltipWatch, plotHost, ordered, visibleRoles }) {
  let paintKey = '';
  let frameState = null;
  let x = null;
  let y = null;
  let suppressClick = false;

  function hideTip() {
    tooltip.hidden = true;
    tooltipWatch.hide();
  }

  function currentGame() {
    if (!frameState) return ordered[0] ?? null;
    return frameState.games[frameState.landed ?? frameState.index] ?? ordered[0] ?? null;
  }

  function showTip(event, role) {
    const game = currentGame();
    const slot = game?.roles?.[role];
    if (!game || !slot) return;
    tooltipWatch.show(`${game.id}|${role}`);
    const opponent = game.opponent?.name ?? game.opponent?.short;
    tooltip.innerHTML = [
      `<div>${slot.name ?? slot.id} · ${formatRole(role)}</div>`,
      gameTip(game),
      opponent ? `<div>${t('lineup.vs', { name: opponent })}</div>` : null,
      `<div>${t('lineup.tipShare', { label: t('common.goldShare'), value: formatPercent(roleValue(game, role, 'gold_share')) })}</div>`,
      `<div>${t('lineup.tipShare', { label: t('common.damageShare'), value: formatPercent(roleValue(game, role, 'damage_share')) })}</div>`,
    ].filter(Boolean).join('');
    tooltip.hidden = false;
    placeTooltip(tooltip, event, plotHost, TOOLTIP_RESERVE_WIDE);
  }

  function pointsInRange(state) {
    const slice = state.games.slice(state.from, state.to + 1);
    const last = Math.max(1, slice.length - 1);
    const cloud = [];
    slice.forEach((game, index) => {
      const recency = slice.length === 1 ? 1 : index / last;
      for (const role of ROLE_ORDER) {
        if (!visibleRoles.has(role)) continue;
        const gold = roleValue(game, role, 'gold_share');
        const damage = roleValue(game, role, 'damage_share');
        if (gold == null || damage == null) continue;
        cloud.push({
          game,
          role,
          gold,
          damage,
          recency,
          name: game.roles?.[role]?.name,
        });
      }
    });
    return cloud;
  }

  function buildStatic(layer, state) {
    layer.selectAll('.share-dot')
      .data(pointsInRange(state), (point) => `${point.game.id}|${point.role}`)
      .join('circle')
      .attr('class', 'share-dot')
      .attr('cx', (point) => x(point.gold))
      .attr('cy', (point) => y(point.damage))
      .attr('r', (point) => STATIC_DOT_MIN + point.recency * STATIC_DOT_GROWTH)
      .attr('fill', (point) => ROLE_COLORS[point.role] ?? FALLBACK_ROLE_COLOR)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (point) => `${point.name ?? point.role}, ${formatRole(point.role)}, ${formatDate(point.game.date)}`)
      .on('mousemove', (event, point) => {
        tooltipWatch.show(`${point.game.id}|${point.role}`);
        layer.selectAll('.share-dot').classed('is-linked', (item) => item.game.id === point.game.id);
        const opponent = point.game.opponent?.name ?? point.game.opponent?.short;
        tooltip.innerHTML = [
          `<div>${point.name ?? point.role} · ${formatRole(point.role)}</div>`,
          gameTip(point.game),
          opponent ? `<div>vs ${opponent}</div>` : null,
          `<div>Gold share: ${formatPercent(point.gold)}</div>`,
          `<div>Damage share: ${formatPercent(point.damage)}</div>`,
        ].filter(Boolean).join('');
        tooltip.hidden = false;
        placeTooltip(tooltip, event, plotHost, TOOLTIP_RESERVE_WIDE);
      })
      .on('mouseleave', () => {
        layer.selectAll('.share-dot').classed('is-linked', false);
        hideTip();
      })
      .on('click', (event, point) => {
        if (suppressClick) {
          suppressClick = false;
          event.stopPropagation();
          return;
        }
        openLineupGameInfo(point.game, ordered);
      });
  }

  function buildDynamic(layer) {
    const marks = layer.selectAll('.share-mark').data(ROLE_ORDER).join('g').attr('class', 'share-mark');
    marks.append('circle').attr('class', 'share-dot-ring').attr('r', SHARE_DOT_RADIUS + DOT_RING_PAD);
    marks.append('circle')
      .attr('class', 'share-dot')
      .attr('r', SHARE_DOT_RADIUS)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .on('mousemove', (event, role) => showTip(event, role))
      .on('mouseleave', hideTip)
      .on('click', (event, role) => {
        if (suppressClick) {
          suppressClick = false;
          event.stopPropagation();
          return;
        }
        const game = currentGame();
        if (game?.roles?.[role]) openLineupGameInfo(game, ordered);
      });
  }

  function updateDynamic(layer, state) {
    const settled = state.phase === 'hold';
    layer.selectAll('.share-mark').each(function mark(role) {
      const node = d3.select(this);
      const fromGame = state.games[state.previous];
      const toGame = state.games[state.index];
      const gold = mixValue(
        roleValue(fromGame, role, 'gold_share'),
        roleValue(toGame, role, 'gold_share'),
        state.progress,
      );
      const damage = mixValue(
        roleValue(fromGame, role, 'damage_share'),
        roleValue(toGame, role, 'damage_share'),
        state.progress,
      );
      const visible = visibleRoles.has(role) && gold != null && damage != null;
      const color = ROLE_COLORS[role] ?? FALLBACK_ROLE_COLOR;
      node.select('.share-dot')
        .attr('cx', visible ? x(gold) : 0)
        .attr('cy', visible ? y(damage) : 0)
        .attr('fill', color)
        .attr('display', visible ? null : 'none')
        .classed('is-settled', settled && visible)
        .attr('aria-label', visible
          ? `${toGame?.roles?.[role]?.name ?? role}, ${formatRole(role)}, ${formatDate(toGame?.date)}`
          : formatRole(role));
      node.select('.share-dot-ring')
        .attr('cx', visible ? x(gold) : 0)
        .attr('cy', visible ? y(damage) : 0)
        .attr('stroke', color)
        .attr('display', visible && settled ? null : 'none');
    });
  }

  function paint(state) {
    frameState = state;
    if (!x || !y || !state) return;
    const layer = svg.select('.share-dots');
    if (layer.empty()) return;
    const roles = ROLE_ORDER.filter((role) => visibleRoles.has(role)).join(',');
    const key = state.mode === 'static' ? `static:${state.from}:${state.to}:${roles}` : `dynamic:${roles}`;
    if (key !== paintKey) {
      layer.selectAll('*').remove();
      paintKey = key;
      if (state.mode === 'static') buildStatic(layer, state);
      else buildDynamic(layer);
    }
    if (state.mode === 'dynamic') updateDynamic(layer, state);
  }

  return {
    hideTip,
    setScales(nextX, nextY) {
      x = nextX;
      y = nextY;
    },
    invalidate() {
      paintKey = '';
    },
    paint,
    repaint() {
      paint(frameState);
    },
    armSuppressClick() {
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    },
  };
}
