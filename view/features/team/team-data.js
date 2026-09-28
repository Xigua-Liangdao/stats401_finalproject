import { dataSource } from '../../utils/data-source.js';
import { t } from '../../utils/i18n.js';

export function loadTeam(id) {
  return dataSource.getTeam(id);
}

export function loadTeamPlayers(teamId) {
  return dataSource.listTeamPlayers(teamId);
}

export function loadTeamLineups(teamId) {
  return dataSource.listTeamLineups(teamId);
}

export function loadTeamPlayerGames(teamId) {
  return dataSource.loadTeamPlayerGames(teamId);
}

export const TEAM_STAT_CARDS = [
  { key: 'n_games', field: 'n_games', format: 'count', get label() { return t('common.games'); }, get hint() { return t('team.gamesHint'); } },
  { key: 'win_rate', field: 'win_rate', format: 'percent', get label() { return t('common.winRate'); }, get hint() { return t('lineup.winHint'); } },
  { key: 'n_players', field: 'n_players', format: 'count', get label() { return t('common.players'); }, get hint() { return t('team.playersHint'); } },
  { key: 'n_lineups', field: 'n_lineups', format: 'count', get label() { return t('common.lineups'); }, get hint() { return t('team.lineupsHint'); } },
  { key: 'mean_impact', field: 'mean_impact', format: 'impact', get label() { return t('common.meanImpact'); }, get hint() { return t('team.meanHint'); } },
  { key: 'shrunk_impact', field: 'shrunk_impact', format: 'impact', get label() { return t('common.shrunkImpact'); }, get hint() { return t('team.shrunkHint'); } },
];
