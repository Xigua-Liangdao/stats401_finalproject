import { createButton } from '../../components/buttons/button.js';
import { createIdentityHeader, teamFact } from '../../components/cards/identity-header.js';
import { createBreadcrumbs } from '../../components/layout/page-shell.js';
import { loadLineup } from '../../features/lineup/lineup-data.js';
import { renderLineupRoster } from '../../features/lineup/lineup-roster.js';
import { renderLineupStats } from '../../features/lineup/lineup-stats.js';
import { loadLineupGames } from '../../features/lineup-games/lineup-games-data.js';
import { renderLineupGamesCatalogue } from '../../features/lineup-games/lineup-games-catalogue.js';
import { openPairImpactDrawer } from '../../features/pair-impact/pair-impact-drawer.js';
import { MOCK_NOTICE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { renderNotFound } from '../not-found.js';

export async function renderLineupPage(target, id) {
  const lineup = await loadLineup(id);
  if (!lineup) {
    renderNotFound(target);
    return;
  }

  const games = await loadLineupGames(lineup.id);

  target.append(
    h('div', { class: 'page' }, [
      createBreadcrumbs([
        { label: 'Home', href: href.home },
        { label: 'Lineup catalogue', href: href.lineups },
        { label: lineup.name },
      ]),
      h('p', { class: 'notice' }, [MOCK_NOTICE]),
      createIdentityHeader({
        kicker: 'Lineup file',
        title: lineup.name,
        mark: lineup.team.short,
        facts: [
          teamFact(lineup.team),
          { label: 'Context', value: lineup.context },
          { label: 'Season', value: String(lineup.team.season) },
        ],
        actions: [
          createButton({
            label: 'Check Pair Impact',
            variant: 'accent',
            onClick: () =>
              openPairImpactDrawer({
                source: 'lineup',
                teamName: lineup.team.name,
                selectedPlayerIds: lineup.players.map((player) => player.id),
                selectedNames: lineup.players.map((player) => player.name),
              }),
          }),
        ],
      }),
      renderLineupRoster(lineup.players),
      renderLineupStats(),
      renderLineupGamesCatalogue(games),
    ]),
  );
}
