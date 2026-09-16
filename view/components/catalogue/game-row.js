import { h } from '../../utils/dom.js';
import { formatDate, formatResult } from '../../utils/formatting.js';
import { createButton } from '../buttons/button.js';

export function createGameRow({ game, onInfo }) {
  const result = formatResult(game.result);
  return h('article', { class: 'game-row' }, [
    h('div', { class: 'coord' }, [formatDate(game.date)]),
    h('div', {}, [
      h('strong', {}, [`vs ${game.opponent?.short ?? game.opponent?.name ?? 'TBD'}`]),
      h('div', { class: 'coord' }, [game.split, ' · ', game.patch ?? 'MOCK']),
    ]),
    h('div', { class: `game-row__result ${result === 'W' ? 'is-win' : 'is-loss'}` }, [result]),
    h('div', { class: 'coord' }, [game.summary ?? 'Summary pending']),
    createButton({ label: 'Info', onClick: () => onInfo(game) }),
  ]);
}
