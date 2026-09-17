import { createMiniSlot } from '../../components/catalogue/roster-slot.js';
import { createTeamGroupedCatalogue } from '../../components/catalogue/team-grouped-catalogue.js?v=catalogue-back';
import { createPageShell } from '../../components/layout/page-shell.js';
import { loadLineupCatalog } from '../../features/lineup/lineup-data.js';
import { h } from '../../utils/dom.js';
import { href, rememberCataloguePage } from '../../utils/navigation.js?v=catalogue-back';

export async function renderLineupCataloguePage(target, page = 1) {
  const groups = await loadLineupCatalog();
  const onPageChange = rememberCataloguePage('lineups', page);

  target.append(
    createPageShell({
      kicker: '02 / Lineup catalogue',
      title: 'Lineups',
      meta: ['Grouped by team', 'Composition ≠ organization'],
      breadcrumbs: [
        { label: 'Home', href: href.home },
        { label: 'Lineup catalogue' },
      ],
      children: createTeamGroupedCatalogue({
        variant: 'lineups',
        initialPage: page,
        onPageChange,
        groups: groups.map((group) => ({
          ...group,
          meta: `${String(group.lineups.length).padStart(2, '0')} lineups`,
        })),
        getItems: (group) => group.lineups,
        renderItem: (lineup) =>
          h('a', { class: 'lineup-strip', href: href.lineup(lineup.id) }, [
            h('div', { class: 'lineup-strip__top' }, [
              h('div', { class: 'lineup-strip__name' }, [lineup.name]),
              h('div', { class: 'coord' }, [lineup.context, ' · Open file →']),
            ]),
            h(
              'div',
              { class: 'lineup-strip__slots' },
              lineup.players.map((player) => createMiniSlot(player)),
            ),
          ]),
      }),
    }),
  );
}
