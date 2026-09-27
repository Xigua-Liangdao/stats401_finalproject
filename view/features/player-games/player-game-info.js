import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { createStatGrid } from '../../components/cards/stat-card.js';
import { h } from '../../utils/dom.js';
import { formatDate, formatResult, formatRole, placeholderValue } from '../../utils/formatting.js';
import { fillStatCards } from '../../utils/stats.js?v=game-stats';
import { loadLineupGames } from '../lineup-games/lineup-games-data.js?v=game-stats';
import { createLineupGameShareChart, findLineupGameSlice } from '../lineup-games/lineup-game-share.js';

const PLAYER_GAME_STAT_CARDS = [
  { key: 'kda', format: 'kda', label: 'KDA', hint: '(Kills + assists) / max(deaths, 1)' },
  { key: 'dpm', format: 'dpm', label: 'DPM', hint: 'Damage to champions per minute' },
  { key: 'gold_share', format: 'percent', label: 'Gold share', hint: 'Share of team total gold' },
  { key: 'damage_share', format: 'percent', label: 'Damage share', hint: 'Share of team champion damage' },
  { key: 'vision_per_minute', format: 'vision', label: 'Vision / min', hint: 'Vision score per minute' },
  { key: 'adjusted_impact', format: 'impact', label: 'Adjusted impact', hint: '(DPM − expected DPM) / training-role SD' },
];

export function openPlayerGameInfo(game) {
  const unevaluated = game.prediction_status === 'warmup' || game.adjusted_impact == null;
  const shareHost = h('div', { class: 'lineup-game-share-host' });
  const role = game.role ?? game.player?.role ?? null;
  openDrawer({
    kicker: 'Player game info',
    title: `${game.player?.name ?? 'Player'} · ${formatResult(game.result)}`,
    body: h('div', {}, [
      unevaluated
        ? h('p', { class: 'notice' }, [
            'This game is outside the evaluated window, so expected DPM and adjusted impact are unavailable. Other box-score fields are still shown.',
          ])
        : null,
      createDrawerSection({
        title: 'Game metadata',
        children: createMetaGrid([
          { label: 'Date', value: formatDate(game.date) },
          { label: 'Opponent', value: game.opponent?.name ?? placeholderValue() },
          { label: 'Split', value: game.split },
          { label: 'Patch', value: game.patch },
          { label: 'Side', value: game.side ?? placeholderValue() },
          { label: 'Result', value: formatResult(game.result) },
        ]),
      }),
      createDrawerSection({
        title: 'Player metadata',
        children: createMetaGrid([
          { label: 'Player', value: game.player?.name ?? placeholderValue() },
          { label: 'Role', value: game.player?.role ? formatRole(game.player.role) : placeholderValue() },
          { label: 'Champion', value: game.champion ?? placeholderValue() },
          { label: 'Opponent champion', value: game.opponentChampion ?? placeholderValue() },
        ]),
      }),
      createDrawerSection({
        title: 'Stat cards',
        children: createStatGrid(fillStatCards(PLAYER_GAME_STAT_CARDS, game)),
      }),
      createDrawerSection({
        title: 'Gold share vs damage share',
        children: shareHost,
      }),
    ]),
  });
  mountPlayerShare(shareHost, game, role);
}

async function mountPlayerShare(host, game, role) {
  if (!game.lineupId) {
    host.replaceChildren(h('div', { class: 'empty-state' }, ['No lineup share slice for this game.']));
    return;
  }
  const games = await loadLineupGames(game.lineupId);
  if (!host.isConnected) return;
  const match = findLineupGameSlice(game, games);
  host.replaceChildren(match
    ? createLineupGameShareChart({ game: match, games, highlightRole: role })
    : h('div', { class: 'empty-state' }, ['No lineup share slice for this game.']));
}
