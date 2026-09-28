import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { createStatGrid } from '../../components/cards/stat-card.js';
import { createMiniSlot } from '../../components/catalogue/roster-slot.js';
import { h } from '../../utils/dom.js';
import { createLineupGameShareChart } from './lineup-game-share.js';
import { formatDate, formatResult, formatSide, placeholderValue } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { fillStatCards } from '../../utils/stats.js?v=game-stats';

const LINEUP_GAME_STAT_CARDS = [
  { key: 'lineup_impact', format: 'impact', get label() { return t('stat.lineupImpact'); }, get hint() { return t('stat.lineupImpactHint'); } },
  { key: 'mean_dpm', format: 'dpm', get label() { return t('lineup.meanDpm'); }, get hint() { return t('lineup.meanDpmHint'); } },
  { key: 'gold_concentration', format: 'share', get label() { return t('lineup.goldConcentration'); }, get hint() { return t('lineup.goldHint'); } },
  { key: 'damage_concentration', format: 'share', get label() { return t('lineup.damageConcentration'); }, get hint() { return t('lineup.damageHint'); } },
];

export function openLineupGameInfo(game, games = []) {
  const players = game.lineup?.players ?? [];
  const unevaluated = game.lineup_impact == null;
  openDrawer({
    kicker: t('drawer.lineupGame'),
    title: t('drawer.playerTitle', { name: game.lineup?.name ?? t('common.lineup'), result: formatResult(game.result) }),
    body: h('div', {}, [
      unevaluated
        ? h('p', { class: 'notice' }, [t('drawer.lineupUnevaluated')])
        : null,
      createDrawerSection({
        title: t('drawer.gameMeta'),
        children: createMetaGrid([
          { label: t('common.date'), value: formatDate(game.date) },
          { label: t('common.opponent'), value: game.opponent?.name ?? placeholderValue() },
          { label: t('common.split'), value: game.split },
          { label: t('common.patch'), value: game.patch },
          { label: t('common.side'), value: formatSide(game.side) },
          { label: t('common.result'), value: formatResult(game.result) },
          { label: t('common.lineup'), value: game.lineup?.name ?? placeholderValue() },
        ]),
      }),
      createDrawerSection({
        title: t('drawer.composition'),
        children: h(
          'div',
          { class: 'lineup-strip__slots' },
          players.map((player) => createMiniSlot(player)),
        ),
      }),
      createDrawerSection({
        title: t('drawer.lineupStats'),
        children: createStatGrid(fillStatCards(LINEUP_GAME_STAT_CARDS, game)),
      }),
      createDrawerSection({
        title: t('lineup.vizGold'),
        children: createLineupGameShareChart({ game, games }),
      }),
    ]),
  });
}
