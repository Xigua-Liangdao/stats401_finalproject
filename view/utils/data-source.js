/**
 * Single data access point for the UI.
 * Pages and visualizations consume these objects; they do not load CSV files.
 * Replace the mock imports with fetch('../data/test/...') later.
 */
import { ROLE_ORDER } from './constants.js';
import { mockCatalog, mockPlayerGames, mockLineupGames } from './mock-data.js';

function indexById(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function sortByRole(players) {
  return [...players].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );
}

function hydrate() {
  const teams = mockCatalog.teams.map((team) => ({ ...team }));
  const teamById = indexById(teams);

  const players = mockCatalog.players.map((player) => ({
    ...player,
    team: teamById[player.teamId],
  }));
  const playerById = indexById(players);

  const lineups = mockCatalog.lineups.map((lineup) => ({
    ...lineup,
    team: teamById[lineup.teamId],
    players: sortByRole(lineup.playerIds.map((id) => playerById[id]).filter(Boolean)),
  }));
  const lineupById = indexById(lineups);

  return {
    season: mockCatalog.season,
    split: mockCatalog.split,
    sourceLabel: mockCatalog.sourceLabel,
    teams,
    players,
    lineups,
    teamById,
    playerById,
    lineupById,
  };
}

const catalog = hydrate();

export const dataSource = {
  mode: 'mock',

  async loadCatalog() {
    return catalog;
  },

  async getTeam(id) {
    return catalog.teamById[id] ?? null;
  },

  async getPlayer(id) {
    return catalog.playerById[id] ?? null;
  },

  async getLineup(id) {
    return catalog.lineupById[id] ?? null;
  },

  async listPlayersByTeam() {
    return catalog.teams.map((team) => ({
      team,
      players: sortByRole(catalog.players.filter((player) => player.teamId === team.id)),
    }));
  },

  async listLineupsByTeam() {
    return catalog.teams.map((team) => ({
      team,
      lineups: catalog.lineups.filter((lineup) => lineup.teamId === team.id),
    }));
  },

  async listTeamPlayers(teamId) {
    return sortByRole(catalog.players.filter((player) => player.teamId === teamId));
  },

  async listTeamLineups(teamId) {
    return catalog.lineups.filter((lineup) => lineup.teamId === teamId);
  },

  async loadPlayerGames(playerId) {
    return mockPlayerGames
      .filter((game) => game.playerId === playerId)
      .map((game) => enrichGame(game, catalog));
  },

  async loadLineupGames(lineupId) {
    return mockLineupGames
      .filter((game) => game.lineupId === lineupId)
      .map((game) => enrichGame(game, catalog));
  },
};

function enrichGame(game, { teamById, playerById, lineupById }) {
  return {
    ...game,
    opponent: teamById[game.opponentTeamId] ?? null,
    player: game.playerId ? playerById[game.playerId] ?? null : null,
    lineup: game.lineupId ? lineupById[game.lineupId] ?? null : null,
  };
}
