import { createPlayerPortrait } from '../media/entity-images.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { formatRole } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { trackUi } from '../../utils/track.js';

export function createRosterSlot(player) {
  return h('a', {
    class: 'roster-slot',
    href: href.player(player.id, player.teamId, player.season),
    onClick: () => trackUi({
      event_name: 'click',
      target_type: 'player_card',
      target_id: player.id,
    }),
  }, [
    h('div', { class: 'roster-slot__role' }, [formatRole(player.role)]),
    createPlayerPortrait(player),
    h('div', { class: 'roster-slot__name' }, [player.name]),
    h('div', { class: 'roster-slot__open' }, [t('nav.openFile')]),
  ]);
}

export function createMiniSlot(player) {
  return h('div', { class: 'mini-slot' }, [
    h('span', {}, [formatRole(player.role)]),
    createPlayerPortrait(player, { variant: 'mini' }),
    h('strong', {}, [player.name]),
  ]);
}
