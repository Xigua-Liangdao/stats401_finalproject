import { createStatGrid } from '../../components/cards/stat-card.js';
import { createVizGrid } from '../../components/cards/viz-placeholder.js';
import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { fillStatCards, isEligible } from '../../utils/stats.js';
import { TEAM_STAT_CARDS, TEAM_VIZ } from './team-data.js';

export function renderTeamStats({ team, playerCount, lineupCount }) {
  const stats = {
    ...(team.stats ?? {}),
    n_players: playerCount,
    n_lineups: lineupCount,
  };

  return createSectionBlock({
    index: '02 / Metrics',
    title: 'Team statistics',
    meta: isEligible(stats) ? null : 'Ineligible',
    children: h('div', {}, [
      createEligibilityNotice(isEligible(stats), 'team'),
      createStatGrid(fillStatCards(TEAM_STAT_CARDS, stats)),
    ]),
  });
}

export function renderTeamStages() {
  return createSectionBlock({
    index: '04 / Stages',
    title: 'Visualization mounts',
    meta: 'D3 later',
    children: createVizGrid(TEAM_VIZ),
  });
}
