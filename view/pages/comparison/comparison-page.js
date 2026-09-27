import { createPageShell } from '../../components/layout/page-shell.js';
import { createComparisonBoard } from '../../features/comparison/comparison-board.js';
import { dataSource } from '../../utils/data-source.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { getSelectedSeason } from '../../utils/season.js';

function forSeason(groups, season) {
  return groups.filter((group) => String(group.team.season) === String(season));
}

export async function renderComparisonPage(target) {
  const season = getSelectedSeason();
  const [playerGroups, lineupGroups] = await Promise.all([
    dataSource.listPlayersByTeam(),
    dataSource.listLineupsByTeam(),
  ]);
  const seasonPlayers = forSeason(playerGroups, season);
  const teams = seasonPlayers.map((group) => group.team);
  const playersByTeam = new Map(seasonPlayers.map((group) => [group.team.id, group.players]));
  const lineupsByTeam = new Map(
    forSeason(lineupGroups, season).map((group) => [group.team.id, group.lineups]),
  );

  target.append(
    createPageShell({
      kicker: '01 / Comparison',
      title: 'Comparison',
      breadcrumbs: [
        { label: 'Home', href: href.home },
        { label: 'Comparison' },
      ],
      children: h('div', {}, [
        createComparisonBoard({ teams, playersByTeam, lineupsByTeam }),
      ]),
    }),
  );
}
