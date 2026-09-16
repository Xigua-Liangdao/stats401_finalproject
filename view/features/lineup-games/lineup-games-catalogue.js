import { createGameRow } from '../../components/catalogue/game-row.js';
import { createPagedList } from '../../components/catalogue/paged-list.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { openLineupGameInfo } from './lineup-game-info.js';

export function renderLineupGamesCatalogue(games) {
  return createSectionBlock({
    index: '04 / Related games',
    title: 'Lineup game catalogue',
    meta: `${games.length} games`,
    children: games.length
      ? createPagedList({
          items: games,
          renderItem: (game) => createGameRow({ game, onInfo: openLineupGameInfo }),
        })
      : h('div', { class: 'empty-state' }, ['No recorded games for this lineup.']),
  });
}
