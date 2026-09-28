import { createPageShell } from '../../components/layout/page-shell.js';
import { createComparisonBoard } from '../../features/comparison/comparison-board.js';
import { dataSource } from '../../utils/data-source.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
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
      kicker: t('compare.kicker'),
      title: t('nav.comparison'),
      breadcrumbs: [
        { label: t('nav.home'), href: href.home },
        { label: t('nav.comparison') },
      ],
      children: h('div', {}, [
        createComparisonBoard({ teams, playersByTeam, lineupsByTeam }),
      ]),
    }),
  );
}
