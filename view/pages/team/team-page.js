import { createButton } from '../../components/buttons/button.js';
import { createIdentityHeader } from '../../components/cards/identity-header.js';
import { createTeamLogo } from '../../components/media/entity-images.js';
import { createBreadcrumbs } from '../../components/layout/page-shell.js';
import { loadTeam, loadTeamLineups, loadTeamPlayerGames, loadTeamPlayers } from '../../features/team/team-data.js';
import { renderTeamLineups, renderTeamPlayers } from '../../features/team/team-rosters.js';
import { renderTeamStages, renderTeamStats } from '../../features/team/team-stats.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { backAction, href, readCataloguePage } from '../../utils/navigation.js?v=catalogue-back';
import { renderNotFound } from '../not-found.js';

export async function renderTeamPage(target, id) {
  const team = await loadTeam(id);
  if (!team) {
    renderNotFound(target);
    return;
  }

  const [players, lineups, games] = await Promise.all([
    loadTeamPlayers(team.id),
    loadTeamLineups(team.id),
    loadTeamPlayerGames(team.id),
  ]);

  const catalogueHref = href.playersAt(readCataloguePage('players'));
  const back = backAction(catalogueHref);

  target.append(
    h('div', { class: 'page' }, [
      createBreadcrumbs([
        { label: t('nav.home'), href: href.home },
        { label: t('nav.catalogue'), href: catalogueHref },
        { label: team.name },
      ]),
      createIdentityHeader({
        kicker: t('common.organization'),
        title: team.name,
        mark: createTeamLogo(team),
        facts: [
          { label: t('common.season'), value: String(team.season) },
          { label: t('common.split'), value: team.split },
          { label: t('common.players'), value: String(players.length) },
          { label: t('common.lineups'), value: String(lineups.length) },
        ],
        actions: [
          createButton({
            label: back.label,
            href: back.href,
          }),
        ],
      }),
      renderTeamPlayers(players),
      renderTeamStats({ team, playerCount: players.length, lineupCount: lineups.length }),
      renderTeamLineups(lineups),
      renderTeamStages({ team, players, games }),
    ]),
  );
}
