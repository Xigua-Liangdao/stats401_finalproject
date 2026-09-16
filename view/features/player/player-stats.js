import { createStatGrid } from '../../components/cards/stat-card.js';
import { createVizGrid } from '../../components/cards/viz-placeholder.js';
import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { fillStatCards, isEligible } from '../../utils/stats.js';
import { PLAYER_STAT_CARDS, PLAYER_VIZ } from './player-data.js';

export function renderPlayerStats(player) {
  const stats = player.stats ?? {};
  return h('div', {}, [
    createSectionBlock({
      index: '02 / Metrics',
      title: 'Player statistics',
      meta: isEligible(stats) ? 'data/test · players.csv' : 'Ineligible',
      children: h('div', {}, [
        createEligibilityNotice(isEligible(stats), 'player'),
        createStatGrid(fillStatCards(PLAYER_STAT_CARDS, stats)),
      ]),
    }),
    createSectionBlock({
      index: '03 / Stages',
      title: 'Visualization mounts',
      meta: 'D3 later',
      children: createVizGrid(PLAYER_VIZ),
    }),
  ]);
}
