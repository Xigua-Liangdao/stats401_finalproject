import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { formatRole } from '../../utils/formatting.js';

export function createIdentityHeader({
  kicker,
  title,
  mark,
  facts = [],
  actions = [],
}) {
  return h('header', { class: 'identity-header panel' }, [
    mark ? h('div', { class: 'identity-mark' }, [mark]) : null,
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
