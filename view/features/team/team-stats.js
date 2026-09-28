import { createStatGrid } from '../../components/cards/stat-card.js';
import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
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
    index: t('team.metricsKicker'),
    title: t('team.stats'),
    meta: isEligible(stats) ? null : t('common.ineligible'),
    children: h('div', {}, [
      createEligibilityNotice(isEligible(stats), 'team'),
      createStatGrid(fillStatCards(TEAM_STAT_CARDS, stats)),
    ]),
  });
}

export function renderTeamStages({ team, players, games }) {
  return createSectionBlock({
    index: t('team.stages'),
    title: t('team.picks'),
    meta: t('team.onePlayer'),
    children: createTeamChampionPanel({
      players,
      games,
      teamName: team.name,
    }),
  });
}
