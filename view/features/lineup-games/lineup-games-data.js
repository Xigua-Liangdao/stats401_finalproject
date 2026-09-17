import { dataSource } from '../../utils/data-source.js?v=game-stats';

export function loadLineupGames(lineupId) {
  return dataSource.loadLineupGames(lineupId);
}
