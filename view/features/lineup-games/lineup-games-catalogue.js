import { createGameCatalogue } from '../../components/catalogue/game-catalogue.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { openLineupGameInfo } from './lineup-game-info.js?v=game-stats';

export function renderLineupGamesCatalogue(games) {
  return createSectionBlock({
    index: '04 / Related games',
    title: 'Lineup game catalogue',
    meta: `${games.length} games`,
    children: games.length
      ? createGameCatalogue({
          games,
          onInfo: (item) => openLineupGameInfo(item, games),
        })
      : h('div', { class: 'empty-state' }, ['No recorded games for this lineup.']),
  });
}
