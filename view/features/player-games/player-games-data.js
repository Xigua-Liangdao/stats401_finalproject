import { dataSource } from '../../utils/data-source.js?v=game-stats';

export function loadPlayerGames(playerId) {
  return dataSource.loadPlayerGames(playerId);
}

export function getPlayerGame(games, gameId) {
  return games.find((game) => game.id === gameId) ?? null;
}
