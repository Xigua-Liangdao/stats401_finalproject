import { createStatGrid } from '../../components/cards/stat-card.js';
import { createVizGrid } from '../../components/cards/viz-placeholder.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { PLAYER_STAT_CARDS, PLAYER_VIZ } from './player-data.js';

export function renderPlayerStats() {
  return h('div', {}, [
    createSectionBlock({
      index: '02 / Metrics',
      title: 'Player statistics',
      meta: 'Awaiting pipeline',
      children: createStatGrid(PLAYER_STAT_CARDS),
    }),
    createSectionBlock({
      index: '03 / Stages',
      title: 'Visualization mounts',
      meta: 'D3 later',
      children: createVizGrid(PLAYER_VIZ),
    }),
  ]);
}
