/** Descriptive damage rankings within one selected league/season dataset. */
export const RANKING_ROLES = Object.freeze(['top', 'jng', 'mid', 'bot', 'sup']);
export const RANKING_MIN_GAMES = 10;
export const RANKING_MIN_DAYS = 3;

export function hasRankingSample(item) {
  const stats = item?.stats;
  return stats?.eligible === true
    && Number.isFinite(stats.shrunk_impact)
    && Number.isFinite(stats.n_games) && stats.n_games >= RANKING_MIN_GAMES
    && Number.isFinite(stats.n_days) && stats.n_days >= RANKING_MIN_DAYS;
}

function compareDamage(a, b) {
  const score = b.stats.shrunk_impact - a.stats.shrunk_impact;
  if (score) return score;
  const games = b.stats.n_games - a.stats.n_games;
  if (games) return games;
  const days = b.stats.n_days - a.stats.n_days;
  if (days) return days;
  // Dataset IDs, rather than translated names or win rates, stabilize ties.
  const left = JSON.stringify([a.id, a.teamId ?? '']);
  const right = JSON.stringify([b.id, b.teamId ?? '']);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function rankTeamsByDamage(teams) {
  // Each team score already averages all five roles before season shrinkage.
  return teams.filter(hasRankingSample).sort(compareDamage);
}

export function rankPlayersByRole(players, role) {
  if (!RANKING_ROLES.includes(role)) return [];
  // A player's exported summary is a player/team/role/season stint. Do not
  // average transferred players' precomputed scores or compare different roles.
  return players.filter((player) => player.role === role && hasRankingSample(player)).sort(compareDamage);
}
