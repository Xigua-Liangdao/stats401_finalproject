import { h } from '../../utils/dom.js';

export const GAME_PAGE_SIZE = 5;

export function createPagedList({ items, pageSize = GAME_PAGE_SIZE, renderItem }) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  let page = 1;

  const list = h('div', { class: 'paged-list__items' });
  const pager = h('nav', { class: 'pager', 'aria-label': 'Pages' });
  const root = h('div', { class: 'paged-list' }, [list, pager]);

  function render() {
    const start = (page - 1) * pageSize;
    list.replaceChildren(
      ...items.slice(start, start + pageSize).map((item) => renderItem(item)),
    );
    pager.replaceChildren(
      ...Array.from({ length: pageCount }, (_, index) => {
        const number = index + 1;
        const current = number === page;
        return h(
          'button',
          {
            class: current ? 'pager__page is-current' : 'pager__page',
            type: 'button',
            'aria-label': `Page ${number}`,
            'aria-current': current ? 'page' : undefined,
            onClick: () => {
              if (page === number) return;
              page = number;
              render();
            },
          },
          [String(number)],
        );
      }),
    );
  }

  render();
  return root;
}
