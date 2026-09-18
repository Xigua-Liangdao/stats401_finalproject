import { dataSource } from '../../utils/data-source.js';

export function loadLineupCatalog() {
  return dataSource.listLineupsByTeam();
}

export function loadLineup(id) {
  return dataSource.getLineup(id);
}

export const LINEUP_STAT_CARDS = [
  { key: 'n_games', field: 'n_games', format: 'count', label: 'Games together', hint: 'Evaluated lineup-games' },
  { key: 'win_rate', field: 'win_rate', format: 'percent', label: 'Win rate', hint: 'Evaluated games won' },
  { key: 'gold_concentration', field: 'gold_concentration', format: 'share', label: 'Gold concentration', hint: 'Sum of squared gold shares' },
  { key: 'damage_concentration', field: 'damage_concentration', format: 'share', label: 'Damage concentration', hint: 'Sum of squared damage shares' },
  { key: 'mean_dpm', field: 'mean_dpm', format: 'dpm', label: 'Mean DPM', hint: 'Five-player mean DPM' },
  { key: 'vision_per_minute', field: 'mean_vision_per_minute', format: 'vision', label: 'Vision / min', hint: 'Mean vision per minute' },
];
export const LINEUP_VIZ = [
  {
    vizId: 'lineup-share-scatter',
    index: 'VIZ 01',
    title: 'Gold share vs damage share',
    description: 'Each related game plots five role points. Newer games are larger.',
  },
  {
    vizId: 'lineup-network',
    index: 'VIZ 02',
    title: 'Internal network',
    description: 'Pair relationships inside this five-player composition. Network will mount here.',
  },
];

