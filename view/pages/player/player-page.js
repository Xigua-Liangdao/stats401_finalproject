import { createButton } from '../../components/buttons/button.js';
import { createIdentityHeader, roleFact, teamFact } from '../../components/cards/identity-header.js';
import { createPlayerPortrait } from '../../components/media/entity-images.js';
import { createBreadcrumbs } from '../../components/layout/page-shell.js';
import { renderPlayerStats } from '../../features/player/player-stats.js?v=scale-zoom';
import { loadPlayer, loadPlayerCatalog } from '../../features/player/player-data.js';
import { loadPlayerGames } from '../../features/player-games/player-games-data.js?v=game-stats';
import { renderPlayerGamesCatalogue } from '../../features/player-games/player-games-catalogue.js?v=game-stats';
import { openPairImpactDrawer } from '../../features/pair-impact/pair-impact-drawer.js';
import { h } from '../../utils/dom.js';
import { dataSource } from '../../utils/data-source.js';
import { backAction, href, readCataloguePage } from '../../utils/navigation.js?v=catalogue-back';
import { renderNotFound } from '../not-found.js';

async function openPlayerPairImpact(player) {
  const lineups = await dataSource.listTeamLineups(player.team.id);
  const lineup = lineups
    .filter((item) => item.playerIds.includes(player.id))
    .sort((a, b) => (b.stats?.n_games ?? -1) - (a.stats?.n_games ?? -1))[0];
  if (!lineup) return;
  await openPairImpactDrawer({
    lineupId: lineup.id,
    teamName: player.team.name,
    selectedIds: [player.id],
  });
}

export async function renderPlayerPage(target, id, teamId, season) {
  const [player, groups] = await Promise.all([loadPlayer(id, teamId, season), loadPlayerCatalog()]);
  if (!player) {
    renderNotFound(target);
    return;
  }

  const games = await loadPlayerGames(player.id);
  const players = groups.flatMap((group) => group.players);

  const catalogueHref = href.playersAt(readCataloguePage('players'));
  const back = backAction(catalogueHref);

  target.append(
    h('div', { class: 'page' }, [
      createBreadcrumbs([
        { label: 'Home', href: href.home },
        { label: 'Catalogue', href: catalogueHref },
        { label: player.name },
      ]),
      createIdentityHeader({
        kicker: 'Player file',
        title: player.name,
        mark: createPlayerPortrait(player, { variant: 'hero' }),
        facts: [
          roleFact(player.role),
          teamFact(player.team),
          { label: 'Season', value: String(player.team.season) },
          { label: 'Split', value: player.team.split },
        ],
        actions: [
          createButton({
            label: back.label,
            href: back.href,
          }),
          createButton({
            label: 'Check Pair Impact',
            variant: 'accent',
            onClick: () => openPlayerPairImpact(player),
          }),
        ],
      }),
      renderPlayerStats(player, games, players),
      renderPlayerGamesCatalogue(games),
    ]),
  );
}
