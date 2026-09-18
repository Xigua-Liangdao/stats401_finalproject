import { createStatGrid } from '../../components/cards/stat-card.js';
import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { fillStatCards, isEligible } from '../../utils/stats.js';
import { createTeamChampionPanel } from './team-champion-chart.js';
import { TEAM_STAT_CARDS } from './team-data.js';

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

export function renderTeamStages({ team, players, games }) {
  return createSectionBlock({
    index: '04 / Stages',
    title: 'Champion picks',
    meta: 'One player at a time',
    children: createTeamChampionPanel({
      players,
      games,
      teamName: team.name,
    }),
  });
}
