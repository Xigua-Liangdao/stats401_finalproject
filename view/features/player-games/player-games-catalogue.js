import { createGameCatalogue } from '../../components/catalogue/game-catalogue.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { openPlayerGameInfo } from './player-game-info.js?v=game-stats';

export function renderPlayerGamesCatalogue(games) {
  return createSectionBlock({
    index: '04 / Related games',
    title: 'Player game catalogue',
    meta: `${games.length} games`,
    children: games.length
      ? createGameCatalogue({
          games: games.map((game) => ({ ...game, summary: game.champion ?? null })),
          champion: true,
          onInfo: openPlayerGameInfo,
        })
      : h('div', { class: 'empty-state' }, ['No recorded games for this player.']),
  });
}
