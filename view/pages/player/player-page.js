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
import { t } from '../../utils/i18n.js';
import { backAction, href, readCataloguePage } from '../../utils/navigation.js?v=catalogue-back';
import { routeTargetId, trackUi } from '../../utils/track.js';
import { renderNotFound } from '../not-found.js';

async function openPlayerPairImpact(player) {
  await openPairImpactDrawer({
    teamId: player.team.id,
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
        { label: t('nav.home'), href: href.home },
        { label: t('nav.catalogue'), href: catalogueHref },
        { label: player.name },
      ]),
      createIdentityHeader({
        kicker: t('player.file'),
        title: player.name,
        mark: createPlayerPortrait(player, { variant: 'hero' }),
        facts: [
          roleFact(player.role),
          teamFact(player.team),
          { label: t('common.season'), value: String(player.team.season) },
          { label: t('common.split'), value: player.team.split },
        ],
        actions: [
          createButton({
            label: back.label,
            href: back.href,
            track: {
              event_name: 'click',
              target_type: 'nav_link',
              target_id: routeTargetId(back.href),
            },
          }),
          createButton({
            label: t('player.pairImpact'),
            variant: 'accent',
            onClick: () => {
              trackUi({
                event_name: 'click',
                target_type: 'pair_impact_button',
                target_id: player.id,
              });
              openPlayerPairImpact(player);
            },
          }),
        ],
      }),
      renderPlayerStats(player, games, players),
      renderPlayerGamesCatalogue(games),
    ]),
  );
}
