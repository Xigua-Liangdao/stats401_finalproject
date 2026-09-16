import { dataSource } from '../../utils/data-source.js';

export function loadPlayerCatalog() {
  return dataSource.listPlayersByTeam();
}

export function loadPlayer(id) {
  return dataSource.getPlayer(id);
}

export const PLAYER_STAT_CARDS = [
  { key: 'n_games', label: 'Games played', hint: 'Evaluated player-games' },
  { key: 'win_rate', label: 'Win rate', hint: 'Placeholder' },
  { key: 'gold_share', label: 'Gold share', hint: 'Placeholder' },
  { key: 'damage_share', label: 'Damage share', hint: 'Placeholder' },
  { key: 'dpm', label: 'DPM', hint: 'Damage per minute' },
  { key: 'vision_per_minute', label: 'Vision / min', hint: 'Placeholder' },
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
