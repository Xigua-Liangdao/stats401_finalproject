import { createIdentityHeader } from '../../components/cards/identity-header.js';
import { createBreadcrumbs } from '../../components/layout/page-shell.js';
import { loadTeam, loadTeamLineups, loadTeamPlayers } from '../../features/team/team-data.js';
import { renderTeamLineups, renderTeamPlayers } from '../../features/team/team-rosters.js';
import { renderTeamStats } from '../../features/team/team-stats.js';
import { MOCK_NOTICE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { renderNotFound } from '../not-found.js';

export async function renderTeamPage(target, id) {
  const team = await loadTeam(id);
  if (!team) {
    renderNotFound(target);
    return;
  }

  const [players, lineups] = await Promise.all([
    loadTeamPlayers(team.id),
    loadTeamLineups(team.id),
  ]);

  target.append(
    h('div', { class: 'page' }, [
      createBreadcrumbs([
        { label: 'Home', href: href.home },
        { label: 'Team' },
        { label: team.name },
      ]),
      h('p', { class: 'notice' }, [MOCK_NOTICE]),
      createIdentityHeader({
        kicker: 'Organization',
        title: team.name,
        mark: team.short,
        facts: [
          { label: 'Season', value: String(team.season) },
          { label: 'Split', value: team.split },
          { label: 'Players', value: String(players.length) },
          { label: 'Lineups', value: String(lineups.length) },
        ],
      }),
      renderTeamPlayers(players),
      renderTeamStats({ playerCount: players.length, lineupCount: lineups.length }),
      renderTeamLineups(lineups),
    ]),
  );
}
