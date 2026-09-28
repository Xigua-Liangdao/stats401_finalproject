import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { createStatGrid } from '../../components/cards/stat-card.js';
import { h } from '../../utils/dom.js';
import { formatDate, formatResult, formatRole, formatSide, placeholderValue } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { fillStatCards } from '../../utils/stats.js?v=game-stats';
import { loadLineupGames } from '../lineup-games/lineup-games-data.js?v=game-stats';
import { createLineupGameShareChart, findLineupGameSlice } from '../lineup-games/lineup-game-share.js';

const PLAYER_GAME_STAT_CARDS = [
  { key: 'kda', format: 'kda', get label() { return t('stat.kda'); }, get hint() { return t('stat.kdaHint'); } },
  { key: 'dpm', format: 'dpm', get label() { return t('common.dpm'); }, get hint() { return t('stat.dpmHint'); } },
  { key: 'gold_share', format: 'percent', get label() { return t('common.goldShare'); }, get hint() { return t('stat.goldHint'); } },
  { key: 'damage_share', format: 'percent', get label() { return t('common.damageShare'); }, get hint() { return t('stat.damageHint'); } },
  { key: 'vision_per_minute', format: 'vision', get label() { return t('common.vision'); }, get hint() { return t('stat.visionHint'); } },
  { key: 'adjusted_impact', format: 'impact', get label() { return t('stat.adjusted'); }, get hint() { return t('stat.adjustedHint'); } },
];

export function openPlayerGameInfo(game) {
  const unevaluated = game.prediction_status === 'warmup' || game.adjusted_impact == null;
  const shareHost = h('div', { class: 'lineup-game-share-host' });
  const role = game.role ?? game.player?.role ?? null;
  openDrawer({
    kicker: t('drawer.playerGame'),
    title: t('drawer.playerTitle', { name: game.player?.name ?? t('common.player'), result: formatResult(game.result) }),
    body: h('div', {}, [
      unevaluated
        ? h('p', { class: 'notice' }, [t('drawer.outsideWindow')])
        : null,
      createDrawerSection({
        title: t('drawer.gameMeta'),
        children: createMetaGrid([
          { label: t('common.date'), value: formatDate(game.date) },
          { label: t('common.opponent'), value: game.opponent?.name ?? placeholderValue() },
          { label: t('common.split'), value: game.split },
          { label: t('common.patch'), value: game.patch },
          { label: t('common.side'), value: formatSide(game.side) },
          { label: t('common.result'), value: formatResult(game.result) },
        ]),
      }),
      createDrawerSection({
        title: t('drawer.playerMeta'),
        children: createMetaGrid([
          { label: t('common.player'), value: game.player?.name ?? placeholderValue() },
          { label: t('common.role'), value: game.player?.role ? formatRole(game.player.role) : placeholderValue() },
          { label: t('common.champion'), value: game.champion ?? placeholderValue() },
          { label: t('drawer.opponentChampion'), value: game.opponentChampion ?? placeholderValue() },
        ]),
      }),
      createDrawerSection({
        title: t('drawer.statCards'),
        children: createStatGrid(fillStatCards(PLAYER_GAME_STAT_CARDS, game)),
      }),
      createDrawerSection({
        title: t('lineup.vizGold'),
        children: shareHost,
      }),
    ]),
  });
  mountPlayerShare(shareHost, game, role);
}

async function mountPlayerShare(host, game, role) {
  if (!game.lineupId) {
    host.replaceChildren(h('div', { class: 'empty-state' }, [t('drawer.noSlice')]));
    return;
  }
  const games = await loadLineupGames(game.lineupId);
  if (!host.isConnected) return;
  const match = findLineupGameSlice(game, games);
  host.replaceChildren(match
    ? createLineupGameShareChart({ game: match, games, highlightRole: role })
    : h('div', { class: 'empty-state' }, [t('drawer.noSlice')]));
}
