import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';

function reportPage(targetType, id) {
  import('../../utils/track.js')
    .then(({ trackUi }) => trackUi({
      event_name: 'click',
      target_type: targetType,
      target_id: id,
    }))
    .catch((error) => console.error('[Analytics] trackEvent failed:', error));
}

export const GAME_PAGE_SIZE = 10;
const PAGER_RADIUS = 2;

export function pageMarks(page, pageCount, radius = PAGER_RADIUS) {
  const count = Math.max(1, pageCount);
  if (count <= radius * 2 + 1) return Array.from({ length: count }, (_, index) => index + 1);
  const current = Math.min(count, Math.max(1, page));
  const start = Math.max(1, current - radius);
  const end = Math.min(count, current + radius);
  const numbers = new Set([1, count]);
  for (let number = start; number <= end; number += 1) numbers.add(number);
  const sorted = [...numbers].sort((a, b) => a - b);
  const marks = [];
  sorted.forEach((number, index) => {
    if (index > 0 && number - sorted[index - 1] > 1) marks.push('ellipsis');
    marks.push(number);
  });
  return marks;
}

export function fillPager(pager, { page, pageCount, onPage, targetType = 'catalogue_pager' }) {
  if (pageCount <= 1) {
    pager.replaceChildren();
    pager.hidden = true;
    return;
  }
  pager.hidden = false;
  const needsJump = pageCount > PAGER_RADIUS * 2 + 1;
  const extras = [];

  if (needsJump) {
    const jump = h('input', {
      class: 'pager__jump',
      type: 'text',
      inputmode: 'numeric',
      maxlength: String(pageCount).length,
      value: '',
      'aria-label': t('nav.pageJump'),
    });
    const go = () => {
      const raw = jump.value.trim();
      if (!raw) return;
      const next = Number(raw);
      jump.value = '';
      if (!Number.isInteger(next)) return;
      const target = Math.min(pageCount, Math.max(1, next));
      if (target === page) return;
      reportPage(targetType, target);
      onPage(target);
    };
    jump.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      go();
    });
    jump.addEventListener('change', go);
    extras.push(
      h('span', { class: 'pager__go' }, [t('nav.pageGo')]),
      jump,
      h('span', { class: 'pager__count' }, [`/ ${t('nav.pageCount', { count: pageCount })}`]),
    );
  }

  pager.replaceChildren(
    ...pageMarks(page, pageCount).map((mark) => {
      if (mark === 'ellipsis') {
        return h('span', { class: 'pager__ellipsis', 'aria-hidden': 'true' }, ['…']);
      }
      return h('button', {
        class: mark === page ? 'pager__page is-current' : 'pager__page',
        type: 'button',
        'aria-label': t('nav.page', { number: mark }),
        'aria-current': mark === page ? 'page' : undefined,
        onClick: () => {
          if (mark === page) return;
          reportPage(targetType, mark);
          onPage(mark);
        },
      }, [String(mark)]);
    }),
    ...extras,
  );
}

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

    fillPager(pager, {
      page,
      pageCount,
      targetType: 'catalogue_pager',
      onPage: (number) => {
        page = number;
        onPageChange?.(page);
        render();
      },
    });

    if (hasRendered) root.scrollIntoView({ block: 'start' });
    hasRendered = true;
  }

  render();
  return root;
}
