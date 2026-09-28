import { createStatGrid } from '../../components/cards/stat-card.js';
import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { fillStatCards, isEligible } from '../../utils/stats.js';
import { LINEUP_STAT_CARDS } from './lineup-data.js';
import { createLineupRangeDock } from './lineup-range-dock.js';
import { createLineupPlayback } from './lineup-playback.js';
import { createLineupShareBarsPanel } from './lineup-share-bars.js';
import { createLineupShareScatterPanel } from './lineup-share-scatter.js';

export function renderLineupStats(lineup, games = []) {
  const stats = lineup.stats ?? {};
  const playback = createLineupPlayback(games);
  return h('div', {}, [
    createSectionBlock({
      index: t('lineup.metricsKicker'),
      title: t('lineup.stats'),
      meta: isEligible(stats) ? null : t('common.ineligible'),
      children: h('div', {}, [
        createEligibilityNotice(isEligible(stats), 'lineup'),
        createStatGrid(fillStatCards(LINEUP_STAT_CARDS, stats)),
      ]),
    }),
    createSectionBlock({
      index: t('lineup.stagesKicker'),
      title: t('lineup.mounts'),
      children: h('div', { class: 'lineup-stage' }, [
        createLineupRangeDock({ playback }),
        h('div', { class: 'viz-grid' }, [
          createLineupShareScatterPanel({ games, playback }),
          createLineupShareBarsPanel({ lineup, games, playback }),
        ]),
      ]),
    }),
  ]);
}
