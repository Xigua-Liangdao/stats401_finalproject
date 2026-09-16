/**
 * Fixture entities for the visual skeleton.
 * Numeric fields stay as placeholders so later pipeline values cannot collide.
 */
export const mockCatalog = {
  season: 2025,
  split: 'Split 1',
  sourceLabel: 'MOCK / NOT PIPELINE',
  teams: [
    { id: 'tes', name: 'Top Esports', short: 'TES', season: 2025, split: 'Split 1' },
    { id: 'blg', name: 'Bilibili Gaming', short: 'BLG', season: 2025, split: 'Split 1' },
    { id: 'al', name: "Anyone's Legend", short: 'AL', season: 2025, split: 'Split 1' },
  ],
  players: [
    { id: 'tes-369', name: '369', role: 'top', teamId: 'tes' },
    { id: 'tes-kanavi', name: 'Kanavi', role: 'jng', teamId: 'tes' },
    { id: 'tes-creme', name: 'Creme', role: 'mid', teamId: 'tes' },
    { id: 'tes-jackeylove', name: 'JackeyLove', role: 'bot', teamId: 'tes' },
    { id: 'tes-crisp', name: 'Crisp', role: 'sup', teamId: 'tes' },
    { id: 'blg-bin', name: 'Bin', role: 'top', teamId: 'blg' },
    { id: 'blg-wei', name: 'Wei', role: 'jng', teamId: 'blg' },
    { id: 'blg-xun', name: 'Xun', role: 'jng', teamId: 'blg' },
    { id: 'blg-knight', name: 'Knight', role: 'mid', teamId: 'blg' },
    { id: 'blg-elk', name: 'Elk', role: 'bot', teamId: 'blg' },
    { id: 'blg-on', name: 'ON', role: 'sup', teamId: 'blg' },
    { id: 'al-flandre', name: 'Flandre', role: 'top', teamId: 'al' },
    { id: 'al-tarzan', name: 'Tarzan', role: 'jng', teamId: 'al' },
    { id: 'al-shanks', name: 'Shanks', role: 'mid', teamId: 'al' },
    { id: 'al-hope', name: 'Hope', role: 'bot', teamId: 'al' },
    { id: 'al-kael', name: 'Kael', role: 'sup', teamId: 'al' },
  ],
  lineups: [
    {
      id: 'tes-01',
      name: 'TES-01',
      teamId: 'tes',
      context: 'Split 1 · Primary',
      playerIds: ['tes-369', 'tes-kanavi', 'tes-creme', 'tes-jackeylove', 'tes-crisp'],
    },
    {
      id: 'blg-01',
      name: 'BLG-01',
      teamId: 'blg',
      context: 'Split 1 · Wei jungle',
      playerIds: ['blg-bin', 'blg-wei', 'blg-knight', 'blg-elk', 'blg-on'],
    },
    {
      id: 'blg-02',
      name: 'BLG-02',
      teamId: 'blg',
      context: 'Split 1 · Xun jungle',
      playerIds: ['blg-bin', 'blg-xun', 'blg-knight', 'blg-elk', 'blg-on'],
    },
    {
      id: 'al-01',
      name: 'AL-01',
      teamId: 'al',
      context: 'Split 1 · Primary',
      playerIds: ['al-flandre', 'al-tarzan', 'al-shanks', 'al-hope', 'al-kael'],
    },
  ],
};

export const mockPlayerGames = [
  game('mock-pg-369-01', 'tes-369', 'tes-01', '2025-01-18', 'blg', 1, 'Blue', 'Gwen', 'KSante'),
  game('mock-pg-369-02', 'tes-369', 'tes-01', '2025-01-25', 'al', 0, 'Red', 'Rumble', 'Jayce'),
  game('mock-pg-369-03', 'tes-369', 'tes-01', '2025-02-02', 'blg', 1, 'Blue', 'Aatrox', 'Renekton'),
  game('mock-pg-kanavi-01', 'tes-kanavi', 'tes-01', '2025-01-18', 'blg', 1, 'Blue', 'Xin Zhao', 'Skarner'),
  game('mock-pg-kanavi-02', 'tes-kanavi', 'tes-01', '2025-01-25', 'al', 0, 'Red', 'Sejuani', 'Maokai'),
  game('mock-pg-creme-01', 'tes-creme', 'tes-01', '2025-01-18', 'blg', 1, 'Blue', 'Azir', 'Ahri'),
  game('mock-pg-jackey-01', 'tes-jackeylove', 'tes-01', '2025-01-18', 'blg', 1, 'Blue', 'Jinx', 'Varus'),
  game('mock-pg-crisp-01', 'tes-crisp', 'tes-01', '2025-01-18', 'blg', 1, 'Blue', 'Braum', 'Alistar'),
  game('mock-pg-bin-01', 'blg-bin', 'blg-01', '2025-01-18', 'tes', 0, 'Red', 'KSante', 'Gwen'),
  game('mock-pg-bin-02', 'blg-bin', 'blg-02', '2025-02-08', 'al', 1, 'Blue', 'Jax', 'Renekton'),
  game('mock-pg-wei-01', 'blg-wei', 'blg-01', '2025-01-18', 'tes', 0, 'Red', 'Skarner', 'Xin Zhao'),
  game('mock-pg-xun-01', 'blg-xun', 'blg-02', '2025-02-08', 'al', 1, 'Blue', 'Vi', 'Sejuani'),
  game('mock-pg-knight-01', 'blg-knight', 'blg-01', '2025-01-18', 'tes', 0, 'Red', 'Ahri', 'Azir'),
  game('mock-pg-elk-01', 'blg-elk', 'blg-01', '2025-01-18', 'tes', 0, 'Red', 'Varus', 'Jinx'),
  game('mock-pg-on-01', 'blg-on', 'blg-01', '2025-01-18', 'tes', 0, 'Red', 'Alistar', 'Braum'),
  game('mock-pg-flandre-01', 'al-flandre', 'al-01', '2025-01-25', 'tes', 1, 'Blue', 'Jayce', 'Rumble'),
  game('mock-pg-tarzan-01', 'al-tarzan', 'al-01', '2025-01-25', 'tes', 1, 'Blue', 'Maokai', 'Sejuani'),
  game('mock-pg-shanks-01', 'al-shanks', 'al-01', '2025-01-25', 'tes', 1, 'Blue', 'Yone', 'Azir'),
  game('mock-pg-hope-01', 'al-hope', 'al-01', '2025-01-25', 'tes', 1, 'Blue', 'KaiSa', 'Jinx'),
  game('mock-pg-kael-01', 'al-kael', 'al-01', '2025-01-25', 'tes', 1, 'Blue', 'Rakan', 'Braum'),
];

export const mockLineupGames = [
  lineupGame('mock-lg-tes-01-a', 'tes-01', '2025-01-18', 'blg', 1, 'Split 1', '15.02'),
  lineupGame('mock-lg-tes-01-b', 'tes-01', '2025-01-25', 'al', 0, 'Split 1', '15.02'),
  lineupGame('mock-lg-tes-01-c', 'tes-01', '2025-02-02', 'blg', 1, 'Split 1', '15.03'),
  lineupGame('mock-lg-blg-01-a', 'blg-01', '2025-01-18', 'tes', 0, 'Split 1', '15.02'),
  lineupGame('mock-lg-blg-01-b', 'blg-01', '2025-01-22', 'al', 1, 'Split 1', '15.02'),
  lineupGame('mock-lg-blg-02-a', 'blg-02', '2025-02-08', 'al', 1, 'Split 1', '15.03'),
  lineupGame('mock-lg-blg-02-b', 'blg-02', '2025-02-15', 'tes', 0, 'Split 1', '15.04'),
  lineupGame('mock-lg-al-01-a', 'al-01', '2025-01-25', 'tes', 1, 'Split 1', '15.02'),
  lineupGame('mock-lg-al-01-b', 'al-01', '2025-01-22', 'blg', 0, 'Split 1', '15.02'),
  lineupGame('mock-lg-al-01-c', 'al-01', '2025-02-08', 'blg', 0, 'Split 1', '15.03'),
];

function game(id, playerId, lineupId, date, opponentTeamId, result, side, champion, opponentChampion) {
  return {
    id,
    source: 'player_games',
    playerId,
    lineupId,
    date,
    opponentTeamId,
    result,
    split: 'Split 1',
    patch: 'MOCK',
    side,
    champion,
    opponentChampion,
  };
}

function lineupGame(id, lineupId, date, opponentTeamId, result, split, patch) {
  return {
    id,
    source: 'lineup_games',
    lineupId,
    date,
    opponentTeamId,
    result,
    split,
    patch,
  };
}
