import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { createStatGrid } from '../../components/cards/stat-card.js';
import { createMiniSlot } from '../../components/catalogue/roster-slot.js';
import { createVizPlaceholder } from '../../components/cards/viz-placeholder.js';
import { h } from '../../utils/dom.js';
import { formatDate, formatResult, placeholderValue } from '../../utils/formatting.js';
import { fillStatCards } from '../../utils/stats.js?v=game-stats';

const LINEUP_GAME_STAT_CARDS = [
  { key: 'lineup_impact', format: 'impact', label: 'Lineup impact', hint: 'Mean adjusted damage of the five players' },
  { key: 'mean_dpm', format: 'dpm', label: 'Mean DPM', hint: 'Five-player mean DPM' },
  { key: 'gold_concentration', format: 'share', label: 'Gold concentration', hint: 'Sum of squared gold shares' },
  { key: 'damage_concentration', format: 'share', label: 'Damage concentration', hint: 'Sum of squared damage shares' },
];

export function openLineupGameInfo(game) {
  const players = game.lineup?.players ?? [];
  const unevaluated = game.lineup_impact == null;
  openDrawer({
    kicker: 'Lineup game info',
    title: `${game.lineup?.name ?? 'Lineup'} · ${formatResult(game.result)}`,
    body: h('div', {}, [
      unevaluated
        ? h('p', { class: 'notice' }, [
            'Lineup impact is unavailable for this game because it was not in the evaluated window. Resource fields are still shown.',
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
          { label: 'Lineup', value: game.lineup?.name ?? placeholderValue() },
        ]),
      }),
      createDrawerSection({
        title: 'Composition',
        children: h(
          'div',
          { class: 'lineup-strip__slots' },
          players.map((player) => createMiniSlot(player)),
        ),
      }),
      createDrawerSection({
        title: 'Lineup stat cards',
        children: createStatGrid(fillStatCards(LINEUP_GAME_STAT_CARDS, game)),
      }),
      createDrawerSection({
        title: 'Share sketch',
        children: createVizPlaceholder({
          vizId: 'lineup-game-shares',
          index: 'VIZ',
          title: 'Role shares',
          description: 'Gold and damage shares by role for this game. D3 will mount here.',
        }),
      }),
    ]),
  });
}
