import { createButton } from '../../components/buttons/button.js';
import { createIdentityHeader, teamFact } from '../../components/cards/identity-header.js';
import { createTeamLogo } from '../../components/media/entity-images.js';
import { createBreadcrumbs } from '../../components/layout/page-shell.js';
import { loadLineup } from '../../features/lineup/lineup-data.js';
import { renderLineupRoster } from '../../features/lineup/lineup-roster.js';
import { renderLineupStats } from '../../features/lineup/lineup-stats.js';
import { loadLineupGames } from '../../features/lineup-games/lineup-games-data.js?v=game-stats';
import { renderLineupGamesCatalogue } from '../../features/lineup-games/lineup-games-catalogue.js?v=game-stats';
import { openPairImpactDrawer } from '../../features/pair-impact/pair-impact-drawer.js?v=pair-heatmap6';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js?v=catalogue-back';
import { renderNotFound } from '../not-found.js';

export async function renderLineupPage(target, id) {
  const lineup = await loadLineup(id);
  if (!lineup) {
    renderNotFound(target);
    return;
  }

  const games = await loadLineupGames(lineup.id);
  const teamHref = href.team(lineup.team.id);

  target.append(
    h('div', { class: 'page' }, [
      createBreadcrumbs([
        { label: 'Home', href: href.home },
        { label: 'Catalogue', href: href.players },
        { label: lineup.team.name, href: teamHref },
        { label: lineup.name },
      ]),
      createIdentityHeader({
        kicker: 'Lineup file',
        title: lineup.name,
        mark: createTeamLogo(lineup.team),
        facts: [
          teamFact(lineup.team),
          { label: 'Context', value: lineup.context },
          { label: 'Season', value: String(lineup.team.season) },
        ],
        actions: [
          createButton({
            label: 'Back to team',
            href: teamHref,
          }),
          createButton({
            label: 'Check Pair Impact',
            variant: 'accent',
            onClick: () =>
              openPairImpactDrawer({
                source: 'lineup',
                teamId: lineup.team.id,
                teamName: lineup.team.name,
                selectedPlayerIds: lineup.players.map((player) => player.id),
                selectedNames: lineup.players.map((player) => player.name),
              }),
          }),
        ],
      }),
      renderLineupRoster(lineup.players),
      renderLineupStats(lineup, games),
      renderLineupGamesCatalogue(games),
    ]),
  );
}
