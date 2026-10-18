import { DATASET, ROLE_ORDER } from './constants.js';
import { fromData, t } from './i18n.js';

function indexById(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function bindText(record, field, group, raw) {
  const key = raw == null || raw === '' ? null : String(raw);
  Object.defineProperty(record, field, {
    enumerable: true,
    configurable: true,
    get() {
      return fromData(group, key);
    },
  });
  return record;
}

function copyRecord(source, extra = {}) {
  const copy = {};
  for (const key of Object.keys(source)) {
    const description = Object.getOwnPropertyDescriptor(source, key);
    if (description.get || description.set) Object.defineProperty(copy, key, description);
    else copy[key] = source[key];
  }
  const sourceName = Object.getOwnPropertyDescriptor(source, 'sourceName');
  if (sourceName) Object.defineProperty(copy, 'sourceName', sourceName);
  return Object.assign(copy, extra);
}

export function sortByRole(players) {
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
  'mean_baseline_gold_share', 'mean_baseline_damage_share',
  'mean_baseline_dpm', 'mean_baseline_vision_per_minute', 'mean_baseline_impact',
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

export function sortPairs(pairs) {
  return [...pairs].sort((a, b) => {
    const games = (b.stats.n_games ?? -1) - (a.stats.n_games ?? -1);
    return games !== 0 ? games : a.id.localeCompare(b.id);
  });
}

export function mapPair(row) {
  const pair = {
    id: row.pair_id,
    teamId: row.team_id,
    playerAId: row.player_a_id,
    playerBId: row.player_b_id,
    stats: summaryStats(row, PAIR_STAT_FIELDS),
  };
  bindText(pair, 'teamName', 'teams', row.team);
  bindText(pair, 'playerA', 'players', row.player_a);
  bindText(pair, 'playerB', 'players', row.player_b);
  return pair;
}

export function parseLineupAffinity(value, lineupId) {
  let payload;
  try {
    payload = JSON.parse(value);
  } catch {
    throw new Error(`Invalid affinity_score JSON for lineup ${lineupId}. Regenerate lineups.csv.`);
  }
  const kinds = new Set(['self', 'missing', 'sparse', 'eligible']);
  const validPlayers = Array.isArray(payload?.players) && payload.players.length === ROLE_ORDER.length
    && payload.players.every((player) => typeof player?.id === 'string'
      && typeof player.name === 'string' && (player.role === null || typeof player.role === 'string'));
  const n = payload?.players?.length;
  const validCells = validPlayers && Array.isArray(payload.cells) && payload.cells.length === n * n
    && payload.cells.every((cell, index) => cell?.row === Math.floor(index / n)
      && cell.col === index % n && kinds.has(cell.kind)
      && (cell.value === null || Number.isFinite(cell.value))
      && (cell.pair === null || (typeof cell.pair === 'object' && cell.pair.stats))
      && (cell.value === null || cell.pair !== null));
  if (payload?.version !== 1 || !validCells || !Number.isFinite(payload.limit)
    || payload.limit < 0.15 || typeof payload.hasEligiblePair !== 'boolean') {
    throw new Error(`Invalid affinity_score payload for lineup ${lineupId}. Regenerate lineups.csv.`);
  }
  for (const player of payload.players) bindText(player, 'name', 'players', player.name);
  return payload;
}

function lineupPlayersFromRow(row, playerByTeam) {
  return ROLE_ORDER.map((role) => {
    const id = row[`${role}_id`];
    const name = row[`${role}_player`];
    const player = playerByTeam.get(playerKey(id, row.team_id, role));
    if (player) return player;
    if (!id) return null;
    const fallback = { id, role, season: Number(row.season), teamId: row.team_id, team: null };
    return bindText(fallback, 'name', 'players', name || id);
  }).filter(Boolean);
}

export function hydrateFromPanel(rows, summaries = {}, entry) {
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
    const team = {
      id: row.team_id,
      league: entry.league,
      short: row.team_short || row.team,
      season: Number(row.season) || row.season,
      split: row.split || t('common.unknown'),
      stats: teamStats.get(row.team_id) ?? { eligible: false },
    };
    bindText(team, 'name', 'teams', row.team);
    Object.defineProperty(team, 'sourceName', { value: row.team || '', enumerable: false });
    teams.push(team);
  }
  const teamById = indexById(teams);

  const players = playerRows.map((row) => {
    const player = {
      id: row.player_id,
      league: entry.league,
      role: row.role,
      season: Number(row.season),
      teamId: row.team_id,
      team: teamById[row.team_id],
      stats: playerStats.get(playerKey(row.player_id, row.team_id, row.role)) ?? { eligible: false },
    };
    bindText(player, 'name', 'players', row.player);
    Object.defineProperty(player, 'sourceName', { value: row.player || '', enumerable: false });
    return player;
  });
  const playerById = indexById(players);
  const playerByTeam = new Map(players.map((player) => [
    playerKey(player.id, player.teamId, player.role), player,
  ]));

  const lineups = lineupRows.map((row) => {
    const attached = lineupPlayersFromRow(row, playerByTeam).map((player) => (
      copyRecord(player, { league: entry.league, team: player.team || teamById[row.team_id] })
    ));
    const games = row.n_games === '' ? null : Number(row.n_games);
    const split = row.split || teamById[row.team_id]?.split || t('common.unknown');
    const context = Number.isFinite(games)
      ? `${split} · ${games} game${games === 1 ? '' : 's'}`
      : split;
    return {
      id: row.lineup_id,
      league: entry.league,
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

  const first = rows[0] || {};

  return {
    season: Number(first.season) || teams[0]?.season || null,
    split: first.split || teams[0]?.split || t('common.unknown'),
    league: entry.league,
    dataset: entry,
    sourceLabel: `${DATASET} / ${entry.path} / team_panel`,
    mode: DATASET,
    teams,
    players,
    lineups,
    teamById,
    playerById,
    lineupById,
  };
}

export function mapPlayerGame(row) {
  const game = {
    id: row.record_id,
    source: 'player_games',
    playerId: row.player_id,
    role: row.role,
    teamId: row.team_id,
    lineupId: row.lineup_id,
    date: row.date || row.day,
    season: asNumber(row.season) ?? row.season,
    opponentTeamId: row.opponent_team_id,
    result: asNumber(row.result),
    split: row.split,
    patch: row.patch,
    side: row.side,
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
  bindText(game, 'champion', 'champions', row.champion);
  bindText(game, 'opponentChampion', 'champions', row.opponent_champion);
  return game;
}

export function mapLineupGame(row, opponentTeamId, side) {
  const roles = Object.fromEntries(
    ROLE_ORDER.map((role) => {
      const slot = {
        id: row[`${role}_id`] || null,
        gold_share: asNumber(row[`${role}_gold_share`]),
        damage_share: asNumber(row[`${role}_damage_share`]),
      };
      bindText(slot, 'name', 'players', row[`${role}_player`] || null);
      return [role, slot];
    }),
  );
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
    roles,
  };
}

export function sideByLineupGame(playerRows) {
  const sides = new Map();
  for (const row of playerRows) {
    if (!row.game_id || !row.lineup_id || !row.side) continue;
    const key = `${row.game_id}|${row.lineup_id}`;
    if (!sides.has(key)) sides.set(key, row.side);
  }
  return sides;
}

export function pairsForPlayer(pairs, playerId, teamId) {
  return pairs.filter((pair) => {
    if (teamId && pair.teamId !== teamId) return false;
    return pair.playerAId === playerId || pair.playerBId === playerId;
  });
}

export function pairsForPlayers(pairs, playerIds, teamId) {
  const ids = new Set(playerIds.filter(Boolean));
  return pairs.filter((pair) => {
    if (teamId && pair.teamId !== teamId) return false;
    return ids.has(pair.playerAId) && ids.has(pair.playerBId);
  });
}

export function enrichGame(game, { teamById, playerById, lineupById }) {
  return copyRecord(game, {
    opponent: teamById[game.opponentTeamId] ?? null,
    player: game.playerId ? playerById[game.playerId] ?? null : null,
    lineup: game.lineupId ? lineupById[game.lineupId] ?? null : null,
  });
}
