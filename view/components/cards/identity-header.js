import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { formatRole } from '../../utils/formatting.js';

function asIdentityMark(mark) {
  if (!mark) return null;
  if (mark.nodeType) {
    if (
      mark.classList?.contains('identity-mark') ||
      mark.classList?.contains('player-portrait')
    ) {
      return mark;
    }
    return h('div', { class: 'identity-mark' }, [mark]);
  }
  return h('div', { class: 'identity-mark' }, [mark]);
}

export function createIdentityHeader({
  kicker,
  title,
  mark,
  facts = [],
  actions = [],
}) {
  const isPlayer = mark?.classList?.contains('player-portrait');
  return h('header', { class: isPlayer ? 'identity-header identity-header--player panel' : 'identity-header panel' }, [
    asIdentityMark(mark),
    h('div', {}, [
      h('div', { class: 'kicker' }, [kicker]),
      h('h1', { class: 'display' }, [title]),
      h(
        'div',
        { class: 'identity-facts' },
        facts.map((fact) => {
          if (fact.href) {
            return h('span', {}, [fact.label ? `${fact.label}: ` : null, h('a', { href: fact.href }, [fact.value])]);
          }
          return h('span', {}, [fact.label ? `${fact.label}: ${fact.value}` : fact.value]);
        }),
      ),
    ]),
    actions.length ? h('div', { class: 'page-shell__actions' }, actions) : null,
  ]);
}

export function teamFact(team) {
  return { label: 'Team', value: team.name, href: href.team(team.id) };
}

export function roleFact(role) {
  return { label: 'Role', value: formatRole(role) };
}
