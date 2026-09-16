import { createGameRow } from '../../components/catalogue/game-row.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { openPlayerGameInfo } from './player-game-info.js';

export function renderPlayerGamesCatalogue(games) {
  return createSectionBlock({
    index: '04 / Related games',
    title: 'Player game catalogue',
    meta: 'Source: player_games',
    children: games.length
      ? h(
          'div',
          {},
          games.map((game) =>
            createGameRow({
              game: {
                ...game,
                summary: game.champion ? `${game.side} · ${game.champion}` : 'Player-game record',
              },
              onInfo: openPlayerGameInfo,
            }),
          ),
        )
      : h('div', { class: 'empty-state' }, ['No mock player-games in this file.']),
  });
}
