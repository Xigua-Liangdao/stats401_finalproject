import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';

export function createBreadcrumbs(items) {
  const nodes = [];
  items.forEach((item, index) => {
    if (index > 0) nodes.push(h('span', { class: 'sep' }, ['/']));
    if (item.href) nodes.push(h('a', { href: item.href }, [item.label]));
    else nodes.push(h('span', {}, [item.label]));
  });
  return h('nav', { class: 'breadcrumbs', 'aria-label': 'Breadcrumb' }, nodes);
}

export function createPageShell({ kicker, title, meta = [], actions = [], breadcrumbs = [], children }) {
  return h('div', { class: 'page' }, [
    breadcrumbs.length ? createBreadcrumbs(breadcrumbs) : null,
    h('header', { class: 'page-shell__header' }, [
      h('div', {}, [
        kicker ? h('div', { class: 'kicker' }, [kicker]) : null,
        h('h1', { class: 'page-shell__title display' }, [title]),
        meta.length ? h('div', { class: 'page-shell__meta' }, meta.map((item) => h('span', {}, [item]))) : null,
      ]),
      actions.length ? h('div', { class: 'page-shell__actions' }, actions) : null,
    ]),
    children,
  ]);
}

export function homeCrumbs() {
  return [{ label: 'Home', href: href.home }];
}
