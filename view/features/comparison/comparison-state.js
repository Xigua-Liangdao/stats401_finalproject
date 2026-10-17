// A shared URL may refer to removed data, a different role, or the same player
// twice. Keep valid partial choices so the user can repair just the stale side.
export function resolveComparisonState(state = {}, { teams, playersByTeam, lineupsByTeam }) {
  const mode = state.mode === 'lineup' ? 'lineup' : 'player';
  const teamIds = new Set(teams.map((team) => team.id));
  const groups = mode === 'lineup' ? lineupsByTeam : playersByTeam;
  const leftTeamId = teamIds.has(state.leftTeamId) ? state.leftTeamId : '';
  const rightTeamId = teamIds.has(state.rightTeamId) ? state.rightTeamId : '';
  const left = groups.get(leftTeamId)?.find((item) => item.id === state.leftId);
  let right = groups.get(rightTeamId)?.find((item) => item.id === state.rightId);
  if (left && right && (left.id === right.id || (mode === 'player' && left.role !== right.role))) right = null;
  return { mode, leftTeamId, rightTeamId, leftId: left?.id ?? '', rightId: right?.id ?? '' };
}
