import { createStatGrid } from '../../components/cards/stat-card.js';
import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { isEligible, statValue } from '../../utils/stats.js';
import { dpmFormVsModel, seasonRecord } from './player-chart-config.js';
import { renderPlayerVisualizations } from './player-viz.js';

function renderSeasonStats(player, games) {
  const season = player.team?.season;
  const record = seasonRecord(games, season);
  const form = dpmFormVsModel(player.stats);
  return h('div', { class: 'stat-groups' }, [
    h('div', { class: 'stat-group' }, [
      h('div', { class: 'stat-group__kicker' }, [`Current season · ${season ?? '—'}`]),
      createStatGrid([
        {
          label: 'Games played',
          hint: 'Player-games in the selected season',
          value: statValue(record.gamesPlayed, 'count'),
        },
        {
          label: 'Win rate',
          hint: 'Wins among decided games this season',
          value: statValue(record.winRate, 'percent'),
        },
        {
          label: 'Actual vs expected',
          hint: form.hint,
          value: form.value,
          valueClass: 'stat-card__value--phrase',
          tone: form.tone,
        },
      ]),
    ]),
    h('div', { class: 'stat-group' }, [
      h('div', { class: 'stat-group__kicker' }, ['Overall']),
      createStatGrid([
        {
          label: 'Total games',
          hint: 'All available seasons in the dataset',
          value: statValue(record.totalGames, 'count'),
        },
      ]),
    ]),
  ]);
}

export function renderPlayerStats(player, games) {
  const stats = player.stats ?? {};
  return h('div', {}, [
    createSectionBlock({
      index: '02 / Metrics',
      title: 'Player statistics',
      meta: isEligible(stats) ? null : 'Ineligible',
      children: h('div', {}, [
        createEligibilityNotice(isEligible(stats), 'player'),
        renderSeasonStats(player, games),
      ]),
    }),
    createSectionBlock({
      index: '03 / Stages',
      title: 'Player visualizations',
      children: renderPlayerVisualizations({ player, games }),
    }),
  ]);
}
