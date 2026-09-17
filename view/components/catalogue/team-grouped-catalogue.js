import { createPagedList } from './paged-list.js';
import { createTeamLogo } from '../media/entity-images.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';

export const CATALOGUE_PAGE_SIZE = {
  players: 10,
  lineups: 3,
};

export function createTeamBlockHeader(team, meta) {
  return h('header', { class: 'team-block__header' }, [
    createTeamLogo(team),
    h('a', { href: href.team(team.id) }, [
      h('div', { class: 'coord' }, ['Organization']),
      h('h2', { class: 'team-block__name' }, [team.name]),
    ]),
    h('div', { class: 'team-block__meta' }, [meta]),
  ]);
}

function groupPageEntries(entries) {
  const grouped = [];

  for (const entry of entries) {
    const last = grouped[grouped.length - 1];
    if (last && last.group === entry.group) last.items.push(entry.item);
    else grouped.push({ group: entry.group, items: [entry.item] });
  }

  return grouped;
}

function itemsFor(group, variant) {
  if (variant === 'lineups') return group.lineups ?? [];
  return group.players ?? [];
}

function renderPageItems({ group, items, variant, renderItem, renderItems }) {
  if (typeof renderItem === 'function') return items.map((item) => renderItem(item, group));
  if (typeof renderItems === 'function') {
    const pageGroup =
      variant === 'lineups' ? { ...group, lineups: items } : { ...group, players: items };
    return renderItems(pageGroup);
  }
  return [];
}

export function createTeamGroupedCatalogue({
  groups,
  variant = 'players',
  getItems,
  renderItem,
  renderItems,
  pageSize = CATALOGUE_PAGE_SIZE[variant] ?? CATALOGUE_PAGE_SIZE.players,
}) {
  const resolveItems = typeof getItems === 'function' ? getItems : (group) => itemsFor(group, variant);
  const entries = groups.flatMap((group) => resolveItems(group).map((item) => ({ group, item })));

  return createPagedList({
    items: entries,
    pageSize,
    listClass: 'catalogue',
    renderPage: (pageEntries) =>
      groupPageEntries(pageEntries).map(({ group, items }) =>
        h('section', { class: `team-block team-block--${variant}` }, [
          createTeamBlockHeader(group.team, group.meta),
          h(
            'div',
            { class: 'team-block__items' },
            renderPageItems({ group, items, variant, renderItem, renderItems }),
          ),
        ]),
      ),
  });
}
