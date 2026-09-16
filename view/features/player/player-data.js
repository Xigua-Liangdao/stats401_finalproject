import { dataSource } from '../../utils/data-source.js';

export function loadPlayerCatalog() {
  return dataSource.listPlayersByTeam();
}

export function loadPlayer(id) {
  return dataSource.getPlayer(id);
}

export const PLAYER_STAT_CARDS = [
  { key: 'n_games', field: 'n_games', format: 'count', label: 'Games played', hint: 'Evaluated player-games' },
  { key: 'win_rate', field: 'win_rate', format: 'percent', label: 'Win rate', hint: 'Evaluated games won' },
  { key: 'gold_share', field: 'mean_gold_share', format: 'share', label: 'Gold share', hint: 'Mean total-gold share' },
  { key: 'damage_share', field: 'mean_damage_share', format: 'share', label: 'Damage share', hint: 'Mean damage share' },
  { key: 'dpm', field: 'mean_dpm', format: 'dpm', label: 'DPM', hint: 'Damage per minute' },
  { key: 'vision_per_minute', field: 'mean_vision_per_minute', format: 'vision', label: 'Vision / min', hint: 'Mean vision per minute' },
];

export const PLAYER_VIZ = [
  {
    vizId: 'player-resource-impact',
    index: 'VIZ 01',
    title: 'Resource / Impact',
    description: 'Gold share versus adjusted damage. D3 scatter will mount in this stage.',
  },
  {
    vizId: 'player-timeline',
    index: 'VIZ 02',
    title: 'Actual vs expected',
    description: 'Match-day DPM against the context baseline. Timeline will mount here.',
  },
];
