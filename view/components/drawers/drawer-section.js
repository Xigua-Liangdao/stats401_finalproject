import { h } from '../../utils/dom.js';

export function createDrawerHeader({ kicker, title }) {
  return h('div', {}, [
    h('div', { class: 'kicker' }, [kicker]),
    h('h2', {}, [title]),
  ]);
}

export function createDrawerSection({ title, children }) {
  return h('section', { class: 'drawer-section' }, [
    title ? h('h3', {}, [title]) : null,
    children,
  ]);
}

export function createMetaGrid(cells) {
  return h(
    'div',
    { class: 'meta-grid' },
    cells.map((cell) =>
      h('div', { class: 'meta-cell' }, [
        h('span', {}, [cell.label]),
        h('strong', {}, [cell.value]),
      ]),
    ),
  );
}
