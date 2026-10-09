import { DATASET_MODE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { currentLanguage, languageChoices, t } from '../../utils/i18n.js';
import { href } from '../../utils/navigation.js';
import { routeTargetId, trackUi } from '../../utils/track.js';
import { createStatusChip } from '../layout/status-chip.js';

const BRAND_MARK = new URL('../../../data/img/site/favicon.svg', import.meta.url);
BRAND_MARK.search = new URL(import.meta.url).search;

const LINKS = [
  { get href() { return href.home; }, key: 'nav.home', names: ['home'] },
  { get href() { return href.players; }, key: 'nav.catalogue', names: ['players', 'player', 'team', 'lineup'] },
  { get href() { return href.compare; }, key: 'nav.comparison', names: ['compare'] },
];

function createSeasonSelect({ seasons = [], selection, onSeasonChange }) {
  return h('select', {
    class: 'season-select',
    'aria-label': t('nav.season'),
    onchange: (event) => {
      const next = event.target.value;
      if (String(next) !== String(selection?.year ?? '')) {
        trackUi({
          event_name: 'filter_change',
          target_type: 'season_filter',
          metadata: {
            league: selection?.league ?? '',
            from: selection?.year == null ? '' : String(selection.year),
            to: String(next),
          },
        });
      }
      onSeasonChange?.(next);
    },
  }, seasons.map((entry) => h('option', {
    value: String(entry.year),
    selected: String(entry.year) === String(selection?.year),
    disabled: entry.status !== 'ready',
    title: entry.reason,
  }, [entry.status === 'ready' ? String(entry.year) : `${entry.year} · ${t('dataset.unavailable')}${entry.reason ? `: ${entry.reason}` : ''}`])));
}

function createLeagueSelect({ leagues = [], datasets = [], selection, onLeagueChange }) {
  return h('select', {
    class: 'league-select',
    'aria-label': t('nav.league'),
    onchange: (event) => {
      const next = event.target.value;
      if (next !== selection?.league) {
        trackUi({
          event_name: 'filter_change',
          target_type: 'league_filter',
          target_id: next,
          metadata: { from: selection?.league ?? '', to: next },
        });
      }
      onLeagueChange?.(next);
    },
  }, leagues.map((league) => h('option', {
    value: league,
    selected: league === selection?.league,
    disabled: !datasets.some((entry) => entry.league === league && entry.status === 'ready'),
  }, [league])));
}

function createLanguageSelect({ onLanguageChange }) {
  const current = currentLanguage();
  return h('select', {
    class: 'language-select',
    'aria-label': t('nav.language'),
    onchange: (event) => {
      const next = event.target.value;
      if (next !== current) {
        trackUi({
          event_name: 'click',
          target_type: 'language_select',
          target_id: next,
          metadata: { from: current, to: next },
        });
      }
      onLanguageChange?.(next);
    },
  }, languageChoices().map((choice) => h('option', {
    value: choice.id,
    selected: choice.id === current,
  }, [choice.name])));
}

export function renderSiteHeader(target, routeName, { leagues = [], datasets = [], seasons = [], selection, onLeagueChange, onSeasonChange, onLanguageChange } = {}) {
  target.classList.remove('is-nav-open');
  const nav = h(
    'nav',
    { id: 'site-nav', class: 'site-nav', 'aria-label': t('nav.primary') },
    LINKS.map((link) =>
      h(
        'a',
        {
          href: link.href,
          class: link.names.includes(routeName) ? 'is-active' : '',
          onClick: () => trackUi({
            event_name: 'click',
            target_type: 'nav_link',
            target_id: routeTargetId(link.href),
          }),
        },
        [t(link.key)],
      ),
    ),
  );
  const menu = h('button', {
    class: 'site-header__menu',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'site-nav',
    'aria-label': t('nav.menu'),
  }, [
    h('span', { class: 'site-header__menu-bars', 'aria-hidden': 'true' }, [
      h('span'),
      h('span'),
      h('span'),
    ]),
  ]);

  function setMenuOpen(open) {
    target.classList.toggle('is-nav-open', open);
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-label', t(open ? 'nav.menuClose' : 'nav.menu'));
  }

  menu.addEventListener('click', () => {
    const open = !target.classList.contains('is-nav-open');
    setMenuOpen(open);
    trackUi({
      event_name: 'click',
      target_type: 'nav_menu',
      target_id: open ? 'open' : 'close',
    });
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuOpen(false);
  });
  function closeOnEscape(event) {
    if (event.key !== 'Escape') return;
    setMenuOpen(false);
    menu.focus();
  }
  menu.addEventListener('keydown', closeOnEscape);
  nav.addEventListener('keydown', closeOnEscape);

  target.replaceChildren(
    h('div', { class: 'site-header__brand' }, [
      h('span', { class: 'coord' }, [t('app.kicker', { league: selection?.league, year: selection?.year })]),
      h('div', { class: 'site-header__title-row' }, [
        h('a', {
          class: 'site-header__brand-name',
          href: href.home,
          'aria-label': t('app.title'),
          onClick: () => trackUi({
            event_name: 'click',
            target_type: 'nav_link',
            target_id: 'home',
          }),
        }, [
          h('img', { class: 'site-header__brand-mark', src: BRAND_MARK.href, width: 24, height: 24, alt: '', 'aria-hidden': 'true' }),
          h('span', {}, [t('app.name')]),
        ]),
      ]),
    ]),
    nav,
    h('div', { class: 'site-header__status' }, [
      h('div', { class: 'site-header__controls' }, [
        createLeagueSelect({ leagues, datasets, selection, onLeagueChange }),
        createSeasonSelect({ seasons, selection, onSeasonChange }),
        createLanguageSelect({ onLanguageChange }),
        createStatusChip({ label: DATASET_MODE, variant: 'mock' }),
      ]),
    ]),
    menu,
  );
  watchSiteHeader(target);
  fitSiteHeader(target, true);
}

const COMPACT_HEADER = '(max-width: 1279px)';

function headerOverflows(target) {
  return target.scrollWidth > target.clientWidth + 1;
}

function fitSiteHeader(target, force = false) {
  const width = target.clientWidth;
  if (!force && target._fitWidth === width) return;
  target._fitWidth = width;
  const compact = window.matchMedia(COMPACT_HEADER).matches;
  target.classList.toggle('is-fit', compact);
  if (!compact) {
    target.classList.remove('is-nav-collapsed', 'is-status-wrapped');
    return;
  }
  target.classList.remove('is-nav-collapsed', 'is-status-wrapped');
  if (headerOverflows(target)) target.classList.add('is-nav-collapsed');
  if (headerOverflows(target)) target.classList.add('is-status-wrapped');
  if (!target.classList.contains('is-nav-collapsed')) target.classList.remove('is-nav-open');
}

function watchSiteHeader(target) {
  if (target._fitWatch) return;
  target._fitWatch = true;
  const query = window.matchMedia(COMPACT_HEADER);
  query.addEventListener('change', () => fitSiteHeader(target, true));
  window.addEventListener('resize', () => fitSiteHeader(target));
  document.fonts?.ready?.then(() => fitSiteHeader(target, true));
}
