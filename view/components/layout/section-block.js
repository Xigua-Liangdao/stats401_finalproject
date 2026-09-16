import { h } from '../../utils/dom.js';

export function createSectionBlock({ index, title, meta, children }) {
  return h('section', { class: 'section-block' }, [
    h('div', { class: 'section-block__head' }, [
      h('div', {}, [
        index ? h('div', { class: 'kicker' }, [index]) : null,
        h('h2', { class: 'section-block__title' }, [title]),
      ]),
      meta ? h('div', { class: 'coord' }, [meta]) : null,
    ]),
    children,
  ]);
}
