import { APP_KICKER, APP_NAME, DATASET_MODE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { createStatusChip } from '../layout/status-chip.js';

const LINKS = [
  { href: href.home, label: 'Home', names: ['home'] },
  { href: href.players, label: 'Catalogue', names: ['players', 'player', 'team'] },
  { href: href.compare, label: 'Comparison', names: ['compare'] },
];

function createSeasonSelect({ seasons = [], season, onSeasonChange }) {
  const options = seasons.length ? seasons : [season].filter((value) => value != null);
  return h('select', {
    class: 'season-select',
    'aria-label': 'Season',
    onchange: (event) => onSeasonChange?.(event.target.value),
  }, options.map((value) => h('option', {
    value: String(value),
    selected: String(value) === String(season),
  }, [String(value)])));
}

export function renderSiteHeader(target, routeName, { seasons = [], season, onSeasonChange } = {}) {
  target.replaceChildren(
    h('div', { class: 'site-header__brand' }, [
      h('span', { class: 'coord' }, [APP_KICKER]),
      h('a', { class: 'site-header__brand-name', href: href.home }, [APP_NAME]),
    ]),
    h(
      'nav',
      { class: 'site-nav', 'aria-label': 'Primary' },
      LINKS.map((link) =>
        h(
          'a',
          {
            href: link.href,
            class: link.names.includes(routeName) ? 'is-active' : '',
          },
          [link.label],
        ),
      ),
    ),
    h('div', { class: 'site-header__status' }, [
      createSeasonSelect({ seasons, season, onSeasonChange }),
      createStatusChip({ label: DATASET_MODE, variant: 'mock' }),
    ]),
  );
}
