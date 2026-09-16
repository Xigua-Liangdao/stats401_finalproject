import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { createStatGrid } from '../../components/cards/stat-card.js';
import { createMiniSlot } from '../../components/catalogue/roster-slot.js';
import { createVizPlaceholder } from '../../components/cards/viz-placeholder.js';
import { h } from '../../utils/dom.js';
import { formatDate, formatResult, placeholderValue } from '../../utils/formatting.js';

export function openLineupGameInfo(game) {
  const players = game.lineup?.players ?? [];
  openDrawer({
    kicker: 'Lineup game info',
    title: `${game.lineup?.name ?? 'Lineup'} · ${formatResult(game.result)}`,
    body: h('div', {}, [
      h('p', { class: 'notice' }, [
        'Lineup-game detail. Values shown here are placeholders.',
      ]),
      createDrawerSection({
        title: 'Game metadata',
        children: createMetaGrid([
          { label: 'Date', value: formatDate(game.date) },
          { label: 'Opponent', value: game.opponent?.name ?? placeholderValue() },
          { label: 'Split', value: game.split },
          { label: 'Patch', value: game.patch },
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
        children: createStatGrid([
          { label: 'Lineup impact', hint: 'Placeholder' },
          { label: 'Mean DPM', hint: 'Placeholder' },
          { label: 'Gold concentration', hint: 'Placeholder' },
          { label: 'Damage concentration', hint: 'Placeholder' },
        ]),
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
