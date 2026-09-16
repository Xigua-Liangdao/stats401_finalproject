import { createMiniSlot } from '../../components/catalogue/roster-slot.js';
import { createTeamGroupedCatalogue } from '../../components/catalogue/team-grouped-catalogue.js';
import { createPageShell } from '../../components/layout/page-shell.js';
import { loadLineupCatalog } from '../../features/lineup/lineup-data.js';
import { MOCK_NOTICE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';

export async function renderLineupCataloguePage(target) {
  const groups = await loadLineupCatalog();

  target.append(
    createPageShell({
      kicker: '02 / Lineup catalogue',
      title: 'Lineups',
      meta: ['Grouped by team', 'Composition ≠ organization'],
      breadcrumbs: [
        { label: 'Home', href: href.home },
        { label: 'Lineup catalogue' },
      ],
      children: h('div', {}, [
        h('p', { class: 'notice' }, [MOCK_NOTICE]),
        createTeamGroupedCatalogue({
          variant: 'lineups',
          groups: groups.map((group) => ({
            ...group,
            meta: `${String(group.lineups.length).padStart(2, '0')} lineups`,
          })),
          renderItems: (group) =>
            group.lineups.map((lineup) =>
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
            ),
        }),
      ]),
    }),
  );
}
