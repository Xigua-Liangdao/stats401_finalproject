/**
 * Single data access point for the UI.
 * Pages consume these objects; they do not load CSV files themselves.
 */
import { DATASET, ROLE_ORDER } from './constants.js';
import { parseCsv } from './csv.js';
import { loadMediaManifest } from './assets.js';

function indexById(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function sortByRole(players) {
  return [...players].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );
}

function asNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asBool(value) {
  return String(value).toLowerCase() === 'true';
}

function playerKey(playerId, teamId, role) {
  return `${playerId}|${teamId}|${role}`;
}

function summaryStats(row, fields) {
  const stats = { eligible: asBool(row.eligible) };
  for (const field of fields) stats[field] = asNumber(row[field]);
  return stats;
}

const PLAYER_STAT_FIELDS = [
  'n_games_total', 'n_games', 'n_days', 'mean_impact', 'shrunk_impact',
  'ci_low', 'ci_high', 'mean_gold_share', 'mean_damage_share', 'mean_dpm',
  'mean_expected_dpm', 'win_rate', 'mean_vision_per_minute',
];
const LINEUP_STAT_FIELDS = [
  'n_games_total', 'n_games', 'n_days', 'mean_impact', 'shrunk_impact',
  'ci_low', 'ci_high', 'win_rate', 'mean_dpm', 'mean_vision_per_minute',
  'gold_concentration', 'damage_concentration',
];
const PAIR_STAT_FIELDS = [
  'n_games_total', 'n_games', 'n_days', 'mean_impact', 'shrunk_impact',
  'ci_low', 'ci_high', 'win_rate',
];
const TEAM_STAT_FIELDS = [
  'n_games_total', 'n_games', 'n_days', 'mean_impact', 'shrunk_impact',
  'ci_low', 'ci_high', 'win_rate',
];

function sortPairs(pairs) {
  return [...pairs].sort((a, b) => {
    const games = (b.stats.n_games ?? -1) - (a.stats.n_games ?? -1);
    return games !== 0 ? games : a.id.localeCompare(b.id);
  });
}

function lineupPlayersFromRow(row, playerByTeam) {
  return ROLE_ORDER.map((role) => {
    const id = row[`${role}_id`];
    const name = row[`${role}_player`];
    const player = playerByTeam.get(playerKey(id, row.team_id, role));
    if (player) return player;
    if (!id) return null;
    return { id, name: name || id, role, season: Number(row.season), teamId: row.team_id, team: null };
  }).filter(Boolean);
}

function hydrateFromPanel(rows, summaries = {}) {
  const playerRows = rows.filter((row) => row.kind === 'player');
  const lineupRows = rows.filter((row) => row.kind === 'lineup');
  const playerStats = new Map(
    (summaries.players ?? []).map((row) => [
      playerKey(row.player_id, row.team_id, row.role),
      summaryStats(row, PLAYER_STAT_FIELDS),
    ]),
  );
  const lineupStats = new Map(
    (summaries.lineups ?? []).map((row) => [row.lineup_id, summaryStats(row, LINEUP_STAT_FIELDS)]),
  );
  const teamStats = new Map(
    (summaries.teams ?? []).map((row) => [row.team_id, summaryStats(row, TEAM_STAT_FIELDS)]),
  );

  const teams = [];
  const seenTeams = new Set();
  for (const row of rows) {
    if (!row.team_id || seenTeams.has(row.team_id)) continue;
    seenTeams.add(row.team_id);
    teams.push({
      id: row.team_id,
      name: row.team,
      short: row.team_short || row.team,
      season: Number(row.season) || row.season,
      split: row.split || 'Unknown',
      stats: teamStats.get(row.team_id) ?? { eligible: false },
    });
  }
  const teamById = indexById(teams);

  const players = playerRows.map((row) => ({
    id: row.player_id,
    name: row.player,
    role: row.role,
    season: Number(row.season),
    teamId: row.team_id,
    team: teamById[row.team_id],
    stats: playerStats.get(playerKey(row.player_id, row.team_id, row.role)) ?? { eligible: false },
  }));
  const playerById = indexById(players);
  const playerByTeam = new Map(players.map((player) => [
    playerKey(player.id, player.teamId, player.role), player,
  ]));

  const lineups = lineupRows.map((row) => {
    const attached = lineupPlayersFromRow(row, playerByTeam).map((player) => ({
      ...player,
      team: player.team || teamById[row.team_id],
    }));
    const games = row.n_games === '' ? null : Number(row.n_games);
    const split = row.split || teamById[row.team_id]?.split || 'Unknown';
    const context = Number.isFinite(games)
      ? `${split} · ${games} game${games === 1 ? '' : 's'}`
      : split;
    return {
      id: row.lineup_id,
      name: row.lineup_name || row.lineup_id,
      teamId: row.team_id,
      context,
      playerIds: ROLE_ORDER.map((role) => row[`${role}_id`]).filter(Boolean),
      team: teamById[row.team_id],
      players: attached,
      stats: lineupStats.get(row.lineup_id) ?? { eligible: false },
    };
  });
  const lineupById = indexById(lineups);

  const pairs = sortPairs(
    (summaries.pairs ?? []).map((row) => ({
      id: row.pair_id,
      teamId: row.team_id,
      teamName: row.team,
      playerAId: row.player_a_id,
      playerBId: row.player_b_id,
      playerA: row.player_a,
      playerB: row.player_b,
      stats: summaryStats(row, PAIR_STAT_FIELDS),
    })),
  );
  const first = rows[0] || {};

  return {
    season: Number(first.season) || teams[0]?.season || null,
    split: first.split || teams[0]?.split || 'Unknown',
    sourceLabel: `${DATASET} / team_panel`,
    mode: DATASET,
    teams,
    players,
    lineups,
    pairs,
    teamById,
    playerById,
    lineupById,
  };
}

function datasetUrl(filename) {
  const dataset = DATASET || 'test';
  return new URL(`../../data/${dataset}/${filename}`, import.meta.url);
}

async function fetchCsv(filename) {
  const url = datasetUrl(filename);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${filename} (${response.status})`);
  }
  const rows = parseCsv(await response.text());
  console.info('[data]', filename, { dataset: DATASET, url: url.href, rows: rows.length });
  return rows;
}

let catalogPromise;
let playerGamesPromise;
let lineupGamesPromise;

function loadCatalogRecord() {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      fetchCsv('team_panel.csv'),
      fetchCsv('players.csv'),
      fetchCsv('lineups.csv'),
      fetchCsv('pairs.csv'),
      fetchCsv('teams.csv'),
      loadMediaManifest(),
    ]).then(([panel, players, lineups, pairs, teams]) => {
      if (!panel.length) throw new Error('team_panel.csv is empty.');
      return hydrateFromPanel(panel, { players, lineups, pairs, teams });
    });
  }
  return catalogPromise;
}

function loadPlayerGameRows() {
  if (!playerGamesPromise) playerGamesPromise = fetchCsv('player_games.csv');
  return playerGamesPromise;
}

function loadLineupGameRows() {
  if (!lineupGamesPromise) lineupGamesPromise = fetchCsv('lineup_games.csv');
  return lineupGamesPromise;
}

function mapPlayerGame(row) {
  return {
    id: row.record_id,
    source: 'player_games',
    playerId: row.player_id,
    teamId: row.team_id,
    lineupId: row.lineup_id,
    date: row.date || row.day,
    season: asNumber(row.season) ?? row.season,
    opponentTeamId: row.opponent_team_id,
    result: asNumber(row.result),
    split: row.split,
    patch: row.patch,
    side: row.side,
    champion: row.champion,
    opponentChampion: row.opponent_champion,
    kills: asNumber(row.kills),
    deaths: asNumber(row.deaths),
    assists: asNumber(row.assists),
    kda: asNumber(row.kda),
    total_gold: asNumber(row.total_gold),
    total_cs: asNumber(row.total_cs),
    damage: asNumber(row.damage),
    dpm: asNumber(row.dpm),
    expected_dpm: asNumber(row.expected_dpm),
    baseline_dpm: asNumber(row.baseline_dpm),
    gold_share: asNumber(row.gold_share),
    damage_share: asNumber(row.damage_share),
    vision_per_minute: asNumber(row.vision_per_minute),
    kill_participation: asNumber(row.kill_participation),
    gold_diff_at_15: asNumber(row.gold_diff_at_15),
    xp_diff_at_15: asNumber(row.xp_diff_at_15),
    cs_diff_at_15: asNumber(row.cs_diff_at_15),
    adjusted_impact: asNumber(row.adjusted_impact),
    prediction_status: row.prediction_status || null,
  };
}

function mapLineupGame(row, opponentTeamId, side) {
  return {
    id: `${row.game_id}|${row.team_id}`,
    source: 'lineup_games',
    lineupId: row.lineup_id,
    date: row.day,
    opponentTeamId,
    result: asNumber(row.result),
    split: row.split,
    patch: row.patch,
    side,
    lineup_impact: asNumber(row.lineup_impact),
    mean_dpm: asNumber(row.mean_dpm),
    mean_vision_per_minute: asNumber(row.mean_vision_per_minute),
    gold_concentration: asNumber(row.gold_concentration),
    damage_concentration: asNumber(row.damage_concentration),
  };
}

function sideByLineupGame(playerRows) {
  const sides = new Map();
  for (const row of playerRows) {
    if (!row.game_id || !row.lineup_id || !row.side) continue;
    const key = `${row.game_id}|${row.lineup_id}`;
    if (!sides.has(key)) sides.set(key, row.side);
  }
  return sides;
}

function pairsForPlayer(catalog, playerId, teamId) {
  return catalog.pairs.filter((pair) => {
    if (teamId && pair.teamId !== teamId) return false;
    return pair.playerAId === playerId || pair.playerBId === playerId;
  });
}

function pairsForPlayers(catalog, playerIds, teamId) {
  const ids = new Set(playerIds.filter(Boolean));
  return catalog.pairs.filter((pair) => {
    if (teamId && pair.teamId !== teamId) return false;
    return ids.has(pair.playerAId) && ids.has(pair.playerBId);
  });
}

export const dataSource = {
  mode: DATASET,

  async loadCatalog() {
    return loadCatalogRecord();
  },

  async getTeam(id) {
    const catalog = await loadCatalogRecord();
    return catalog.teamById[id] ?? null;
  },

  async getPlayer(id, teamId, season) {
    const catalog = await loadCatalogRecord();
    if (teamId || season) {
      return catalog.players.find((player) => player.id === id
        && (!teamId || player.teamId === teamId)
        && (!season || String(player.season) === String(season))) ?? null;
    }
    return catalog.playerById[id] ?? null;
  },

  async getLineup(id) {
    const catalog = await loadCatalogRecord();
    return catalog.lineupById[id] ?? null;
  },

  async listPlayersByTeam() {
    const catalog = await loadCatalogRecord();
    return catalog.teams.map((team) => ({
      team,
      players: sortByRole(catalog.players.filter((player) => player.teamId === team.id)),
    }));
  },

  async listLineupsByTeam() {
    const catalog = await loadCatalogRecord();
    return catalog.teams.map((team) => ({
      team,
      lineups: catalog.lineups.filter((lineup) => lineup.teamId === team.id),
    }));
  },

  async listTeamPlayers(teamId) {
    const catalog = await loadCatalogRecord();
    return sortByRole(catalog.players.filter((player) => player.teamId === teamId));
  },

  async listTeamLineups(teamId) {
    const catalog = await loadCatalogRecord();
    return catalog.lineups.filter((lineup) => lineup.teamId === teamId);
  },

  async listTeamPairs(teamId) {
    const catalog = await loadCatalogRecord();
    return catalog.pairs.filter((pair) => pair.teamId === teamId);
  },

  async listPairsForPlayer(playerId, teamId) {
    const catalog = await loadCatalogRecord();
    return pairsForPlayer(catalog, playerId, teamId);
  },

  async listPairsForPlayers(playerIds, teamId) {
    const catalog = await loadCatalogRecord();
    return pairsForPlayers(catalog, playerIds, teamId);
  },

  async loadPlayerGames(playerId) {
    const [catalog, rows] = await Promise.all([loadCatalogRecord(), loadPlayerGameRows()]);
    const games = rows
      .filter((row) => row.player_id === playerId)
      .map((row) => enrichGame(mapPlayerGame(row), catalog));
    if (!games.length) {
      console.info('[data] no player games', { playerId, file: 'player_games.csv' });
    }
    return games;
  },

  async loadTeamPlayerGames(teamId) {
    const [catalog, rows] = await Promise.all([loadCatalogRecord(), loadPlayerGameRows()]);
    const games = rows
      .filter((row) => row.team_id === teamId)
      .map((row) => enrichGame(mapPlayerGame(row), catalog));
    if (!games.length) {
      console.info('[data] no team player games', { teamId, file: 'player_games.csv' });
    }
    return games;
  },

  async loadLineupGames(lineupId) {
    const [catalog, rows, playerRows] = await Promise.all([
      loadCatalogRecord(),
      loadLineupGameRows(),
      loadPlayerGameRows(),
    ]);
    const byGame = new Map();
    for (const row of rows) {
      const list = byGame.get(row.game_id);
      if (list) list.push(row);
      else byGame.set(row.game_id, [row]);
    }
    const sides = sideByLineupGame(playerRows);
    const games = rows
      .filter((row) => row.lineup_id === lineupId)
      .map((row) => {
        const other = (byGame.get(row.game_id) ?? []).find((item) => item.team_id !== row.team_id);
        const side = sides.get(`${row.game_id}|${row.lineup_id}`) ?? null;
        return enrichGame(mapLineupGame(row, other?.team_id ?? null, side), catalog);
      });
    if (!games.length) {
      console.info('[data] no lineup games', { lineupId, file: 'lineup_games.csv' });
    }
    return games;
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
