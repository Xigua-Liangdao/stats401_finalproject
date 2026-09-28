import { DATASET_MODE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { href } from '../../utils/navigation.js';
import { createStatusChip } from '../layout/status-chip.js';

const LINKS = [
  { href: href.home, key: 'nav.home', names: ['home'] },
  { href: href.players, key: 'nav.catalogue', names: ['players', 'player', 'team'] },
  { href: href.compare, key: 'nav.comparison', names: ['compare'] },
];

function createSeasonSelect({ seasons = [], season, onSeasonChange }) {
  const options = seasons.length ? seasons : [season].filter((value) => value != null);
  return h('select', {
    class: 'season-select',
    'aria-label': t('nav.season'),
    onchange: (event) => onSeasonChange?.(event.target.value),
  }, options.map((value) => h('option', {
    value: String(value),
    selected: String(value) === String(season),
  }, [String(value)])));
}

export function renderSiteHeader(target, routeName, { seasons = [], season, onSeasonChange } = {}) {
  target.replaceChildren(
    h('div', { class: 'site-header__brand' }, [
      h('span', { class: 'coord' }, [t('app.kicker')]),
      h('a', { class: 'site-header__brand-name', href: href.home }, [t('app.name')]),
    ]),
    h(
      'nav',
      { class: 'site-nav', 'aria-label': t('nav.primary') },
      LINKS.map((link) =>
        h(
          'a',
          {
            href: link.href,
            class: link.names.includes(routeName) ? 'is-active' : '',
          },
          [t(link.key)],
        ),
      ),
    ),
    h('div', { class: 'site-header__status' }, [
      createSeasonSelect({ seasons, season, onSeasonChange }),
      createStatusChip({ label: DATASET_MODE, variant: 'mock' }),
    ]),
  );
}
