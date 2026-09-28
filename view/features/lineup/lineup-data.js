import { dataSource } from '../../utils/data-source.js';
import { t } from '../../utils/i18n.js';

export function loadLineupCatalog() {
  return dataSource.listLineupsByTeam();
}

export function loadLineup(id) {
  return dataSource.getLineup(id);
}

export const LINEUP_STAT_CARDS = [
  { key: 'n_games', field: 'n_games', format: 'count', get label() { return t('lineup.gamesTogether'); }, get hint() { return t('lineup.gamesHint'); } },
  { key: 'win_rate', field: 'win_rate', format: 'percent', get label() { return t('common.winRate'); }, get hint() { return t('lineup.winHint'); } },
  { key: 'gold_concentration', field: 'gold_concentration', format: 'share', get label() { return t('lineup.goldConcentration'); }, get hint() { return t('lineup.goldHint'); } },
  { key: 'damage_concentration', field: 'damage_concentration', format: 'share', get label() { return t('lineup.damageConcentration'); }, get hint() { return t('lineup.damageHint'); } },
  { key: 'mean_dpm', field: 'mean_dpm', format: 'dpm', get label() { return t('lineup.meanDpm'); }, get hint() { return t('lineup.meanDpmHint'); } },
  { key: 'vision_per_minute', field: 'mean_vision_per_minute', format: 'vision', get label() { return t('common.vision'); }, get hint() { return t('lineup.visionHint'); } },
];
export const LINEUP_VIZ = [
  {
    vizId: 'lineup-share-scatter',
    get index() { return t('lineup.vizMark'); },
    get title() { return t('lineup.vizGold'); },
    get description() { return t('lineup.vizGoldNote'); },
  },
  {
    vizId: 'lineup-share-bars',
    get index() { return t('lineup.vizMark2'); },
    get title() { return t('lineup.vizShares'); },
    get description() { return t('lineup.vizSharesNote'); },
  },
];
