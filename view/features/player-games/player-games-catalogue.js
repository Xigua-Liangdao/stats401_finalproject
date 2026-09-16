import { createGameRow } from '../../components/catalogue/game-row.js';
import { createPagedList } from '../../components/catalogue/paged-list.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { openPlayerGameInfo } from './player-game-info.js';

export function renderPlayerGamesCatalogue(games) {
  return createSectionBlock({
    index: '04 / Related games',
    title: 'Player game catalogue',
    meta: `${games.length} games`,
    children: games.length
      ? createPagedList({
          items: games,
          renderItem: (game) =>
            createGameRow({
              game: {
                ...game,
                summary: game.champion ?? null,
              },
              onInfo: openPlayerGameInfo,
            }),
        })
      : h('div', { class: 'empty-state' }, ['No recorded games for this player.']),
  });
}
