import { createRosterSlot } from '../../components/catalogue/roster-slot.js';
import { createTeamGroupedCatalogue } from '../../components/catalogue/team-grouped-catalogue.js?v=catalogue-back';
import { createPageShell } from '../../components/layout/page-shell.js';
import { loadPlayerCatalog } from '../../features/player/player-data.js';
import { href, rememberCataloguePage } from '../../utils/navigation.js?v=catalogue-back';

export async function renderPlayerCataloguePage(target, page = 1) {
  const groups = await loadPlayerCatalog();
  const onPageChange = rememberCataloguePage('players', page);

  target.append(
    createPageShell({
      kicker: '01 / Player catalogue',
      title: 'Players',
      meta: ['Grouped by team'],
      breadcrumbs: [
        { label: 'Home', href: href.home },
        { label: 'Player catalogue' },
      ],
      children: createTeamGroupedCatalogue({
        variant: 'players',
        initialPage: page,
        onPageChange,
        groups: groups.map((group) => ({
          ...group,
          meta: `${String(group.players.length).padStart(2, '0')} players`,
        })),
        getItems: (group) => group.players,
        renderItem: (player) => createRosterSlot(player),
      }),
    }),
  );
}
