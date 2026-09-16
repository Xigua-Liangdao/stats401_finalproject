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
  { key: 'n_games', field: 'n_games', format: 'count', label: 'Games', hint: 'Evaluated team-games' },
  { key: 'win_rate', field: 'win_rate', format: 'percent', label: 'Win rate', hint: 'Evaluated games won' },
  { key: 'n_players', field: 'n_players', format: 'count', label: 'Players', hint: 'Roster count from team_panel' },
  { key: 'n_lineups', field: 'n_lineups', format: 'count', label: 'Lineups', hint: 'Composition count from team_panel' },
  { key: 'mean_impact', field: 'mean_impact', format: 'impact', label: 'Mean impact', hint: 'Unshrunk team impact' },
  { key: 'shrunk_impact', field: 'shrunk_impact', format: 'impact', label: 'Shrunk impact', hint: 'Stabilized team impact' },
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
