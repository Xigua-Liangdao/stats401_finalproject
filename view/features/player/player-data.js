import { dataSource } from '../../utils/data-source.js';

export function loadPlayerCatalog() {
  return dataSource.listPlayersByTeam();
}

export function loadPlayer(id, teamId, season) {
  return dataSource.getPlayer(id, teamId, season);
}
