import { createStatGrid } from '../../components/cards/stat-card.js';
import { createVizGrid } from '../../components/cards/viz-placeholder.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { LINEUP_STAT_CARDS, LINEUP_VIZ } from './lineup-data.js';

export function renderLineupStats() {
  return h('div', {}, [
    createSectionBlock({
      index: '02 / Metrics',
      title: 'Lineup statistics',
      meta: 'Awaiting pipeline',
      children: createStatGrid(LINEUP_STAT_CARDS),
    }),
    createSectionBlock({
      index: '03 / Stages',
      title: 'Visualization mounts',
      meta: 'D3 later',
      children: createVizGrid(LINEUP_VIZ),
    }),
  ]);
}
