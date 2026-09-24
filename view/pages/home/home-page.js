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
            'Lineup synergy in the League of Legends Pro League (LPL)',
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
      h('a', { class: 'home-more', href: href.players }, ['See more →']),
    ]),
  );
}
