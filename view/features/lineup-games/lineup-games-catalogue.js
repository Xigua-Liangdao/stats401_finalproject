import { createGameCatalogue } from '../../components/catalogue/game-catalogue.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { openLineupGameInfo } from './lineup-game-info.js?v=game-stats';

export function renderLineupGamesCatalogue(games) {
  return createSectionBlock({
    index: t('catalogue.related'),
    title: t('catalogue.lineupGames'),
    meta: t('catalogue.gameCount', { count: games.length }),
    children: games.length
      ? createGameCatalogue({
          games,
          onInfo: (item) => openLineupGameInfo(item, games),
        })
      : h('div', { class: 'empty-state' }, [t('catalogue.noLineupGames')]),
  });
}
