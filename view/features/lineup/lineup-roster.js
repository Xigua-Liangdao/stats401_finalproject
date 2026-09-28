import { createRosterSlot } from '../../components/catalogue/roster-slot.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';

export function renderLineupRoster(players) {
  return createSectionBlock({
    index: t('lineup.composition'),
    title: t('common.players'),
    meta: t('lineup.slots', { count: players.length }),
    children: h(
      'div',
      { class: 'lineup-roster' },
      players.map((player) => createRosterSlot(player)),
    ),
  });
}
