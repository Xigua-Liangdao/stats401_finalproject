import { createButton } from '../../components/buttons/button.js';
import { createIdentityHeader, teamFact } from '../../components/cards/identity-header.js';
import { createTeamLogo } from '../../components/media/entity-images.js';
import { createBreadcrumbs } from '../../components/layout/page-shell.js';
import { loadLineup } from '../../features/lineup/lineup-data.js';
import { renderLineupRoster } from '../../features/lineup/lineup-roster.js';
import { renderLineupStats } from '../../features/lineup/lineup-stats.js';
import { loadLineupGames } from '../../features/lineup-games/lineup-games-data.js?v=game-stats';
import { renderLineupGamesCatalogue } from '../../features/lineup-games/lineup-games-catalogue.js?v=game-stats';
import { openPairImpactDrawer } from '../../features/pair-impact/pair-impact-drawer.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { backAction, href } from '../../utils/navigation.js?v=catalogue-back';
import { renderNotFound } from '../not-found.js';

export async function renderLineupPage(target, id) {
  const lineup = await loadLineup(id);
  if (!lineup) {
    renderNotFound(target);
    return;
  }

  const games = await loadLineupGames(lineup.id);
  const teamHref = href.team(lineup.team.id);
  const back = backAction(teamHref);

  target.append(
    h('div', { class: 'page' }, [
      createBreadcrumbs([
        { label: t('nav.home'), href: href.home },
        { label: t('nav.catalogue'), href: href.players },
        { label: lineup.team.name, href: teamHref },
        { label: lineup.name },
      ]),
      createIdentityHeader({
        kicker: t('lineup.file'),
        title: lineup.name,
        mark: createTeamLogo(lineup.team),
        facts: [
          teamFact(lineup.team),
          { label: t('common.context'), value: lineup.context },
          { label: t('common.season'), value: String(lineup.team.season) },
        ],
        actions: [
          createButton({
            label: back.label,
            href: back.href,
          }),
          createButton({
            label: t('player.pairImpact'),
            variant: 'accent',
            onClick: () =>
              openPairImpactDrawer({
                lineupId: lineup.id,
                teamName: lineup.team.name,
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
