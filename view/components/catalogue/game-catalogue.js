import { h } from '../../utils/dom.js';
import { parseGameDate } from '../../utils/formatting.js';
import { GAME_PAGE_SIZE } from './paged-list.js';
import { createGameRow } from './game-row.js';

const SPLIT_ORDER = ['Split 1', 'Split 2 Placements', 'Split 2', 'Split 3'];

function splitCompare(a, b) {
  const left = SPLIT_ORDER.indexOf(a);
  const right = SPLIT_ORDER.indexOf(b);
  if (left !== -1 || right !== -1) {
    return (left === -1 ? SPLIT_ORDER.length : left) - (right === -1 ? SPLIT_ORDER.length : right);
  }
  return String(a).localeCompare(String(b));
}

function uniqueSorted(values, compare) {
  return [...new Set(values.filter((value) => value != null && value !== ''))].sort(compare);
}

function headButton(className, onClick) {
  return h('button', { type: 'button', class: className, onClick });
}

export function createGameCatalogue({ games, onInfo, champion = false }) {
  const tbody = h('tbody');
  const pager = h('nav', { class: 'pager', 'aria-label': 'Pages' });
  const menu = h('div', { class: 'game-table__menu', role: 'menu', hidden: true });
  let page = 1;
  let dateOrder = 'desc';
  let split = '';
  let patch = '';
  let result = '';
  let openMenu = '';
  let dismissMenu = null;
  const columnCount = champion ? 6 : 5;
  const splits = uniqueSorted(games.map((game) => game.split), splitCompare);
  const patches = uniqueSorted(
    games.map((game) => game.patch),
    (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }),
  );

  const dateButton = headButton('game-table__sort', () => {
    closeMenu();
    dateOrder = dateOrder === 'desc' ? 'asc' : 'desc';
    page = 1;
    syncHeads();
    paint();
  });
  const splitButton = headButton('game-table__filter', () => {
    toggleFilter('split', splitButton, [
      { value: '', label: 'All' },
      ...splits.map((value) => ({ value, label: value })),
    ], split, (value) => { split = value; });
  });
  const patchButton = headButton('game-table__filter', () => {
    toggleFilter('patch', patchButton, [
      { value: '', label: 'All' },
      ...patches.map((value) => ({ value, label: value })),
    ], patch, (value) => { patch = value; });
  });
  const resultButton = headButton('game-table__filter', () => {
    toggleFilter('result', resultButton, [
      { value: '', label: 'All' },
      { value: 'win', label: 'W' },
      { value: 'loss', label: 'L' },
    ], result, (value) => { result = value; });
  });
  const dateHead = h('th', { scope: 'col', class: 'game-table__date' }, [dateButton]);

  function visibleGames() {
    const direction = dateOrder === 'asc' ? 1 : -1;
    return games
      .filter((game) => {
        if (split && game.split !== split) return false;
        if (patch && String(game.patch) !== patch) return false;
        if (result === 'win' && game.result !== 1) return false;
        if (result === 'loss' && game.result !== 0) return false;
        return true;
      })
      .slice()
      .sort((a, b) => {
        const left = parseGameDate(a.date)?.getTime() ?? 0;
        const right = parseGameDate(b.date)?.getTime() ?? 0;
        if (left !== right) return (left - right) * direction;
        return String(a.id).localeCompare(String(b.id));
      });
  }

  function paintMark(button, label, mark, active, open) {
    button.classList.toggle('is-active', active);
    button.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    button.replaceChildren(
      label,
      h('span', { class: 'game-table__caret', 'aria-hidden': 'true' }, [mark]),
    );
  }

  function syncHeads() {
    const newest = dateOrder !== 'asc';
    dateHead.setAttribute('aria-sort', newest ? 'descending' : 'ascending');
    dateButton.setAttribute('aria-label', newest ? 'Sort by date, newest first' : 'Sort by date, oldest first');
    dateButton.replaceChildren(
      'Date',
      h('span', { class: 'game-table__arrow', 'aria-hidden': 'true' }, [newest ? '↓' : '↑']),
    );
    splitButton.setAttribute('aria-label', split ? `Filter by split, ${split}` : 'Filter by split');
    patchButton.setAttribute('aria-label', patch ? `Filter by patch, ${patch}` : 'Filter by patch');
    resultButton.setAttribute(
      'aria-label',
      result === 'win' ? 'Filter by result, win' : result === 'loss' ? 'Filter by result, loss' : 'Filter by result',
    );
    paintMark(splitButton, 'Split', '▾', Boolean(split), openMenu === 'split');
    paintMark(patchButton, 'Patch', '▾', Boolean(patch), openMenu === 'patch');
    paintMark(resultButton, 'Result', '▾', Boolean(result), openMenu === 'result');
  }

  function placeMenu(button) {
    const host = catalogue.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const width = menu.offsetWidth;
    const maxLeft = Math.max(0, host.width - width);
    menu.style.left = `${Math.min(Math.max(0, rect.left - host.left), maxLeft)}px`;
    menu.style.top = `${rect.bottom - host.top + 6}px`;
  }

  function closeMenu() {
    if (!openMenu) return;
    openMenu = '';
    menu.hidden = true;
    menu.replaceChildren();
    dismissMenu?.();
    dismissMenu = null;
    syncHeads();
  }

  function toggleFilter(key, button, options, current, assign) {
    if (openMenu === key) {
      closeMenu();
      return;
    }
    if (openMenu) closeMenu();
    openMenu = key;
    menu.replaceChildren(...options.map((option) => h('button', {
      type: 'button',
      class: option.value === current ? 'game-table__option is-current' : 'game-table__option',
      role: 'menuitem',
      onClick: () => {
        assign(option.value);
        page = 1;
        closeMenu();
        paint();
      },
    }, [option.label])));
    menu.hidden = false;
    placeMenu(button);
    const onPointerDown = (event) => {
      if (menu.contains(event.target) || event.target.closest?.('.game-table__filter')) return;
      closeMenu();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    dismissMenu = () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    syncHeads();
  }

  function paintPager(pageCount) {
    if (pageCount <= 1) {
      pager.replaceChildren();
      pager.hidden = true;
      return;
    }
    pager.hidden = false;
    pager.replaceChildren(...Array.from({ length: pageCount }, (_, index) => {
      const number = index + 1;
      const current = number === page;
      return h('button', {
        class: current ? 'pager__page is-current' : 'pager__page',
        type: 'button',
        'aria-label': `Page ${number}`,
        'aria-current': current ? 'page' : undefined,
        onClick: () => {
          if (page === number) return;
          page = number;
          paint();
          table.scrollIntoView({ block: 'start' });
        },
      }, [String(number)]);
    }));
  }

  function paint() {
    const items = visibleGames();
    const pageCount = Math.max(1, Math.ceil(items.length / GAME_PAGE_SIZE));
    page = Math.min(page, pageCount);
    const start = (page - 1) * GAME_PAGE_SIZE;
    const slice = items.slice(start, start + GAME_PAGE_SIZE);
    tbody.replaceChildren(...(slice.length
      ? slice.map((game) => createGameRow({ game, onInfo, champion }))
      : [h('tr', {}, [
          h('td', { class: 'game-table__empty', colspan: String(columnCount) }, ['No games match these filters.']),
        ])]));
    paintPager(items.length ? pageCount : 1);
  }

  const table = h('table', { class: 'game-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        dateHead,
        h('th', { scope: 'col', class: 'game-table__split' }, [splitButton]),
        h('th', { scope: 'col', class: 'game-table__patch' }, [patchButton]),
        champion ? h('th', { scope: 'col', class: 'game-table__champion' }, [
          h('span', { class: 'game-table__label' }, ['Champion']),
        ]) : null,
        h('th', { scope: 'col', class: 'game-table__result' }, [resultButton]),
        h('th', { scope: 'col', class: 'game-table__info' }, [
          h('span', { class: 'game-table__label' }, ['Info']),
        ]),
      ]),
    ]),
    tbody,
  ]);
  const wrap = h('div', { class: 'game-table-wrap' }, [table]);
  const catalogue = h('div', { class: 'game-catalogue' }, [wrap, menu, pager]);

  wrap.addEventListener('scroll', () => closeMenu(), { passive: true });
  syncHeads();
  paint();
  return catalogue;
}
