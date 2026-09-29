import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { trackUi } from '../../utils/track.js';

export const GAME_PAGE_SIZE = 10;

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
  const pager = h('nav', { class: 'pager', 'aria-label': t('nav.pages') });
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
              'aria-label': t('nav.page', { number }),
              'aria-current': current ? 'page' : undefined,
              onClick: () => {
                if (page === number) return;
                page = number;
                trackUi({
                  event_name: 'click',
                  target_type: 'catalogue_pager',
                  target_id: number,
                });
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
