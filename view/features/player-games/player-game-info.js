import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { createStatGrid } from '../../components/cards/stat-card.js';
import { h } from '../../utils/dom.js';
import { formatDate, formatResult, placeholderValue } from '../../utils/formatting.js';

export function openPlayerGameInfo(game) {
  openDrawer({
    kicker: 'Player game info',
    title: `${game.player?.name ?? 'Player'} · ${formatResult(game.result)}`,
    body: h('div', {}, [
      h('p', { class: 'notice' }, [
        'Player-game detail. Values shown here are placeholders.',
      ]),
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
          { label: 'Role', value: (game.player?.role ?? '').toUpperCase() },
          { label: 'Champion', value: game.champion ?? placeholderValue() },
          { label: 'Opponent champion', value: game.opponentChampion ?? placeholderValue() },
        ]),
      }),
      createDrawerSection({
        title: 'Stat cards',
        children: createStatGrid([
          { label: 'KDA', hint: 'Placeholder' },
          { label: 'DPM', hint: 'Placeholder' },
          { label: 'Gold share', hint: 'Placeholder' },
          { label: 'Damage share', hint: 'Placeholder' },
          { label: 'Vision / min', hint: 'Placeholder' },
          { label: 'Adjusted impact', hint: 'Placeholder' },
        ]),
      }),
    ]),
  });
}
