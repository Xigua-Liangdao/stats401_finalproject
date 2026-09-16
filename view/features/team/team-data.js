import { dataSource } from '../../utils/data-source.js';

export function loadTeam(id) {
  return dataSource.getTeam(id);
}

export function loadTeamPlayers(teamId) {
  return dataSource.listTeamPlayers(teamId);
}

export function loadTeamLineups(teamId) {
  return dataSource.listTeamLineups(teamId);
}

export const TEAM_STAT_CARDS = [
  { key: 'n_games', label: 'Games', hint: 'Placeholder' },
  { key: 'win_rate', label: 'Win rate', hint: 'Placeholder' },
  { key: 'n_players', label: 'Players', hint: 'Roster count is structural' },
  { key: 'n_lineups', label: 'Lineups', hint: 'Composition count is structural' },
  { key: 'mean_impact', label: 'Mean impact', hint: 'Placeholder' },
  { key: 'shrunk_impact', label: 'Shrunk impact', hint: 'Placeholder' },
];

export const TEAM_VIZ = [
  {
    vizId: 'team-heatmap',
    index: 'VIZ 01',
    title: 'Pair co-performance',
    description: 'Team heatmap of pair scores. D3 heatmap will mount here.',
  },
  {
    vizId: 'team-lineup-compare',
    index: 'VIZ 02',
    title: 'Lineup comparison',
    description: 'Compare compositions belonging to this organization. Chart will mount here.',
  },
];
