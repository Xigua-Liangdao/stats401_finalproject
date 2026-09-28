import { createStatGrid } from '../../components/cards/stat-card.js';
import { createEligibilityNotice } from '../../components/layout/eligibility-notice.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { PLACEHOLDER } from '../../utils/constants.js';
import { isEligible, statValue } from '../../utils/stats.js';
import { dpmFormVsModel, seasonRecord } from './player-chart-config.js';
import { renderPlayerVisualizations } from './player-viz.js?v=scale-zoom';

function renderSeasonStats(player, games) {
  const season = player.team?.season;
  const record = seasonRecord(games, season);
  const form = dpmFormVsModel(player.stats);
  return h('div', { class: 'stat-groups' }, [
    h('div', { class: 'stat-group' }, [
      h('div', { class: 'stat-group__kicker' }, [t('player.currentSeason', { season: season ?? PLACEHOLDER })]),
      createStatGrid([
        {
          label: t('player.gamesPlayed'),
          hint: t('player.gamesHint'),
          value: statValue(record.gamesPlayed, 'count'),
        },
        {
          label: t('common.winRate'),
          hint: t('player.winHint'),
          value: statValue(record.winRate, 'percent'),
        },
        {
          label: t('player.actualVsExpected'),
          hint: form.hint,
          value: form.value,
          valueClass: 'stat-card__value--phrase',
          tone: form.tone,
        },
      ]),
    ]),
    h('div', { class: 'stat-group' }, [
      h('div', { class: 'stat-group__kicker' }, [t('player.overall')]),
      createStatGrid([
        {
          label: t('player.totalGames'),
          hint: t('player.totalHint'),
          value: statValue(record.totalGames, 'count'),
        },
      ]),
    ]),
  ]);
}

export function renderPlayerStats(player, games, players = []) {
  const stats = player.stats ?? {};
  return h('div', {}, [
    createSectionBlock({
      index: t('player.metricsKicker'),
      title: t('player.stats'),
      meta: isEligible(stats) ? null : t('common.ineligible'),
      children: h('div', {}, [
        createEligibilityNotice(isEligible(stats), 'player'),
        renderSeasonStats(player, games),
      ]),
    }),
    createSectionBlock({
      index: t('player.stagesKicker'),
      title: t('player.viz'),
      children: renderPlayerVisualizations({ player, games, players }),
    }),
  ]);
}
