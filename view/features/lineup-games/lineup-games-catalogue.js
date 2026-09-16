import { createGameRow } from '../../components/catalogue/game-row.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { openLineupGameInfo } from './lineup-game-info.js';

export function renderLineupGamesCatalogue(games) {
  return createSectionBlock({
    index: '04 / Related games',
    title: 'Lineup game catalogue',
    meta: `${games.length} games`,
    children: games.length
      ? h(
          'div',
          {},
          games.map((game) =>
            createGameRow({
              game: {
                ...game,
                summary: 'Five-player lineup record',
              },
              onInfo: openLineupGameInfo,
            }),
          ),
        )
      : h('div', { class: 'empty-state' }, ['No recorded games for this lineup.']),
  });
}
