import { dataSource } from '../../utils/data-source.js?v=pair-heatmap5';
import { ROLE_ORDER } from '../../utils/constants.js';

export const PAIR_STAT_CARDS = [
  { key: 'n_games', field: 'n_games', format: 'count', label: 'Games together', hint: 'Evaluated pair-games' },
  { key: 'win_rate', field: 'win_rate', format: 'percent', label: 'Win rate', hint: 'Evaluated games won' },
  { key: 'mean_impact', field: 'mean_impact', format: 'impact', label: 'Mean impact', hint: 'Unshrunk co-performance' },
  { key: 'shrunk_impact', field: 'shrunk_impact', format: 'impact', label: 'Shrunk impact', hint: 'Stabilized co-performance' },
];

function uniqueById(players) {
  const seen = new Set();
  const ordered = [...players].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || String(a.id).localeCompare(String(b.id)),
  );
  return ordered.filter((player) => {
    if (seen.has(player.id)) return false;
    seen.add(player.id);
    return true;
  });
}

function buildRoster(origin, teamPlayers) {
  const selectedIds = origin.selectedPlayerIds ?? [];
  const selected = new Set(selectedIds);
  const byId = Object.fromEntries(teamPlayers.map((player) => [player.id, player]));

  if (origin.source === 'lineup') {
    return selectedIds.map((id, index) => {
      if (byId[id]) return byId[id];
      return {
        id,
        name: origin.selectedNames?.[index] ?? id,
        role: null,
        stats: { eligible: false },
      };
    });
  }

  return uniqueById(
    teamPlayers.filter((player) => (player.stats?.n_games ?? 0) > 0 || selected.has(player.id)),
  );
}

export async function loadPairImpactContext(origin) {
  const ids = origin.selectedPlayerIds ?? [];
  const [teamPlayers, pairs] = await Promise.all([
    origin.teamId ? dataSource.listTeamPlayers(origin.teamId) : Promise.resolve([]),
    origin.source === 'lineup'
      ? dataSource.listPairsForPlayers(ids, origin.teamId)
      : origin.teamId
        ? dataSource.listTeamPairs(origin.teamId)
        : dataSource.listPairsForPlayer(ids[0], origin.teamId),
  ]);

  const players = buildRoster(origin, teamPlayers);
  const context = {
    origin,
    selectedPlayers: ids,
    players,
    pairs,
    focus: pairs[0] ?? null,
  };
  console.info('[data] pair impact', {
    source: origin.source,
    teamId: origin.teamId,
    selected: ids.length,
    players: players.length,
    pairs: pairs.length,
    file: 'pairs.csv',
  });
  return context;
}
