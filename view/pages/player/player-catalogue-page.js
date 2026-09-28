import { createRosterSlot } from '../../components/catalogue/roster-slot.js';
import { createTeamGroupedCatalogue } from '../../components/catalogue/team-grouped-catalogue.js?v=catalogue-back';
import { createPageShell } from '../../components/layout/page-shell.js';
import { loadPlayerCatalog } from '../../features/player/player-data.js';
import { indexed, t } from '../../utils/i18n.js';
import { href, rememberCataloguePage } from '../../utils/navigation.js?v=catalogue-back';

export async function renderPlayerCataloguePage(target, page = 1) {
  const groups = await loadPlayerCatalog();
  const onPageChange = rememberCataloguePage('players', page);

  const catalogue = createTeamGroupedCatalogue({
    variant: 'players',
    initialPage: page,
    onPageChange,
    groups: groups.map((group) => ({
      ...group,
      meta: t('catalogue.players', { count: String(group.players.length).padStart(2, '0') }),
    })),
    getItems: (group) => group.players,
    renderItem: (player) => createRosterSlot(player),
  });

  target.append(
    createPageShell({
      kicker: indexed('01', t('nav.catalogue')),
      title: t('nav.catalogue'),
      meta: [t('catalogue.grouped')],
      actions: [catalogue.search],
      breadcrumbs: [
        { label: t('nav.home'), href: href.home },
        { label: t('nav.catalogue') },
      ],
      children: catalogue.root,
    }),
  );
}
