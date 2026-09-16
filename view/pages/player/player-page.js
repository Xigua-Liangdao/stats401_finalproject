import { createButton } from '../../components/buttons/button.js';
import { createIdentityHeader, roleFact, teamFact } from '../../components/cards/identity-header.js';
import { createBreadcrumbs } from '../../components/layout/page-shell.js';
import { renderPlayerStats } from '../../features/player/player-stats.js';
import { loadPlayer } from '../../features/player/player-data.js';
import { loadPlayerGames } from '../../features/player-games/player-games-data.js';
import { renderPlayerGamesCatalogue } from '../../features/player-games/player-games-catalogue.js';
import { openPairImpactDrawer } from '../../features/pair-impact/pair-impact-drawer.js';
import { TEST_STATS_NOTICE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { renderNotFound } from '../not-found.js';

export async function renderPlayerPage(target, id) {
  const player = await loadPlayer(id);
  if (!player) {
    renderNotFound(target);
    return;
  }

  const games = await loadPlayerGames(player.id);

  target.append(
    h('div', { class: 'page' }, [
      createBreadcrumbs([
        { label: 'Home', href: href.home },
        { label: 'Player catalogue', href: href.players },
        { label: player.name },
      ]),
      h('p', { class: 'notice' }, [TEST_STATS_NOTICE]),
      createIdentityHeader({
        kicker: 'Player file',
        title: player.name,
        mark: player.team.short,
        facts: [
          roleFact(player.role),
          teamFact(player.team),
          { label: 'Season', value: String(player.team.season) },
          { label: 'Split', value: player.team.split },
        ],
        actions: [
          createButton({
            label: 'Check Pair Impact',
            variant: 'accent',
            onClick: () =>
              openPairImpactDrawer({
                source: 'player',
                teamId: player.team.id,
                teamName: player.team.name,
                selectedPlayerIds: [player.id],
                selectedNames: [player.name],
              }),
          }),
        ],
      }),
      renderPlayerStats(player),
      renderPlayerGamesCatalogue(games),
    ]),
  );
}
