/**
 * Single data access point for the UI.
 * Pages consume these objects; they do not load CSV files themselves.
 */
import { DATASET } from './constants.js';
import { parseCsv } from './csv.js';
import { loadMedia } from './assets.js';
import { setLoadProgress } from './load-progress.js';
import { datasetKey, ensureDataset } from './season.js';
import {
  enrichGame,
  hydrateFromPanel,
  mapLineupGame,
  mapPair,
  mapPlayerGame,
  pairsForPlayer,
  pairsForPlayers,
  parseLineupAffinity,
  sideByLineupGame,
  sortByRole,
  sortPairs,
} from './dataset-records.js';


// Each source owns its promises and maps. In-flight reads retain the original
// league/year even when the user switches selection before a request completes.
export function createDataSource(entry, { fetcher = (...args) => fetch(...args), mediaLoader = loadMedia } = {}) {
  if (entry?.status !== 'ready' || !/^[a-z0-9_-]+\/\d{4}$/.test(entry.path)) {
    throw new Error(entry?.reason || 'Dataset is unavailable.');
  }
  if (entry.compression != null && entry.compression !== 'gzip') {
    throw new Error(`Unsupported dataset compression: ${entry.compression}`);
  }
function datasetUrl(filename) {
  const dataset = DATASET || 'test';
  const file = entry.compression === 'gzip' ? `${filename}.gz` : filename;
  const url = new URL(`../../data/${dataset}/${entry.path}/${file}`, import.meta.url);
  const version = entry.data_version || entry.source_sha256;
  if (version) url.searchParams.set('v', version);
  return url;
}

async function fetchCsv(filename) {
  const url = datasetUrl(filename);
  const response = await fetcher(url);
  const file = entry.compression === 'gzip' ? `${filename}.gz` : filename;
  if (!response.ok) {
    throw new Error(`Failed to load ${file} (${response.status})`);
  }
  let text;
  if (entry.compression === 'gzip') {
    if (typeof DecompressionStream !== 'function') {
      throw new Error(`Cannot load ${file}: this browser does not support gzip decompression (DecompressionStream).`);
    }
    try {
      if (!response.body) throw new Error('The response body is empty.');
      const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
      text = await new Response(stream).text();
    } catch (error) {
      throw new Error(`Failed to decompress ${file}: ${error.message}`, { cause: error });
    }
  } else {
    text = await response.text();
  }
  const rows = parseCsv(text);
  return rows;
}

let catalogPromise;
let lineupRowsPromise;
let pairsPromise;
let playerGamesPromise;
let lineupGamesPromise;
const lineupAffinityById = new Map();

function loadLineupRows() {
  if (!lineupRowsPromise) lineupRowsPromise = fetchCsv('lineups.csv').catch((error) => {
    lineupRowsPromise = null;
    throw error;
  });
  return lineupRowsPromise;
}

function loadPairs() {
  if (!pairsPromise) pairsPromise = fetchCsv('pairs.csv').then((rows) => sortPairs(rows.map(mapPair))).catch((error) => {
    pairsPromise = null;
    throw error;
  });
  return pairsPromise;
}

function loadCatalogRecord() {
  if (!catalogPromise) {
    // Five startup reads share the span from the boot mark (8) up to 92.
    // The first rendered page sets 100 once it is actually on screen.
    let completed = 0;
    const track = (promise) => promise.then((value) => {
      completed += 1;
      setLoadProgress(8 + completed * (84 / 5));
      return value;
    });
    catalogPromise = Promise.all([
      track(fetchCsv('team_panel.csv')),
      track(fetchCsv('players.csv')),
      track(loadLineupRows()),
      track(fetchCsv('teams.csv')),
      track(mediaLoader()),
    ]).then(([panel, players, lineups, teams]) => {
      if (!panel.length) throw new Error('team_panel.csv is empty.');
      return hydrateFromPanel(panel, { players, lineups, teams }, entry);
    }).catch((error) => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}

function loadPlayerGameRows() {
  if (!playerGamesPromise) playerGamesPromise = fetchCsv('player_games.csv').catch((error) => {
    playerGamesPromise = null;
    throw error;
  });
  return playerGamesPromise;
}

function loadLineupGameRows() {
  if (!lineupGamesPromise) lineupGamesPromise = fetchCsv('lineup_games.csv').catch((error) => {
    lineupGamesPromise = null;
    throw error;
  });
  return lineupGamesPromise;
}


return {
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

  async getLineupAffinity(id) {
    if (!lineupAffinityById.has(id)) {
      const rows = await loadLineupRows();
      const row = rows.find((item) => item.lineup_id === id);
      if (!row) return null;
      if (!lineupAffinityById.has(id)) {
        lineupAffinityById.set(id, parseLineupAffinity(row.affinity_score, id));
      }
    }
    return lineupAffinityById.get(id);
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
    const pairs = await loadPairs();
    return pairs.filter((pair) => pair.teamId === teamId);
  },

  async listPairsForPlayer(playerId, teamId) {
    return pairsForPlayer(await loadPairs(), playerId, teamId);
  },

  async listPairsForPlayers(playerIds, teamId) {
    return pairsForPlayers(await loadPairs(), playerIds, teamId);
  },

  async loadPlayerGames(playerId) {
    const [catalog, rows] = await Promise.all([loadCatalogRecord(), loadPlayerGameRows()]);
    const games = rows
      .filter((row) => row.player_id === playerId)
      .map((row) => enrichGame(mapPlayerGame(row), catalog));
    return games;
  },

  async loadTeamPlayerGames(teamId) {
    const [catalog, rows] = await Promise.all([loadCatalogRecord(), loadPlayerGameRows()]);
    const games = rows
      .filter((row) => row.team_id === teamId)
      .map((row) => enrichGame(mapPlayerGame(row), catalog));
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
    return games;
  },
};


}

const sources = new Map();
const METHODS = [
  'loadCatalog', 'getTeam', 'getPlayer', 'getLineup', 'getLineupAffinity',
  'listPlayersByTeam', 'listLineupsByTeam', 'listTeamPlayers', 'listTeamLineups',
  'listTeamPairs', 'listPairsForPlayer', 'listPairsForPlayers', 'loadPlayerGames',
  'loadTeamPlayerGames', 'loadLineupGames',
];

export const dataSource = {
  mode: DATASET,
  ...Object.fromEntries(METHODS.map((method) => [method, async (...args) => {
    const entry = await ensureDataset();
    const key = `${DATASET}|${datasetKey(entry)}|${entry.path}|${entry.data_version || entry.source_sha256 || ''}|${entry.compression || ''}`;
    if (!sources.has(key)) sources.set(key, createDataSource(entry));
    return sources.get(key)[method](...args);
  }])),
};
