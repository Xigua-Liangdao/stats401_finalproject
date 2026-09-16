import { dataSource } from '../../utils/data-source.js';

export function loadLineupGames(lineupId) {
  return dataSource.loadLineupGames(lineupId);
}
