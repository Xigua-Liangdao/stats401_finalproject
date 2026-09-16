import { createRosterSlot } from '../../components/catalogue/roster-slot.js';
import { createTeamGroupedCatalogue } from '../../components/catalogue/team-grouped-catalogue.js';
import { createPageShell } from '../../components/layout/page-shell.js';
import { loadPlayerCatalog } from '../../features/player/player-data.js';
import { href } from '../../utils/navigation.js';
import { MOCK_NOTICE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';

export async function renderPlayerCataloguePage(target) {
  const groups = await loadPlayerCatalog();

  target.append(
    createPageShell({
      kicker: '01 / Player catalogue',
      title: 'Players',
      meta: ['Grouped by team', 'Mock roster files'],
      breadcrumbs: [
        { label: 'Home', href: href.home },
        { label: 'Player catalogue' },
      ],
      children: h('div', {}, [
        h('p', { class: 'notice' }, [MOCK_NOTICE]),
        createTeamGroupedCatalogue({
          variant: 'players',
          groups: groups.map((group) => ({
            ...group,
            meta: `${String(group.players.length).padStart(2, '0')} players`,
          })),
          renderItems: (group) => group.players.map((player) => createRosterSlot(player)),
        }),
      ]),
    }),
  );
}
