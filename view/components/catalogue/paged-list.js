import { h } from '../../utils/dom.js';

export const GAME_PAGE_SIZE = 5;

export function createPagedList({
  items,
  pageSize = GAME_PAGE_SIZE,
  initialPage = 1,
  onPageChange,
  renderItem,
  renderPage,
  listClass = 'paged-list__items',
}) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  let page = Math.min(pageCount, Math.max(1, initialPage));
  let hasRendered = false;

  const list = h('div', { class: listClass });
  const pager = h('nav', { class: 'pager', 'aria-label': 'Pages' });
  const root = h('div', { class: 'paged-list' }, [list, pager]);

  function render() {
    const start = (page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    const nodes = renderPage ? renderPage(slice) : slice.map((item) => renderItem(item));
    list.replaceChildren(...[].concat(nodes ?? []));

    if (pageCount <= 1) {
      pager.replaceChildren();
      pager.hidden = true;
    } else {
      pager.hidden = false;
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
                onPageChange?.(page);
                render();
              },
            },
            [String(number)],
          );
        }),
      );
    }

    if (hasRendered) root.scrollIntoView({ block: 'start' });
    hasRendered = true;
  }

  render();
  return root;
}
