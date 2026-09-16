import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';

export function createTeamBlockHeader(team, meta) {
  return h('header', { class: 'team-block__header' }, [
    h('div', { class: 'identity-mark' }, [team.short]),
    h('a', { href: href.team(team.id) }, [
      h('div', { class: 'coord' }, ['Organization']),
      h('h2', { class: 'team-block__name' }, [team.name]),
    ]),
    h('div', { class: 'team-block__meta' }, [meta]),
  ]);
}

export function createTeamGroupedCatalogue({ groups, variant = 'players', renderItems }) {
  return h(
    'div',
    { class: 'catalogue' },
    groups.map((group) =>
      h('section', { class: `team-block team-block--${variant}` }, [
        createTeamBlockHeader(group.team, group.meta),
        h('div', { class: 'team-block__items' }, renderItems(group)),
      ]),
    ),
  );
}
