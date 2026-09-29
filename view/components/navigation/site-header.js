import { DATASET_MODE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { currentLanguage, languageChoices, t } from '../../utils/i18n.js';
import { href } from '../../utils/navigation.js';
import { routeTargetId, trackUi } from '../../utils/track.js';
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
    onchange: (event) => {
      const next = event.target.value;
      if (String(next) !== String(season ?? '')) {
        trackUi({
          event_name: 'filter_change',
          target_type: 'season_filter',
          metadata: { from: season == null ? '' : String(season), to: String(next) },
        });
      }
      onSeasonChange?.(next);
    },
  }, options.map((value) => h('option', {
    value: String(value),
    selected: String(value) === String(season),
  }, [String(value)])));
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

export function renderSiteHeader(target, routeName, { seasons = [], season, onSeasonChange, onLanguageChange } = {}) {
  target.replaceChildren(
    h('div', { class: 'site-header__brand' }, [
      h('span', { class: 'coord' }, [t('app.kicker')]),
      h('a', {
        class: 'site-header__brand-name',
        href: href.home,
        onClick: () => trackUi({
          event_name: 'click',
          target_type: 'nav_link',
          target_id: 'home',
        }),
      }, [t('home.title')]),
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
            onClick: () => trackUi({
              event_name: 'click',
              target_type: 'nav_link',
              target_id: routeTargetId(link.href),
            }),
          },
          [t(link.key)],
        ),
      ),
    ),
    h('div', { class: 'site-header__status' }, [
      createSeasonSelect({ seasons, season, onSeasonChange }),
      createLanguageSelect({ onLanguageChange }),
      createStatusChip({ label: DATASET_MODE, variant: 'mock' }),
    ]),
  );
}
