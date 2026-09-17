import { createPlayerPortrait } from '../media/entity-images.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { formatRole } from '../../utils/formatting.js';

export function createRosterSlot(player) {
  return h('a', { class: 'roster-slot', href: href.player(player.id) }, [
    h('div', { class: 'roster-slot__role' }, [formatRole(player.role)]),
    createPlayerPortrait(player),
    h('div', { class: 'roster-slot__name' }, [player.name]),
    h('div', { class: 'roster-slot__open' }, ['Open file →']),
  ]);
}

export function createMiniSlot(player) {
  return h('div', { class: 'mini-slot' }, [
    h('span', {}, [formatRole(player.role)]),
    createPlayerPortrait(player, { variant: 'mini' }),
    h('strong', {}, [player.name]),
  ]);
}
