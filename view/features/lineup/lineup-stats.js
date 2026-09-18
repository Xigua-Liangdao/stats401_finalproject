import { createStatGrid } from '../../components/cards/stat-card.js';
import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { fillStatCards, isEligible } from '../../utils/stats.js';
import { LINEUP_STAT_CARDS } from './lineup-data.js';
import { createLineupShareBarsPanel } from './lineup-share-bars.js';
import { createLineupShareScatterPanel } from './lineup-share-scatter.js';

export function renderLineupStats(lineup, games = []) {
  const stats = lineup.stats ?? {};
  return h('div', {}, [
    createSectionBlock({
      index: '02 / Metrics',
      title: 'Lineup statistics',
      meta: isEligible(stats) ? null : 'Ineligible',
      children: h('div', {}, [
        createEligibilityNotice(isEligible(stats), 'lineup'),
        createStatGrid(fillStatCards(LINEUP_STAT_CARDS, stats)),
      ]),
    }),
    createSectionBlock({
      index: '03 / Stages',
      title: 'Visualization mounts',
      children: h('div', { class: 'viz-grid' }, [
        createLineupShareScatterPanel({ games }),
        createLineupShareBarsPanel({ lineup, games }),
      ]),
    }),
  ]);
}
