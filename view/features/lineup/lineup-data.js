import { dataSource } from '../../utils/data-source.js';

export function loadLineupCatalog() {
  return dataSource.listLineupsByTeam();
}

export function loadLineup(id) {
  return dataSource.getLineup(id);
}

export const LINEUP_STAT_CARDS = [
  { key: 'n_games', label: 'Games together', hint: 'Lineup-games' },
  { key: 'win_rate', label: 'Win rate', hint: 'Placeholder' },
  { key: 'gold_concentration', label: 'Gold concentration', hint: 'Placeholder' },
  { key: 'damage_concentration', label: 'Damage concentration', hint: 'Placeholder' },
  { key: 'mean_dpm', label: 'Mean DPM', hint: 'Placeholder' },
  { key: 'vision_per_minute', label: 'Vision / min', hint: 'Placeholder' },
];

export const LINEUP_VIZ = [
  {
    vizId: 'lineup-parallel',
    index: 'VIZ 01',
    title: 'Lineup profile',
    description: 'Parallel coordinates for resource, vision, and impact. D3 will mount here.',
  },
  {
    vizId: 'lineup-network',
    index: 'VIZ 02',
    title: 'Internal network',
    description: 'Pair relationships inside this five-player composition. Network will mount here.',
  },
];
