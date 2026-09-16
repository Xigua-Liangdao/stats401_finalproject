import { createRosterSlot } from '../../components/catalogue/roster-slot.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';

export function renderLineupRoster(players) {
  return createSectionBlock({
    index: '01 / Composition',
    title: 'Players',
    meta: `${players.length} slots`,
    children: h(
      'div',
      { class: 'team-block__items', style: { padding: 0, display: 'grid' } },
      players.map((player) => createRosterSlot(player)),
    ),
  });
}
