import { APP_KICKER, APP_NAME, DATASET_MODE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { createStatusChip } from '../layout/status-chip.js';

const LINKS = [
  { href: href.home, label: 'Home', names: ['home'] },
  { href: href.players, label: 'Player', names: ['players', 'player'] },
  { href: href.lineups, label: 'Lineup', names: ['lineups', 'lineup'] },
];

export function renderSiteHeader(target, routeName) {
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
      createStatusChip({ label: 'Live data', live: true, variant: 'live' }),
      createStatusChip({ label: DATASET_MODE, variant: 'mock' }),
    ]),
  );
}
