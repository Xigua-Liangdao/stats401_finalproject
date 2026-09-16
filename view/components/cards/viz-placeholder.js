import { h } from '../../utils/dom.js';

export function createVizPlaceholder({ index, title, description, vizId }) {
  return h('article', { class: 'viz-placeholder panel', dataset: { viz: vizId } }, [
    h('div', { class: 'viz-placeholder__chrome' }, [
      h('span', {}, [index]),
      h('span', {}, [title]),
    ]),
    h('div', { class: 'viz-stage', 'aria-hidden': 'true' }),
    h('p', { class: 'viz-placeholder__desc' }, [description]),
  ]);
}

export function createVizGrid(items) {
  return h(
    'div',
    { class: 'viz-grid' },
    items.map((item) => createVizPlaceholder(item)),
  );
}
