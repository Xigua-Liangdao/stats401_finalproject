import { createStatGrid } from '../../components/cards/stat-card.js';
import { createVizGrid } from '../../components/cards/viz-placeholder.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { TEAM_STAT_CARDS, TEAM_VIZ } from './team-data.js';

export function renderTeamStats({ playerCount, lineupCount }) {
  const cards = TEAM_STAT_CARDS.map((card) => {
    if (card.key === 'n_players') return { ...card, value: String(playerCount) };
    if (card.key === 'n_lineups') return { ...card, value: String(lineupCount) };
    return card;
  });

  return h('div', {}, [
    createSectionBlock({
      index: '02 / Metrics',
      title: 'Team statistics',
      meta: 'Awaiting pipeline',
      children: createStatGrid(cards),
    }),
    createSectionBlock({
      index: '03 / Stages',
      title: 'Visualization mounts',
      meta: 'D3 later',
      children: createVizGrid(TEAM_VIZ),
    }),
  ]);
}
