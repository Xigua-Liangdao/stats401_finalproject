import { createGameCatalogue } from '../../components/catalogue/game-catalogue.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { openPlayerGameInfo } from './player-game-info.js?v=game-stats';

export function renderPlayerGamesCatalogue(games) {
  return createSectionBlock({
    index: t('catalogue.related'),
    title: t('catalogue.playerGames'),
    meta: t('catalogue.gameCount', { count: games.length }),
    children: games.length
      ? createGameCatalogue({
          games: games.map((game) => ({ ...game, summary: game.champion ?? null })),
          champion: true,
          onInfo: openPlayerGameInfo,
        })
      : h('div', { class: 'empty-state' }, [t('catalogue.noPlayerGames')]),
  });
}
