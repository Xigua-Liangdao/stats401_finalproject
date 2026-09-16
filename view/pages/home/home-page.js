import { APP_KICKER } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { href } from '../../utils/navigation.js';
import { dataSource } from '../../utils/data-source.js';

export async function renderHomePage(target) {
  const catalog = await dataSource.loadCatalog();

  target.append(
    h('div', { class: 'home' }, [
      h('section', { class: 'home-top' }, [
        h('div', {}, [
          h('div', { class: 'kicker' }, [`${APP_KICKER} · Scouting terminal`]),
          h('h1', { class: 'home-title display' }, ['Lineup', h('br'), 'Synergy']),
          h('p', { class: 'home-sub' }, [
            'An LPL analytics terminal for context-adjusted player performance, five-man compositions, and pair impact. Organizations are not lineups.',
          ]),
        ]),
        h('aside', { class: 'home-status panel' }, [
          h('div', { class: 'coord' }, ['SYS.STATUS']),
          h('dl', {}, [
            h('div', {}, [h('dt', {}, ['Season']), h('dd', {}, [String(catalog.season)])]),
            h('div', {}, [h('dt', {}, ['Teams']), h('dd', {}, [String(catalog.teams.length)])]),
            h('div', {}, [h('dt', {}, ['Players / Lineups']), h('dd', {}, [`${catalog.players.length} / ${catalog.lineups.length}`])]),
          ]),
        ]),
      ]),
      h('div', { class: 'home-choices' }, [
        h('a', { class: 'choice-card panel', href: href.players }, [
          h('div', { class: 'choice-card__index' }, ['01 / Entity']),
          h('div', {}, [
            h('h2', { class: 'display' }, ['Player']),
            h('p', {}, ['Browse rosters grouped by organization, then open a player file.']),
          ]),
          h('div', { class: 'choice-card__go' }, ['Enter catalogue →']),
        ]),
        h('a', { class: 'choice-card panel', href: href.lineups }, [
          h('div', { class: 'choice-card__index' }, ['02 / Composition']),
          h('div', {}, [
            h('h2', { class: 'display' }, ['Lineup']),
            h('p', {}, ['Inspect five-player compositions belonging to each team.']),
          ]),
          h('div', { class: 'choice-card__go' }, ['Enter catalogue →']),
        ]),
      ]),
    ]),
  );
}
