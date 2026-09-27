import { dataSource } from '../../utils/data-source.js';
import { ROLE_ORDER } from '../../utils/constants.js';

export async function loadLineupHeatmap(lineupId) {
  const heatmap = await dataSource.getLineupAffinity(lineupId);
  if (!heatmap) throw new Error(`No affinity_score found for lineup ${lineupId}.`);
  return heatmap;
}

function rosterPlayers(players) {
  const ordered = [...players].sort((a, b) => {
    const role = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
    if (role) return role;
    const name = String(a.name).localeCompare(String(b.name));
    return name || String(a.id).localeCompare(String(b.id));
  });
  const seen = new Set();
  const roster = [];
  for (const player of ordered) {
    if (!player?.id || seen.has(player.id)) continue;
    seen.add(player.id);
    roster.push({ id: player.id, name: player.name, role: player.role ?? null });
  }
  return roster;
}

export function heatmapFromRoster(roster, pairs) {
  const pairMap = new Map();
  for (const pair of pairs) {
    pairMap.set([pair.playerAId, pair.playerBId].sort().join('\0'), pair);
  }
  const cells = [];
  roster.forEach((a, row) => {
    roster.forEach((b, col) => {
      if (a.id === b.id) {
        cells.push({ row, col, kind: 'self', pair: null, value: null });
        return;
      }
      const pair = pairMap.get([a.id, b.id].sort().join('\0')) ?? null;
      const value = pair?.stats?.shrunk_impact ?? null;
      const kind = value == null ? 'missing' : (pair.stats.eligible ? 'eligible' : 'sparse');
      cells.push({ row, col, kind, pair, value });
    });
  });
  const magnitudes = cells.filter((cell) => cell.value != null).map((cell) => Math.abs(cell.value));
  return {
    version: 1,
    players: roster,
    cells,
    limit: Math.max(0.15, ...magnitudes),
    hasEligiblePair: [...pairMap.values()].some((pair) => pair.stats?.eligible),
  };
}

export async function loadTeamHeatmap(teamId) {
  const roster = rosterPlayers(await dataSource.listTeamPlayers(teamId));
  const pairs = await dataSource.listPairsForPlayers(roster.map((player) => player.id), teamId);
  return heatmapFromRoster(roster, pairs);
}
