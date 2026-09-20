import { dataSource } from '../../utils/data-source.js';
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
  return uniqueById(
    teamPlayers.filter((player) => (player.stats?.n_games ?? 0) > 0 || selected.has(player.id)),
  );
}

export async function loadPairImpactContext(origin) {
  if (origin.source === 'lineup') {
    const precomputed = await dataSource.getLineupAffinity(origin.lineupId);
    if (!precomputed) throw new Error(`No affinity_score found for lineup ${origin.lineupId}.`);
    console.info('[data] pair impact', {
      source: origin.source,
      lineupId: origin.lineupId,
      players: precomputed.players.length,
      file: 'lineups.csv',
      column: 'affinity_score',
    });
    return {
      origin,
      selectedPlayers: precomputed.players.map((player) => player.id),
      players: precomputed.players,
      pairs: [],
      precomputed,
    };
  }

  const ids = origin.selectedPlayerIds ?? [];
  const [teamPlayers, pairs] = await Promise.all([
    origin.teamId ? dataSource.listTeamPlayers(origin.teamId) : Promise.resolve([]),
    origin.teamId
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
