import { createPagedList } from './paged-list.js?v=catalogue-back';
import { createTeamLogo } from '../media/entity-images.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { href } from '../../utils/navigation.js';
import { groupMatches } from '../../utils/search-text.js';
import { trackUi } from '../../utils/track.js';

export const CATALOGUE_PAGE_SIZE = {
  players: 100,
  lineups: 50,
};

export function createTeamBlockHeader(team, meta) {
  return h('header', { class: 'team-block__header' }, [
    createTeamLogo(team),
    h('a', {
      href: href.team(team.id),
      onClick: () => trackUi({
        event_name: 'click',
        target_type: 'team_link',
        target_id: team.id,
      }),
    }, [
      h('div', { class: 'coord' }, [t('common.organization')]),
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

function renderGroupedList({
  groups,
  variant,
  getItems,
  renderItem,
  renderItems,
  pageSize,
  initialPage,
  onPageChange,
}) {
  const resolveItems = typeof getItems === 'function' ? getItems : (group) => itemsFor(group, variant);
  const entries = groups.flatMap((group) => resolveItems(group).map((item) => ({ group, item })));

  return createPagedList({
    items: entries,
    pageSize,
    initialPage,
    onPageChange,
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


export function createTeamGroupedCatalogue({
  groups,
  variant = 'players',
  getItems,
  renderItem,
  renderItems,
  pageSize = CATALOGUE_PAGE_SIZE[variant] ?? CATALOGUE_PAGE_SIZE.players,
  initialPage = 1,
  onPageChange,
}) {
  const host = h('div', { class: 'catalogue-results' });
  const input = h('input', {
    type: 'search',
    class: 'catalogue-team-search__input',
    placeholder: t('catalogue.searchTeam'),
    'aria-label': t('catalogue.searchTeam'),
  });
  let query = '';
  let filteredPage = 1;

  function paint() {
    const needle = query.trim().toLowerCase();
    const shown = needle ? groups.filter((group) => groupMatches(group, needle)) : groups;
    if (!shown.length) {
      host.replaceChildren(h('p', { class: 'empty-state' }, [t('catalogue.noTeams')]));
      return;
    }
    host.replaceChildren(renderGroupedList({
      groups: shown,
      variant,
      getItems,
      renderItem,
      renderItems,
      pageSize,
      initialPage: needle ? filteredPage : initialPage,
      onPageChange: needle
        ? (page) => {
          filteredPage = page;
        }
        : onPageChange,
    }));
  }

  input.addEventListener('focus', () => {
    trackUi({
      event_name: 'search_open',
      target_type: 'team_search',
      target_id: variant,
    });
  });
  input.addEventListener('input', () => {
    query = input.value;
    filteredPage = 1;
    paint();
  });
  paint();

  return {
    search: h('label', { class: 'catalogue-team-search' }, [
      h('span', { class: 'kicker' }, [t('common.team')]),
      input,
    ]),
    root: host,
  };
}
