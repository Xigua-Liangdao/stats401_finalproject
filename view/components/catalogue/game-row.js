import { h } from '../../utils/dom.js';
import { PLACEHOLDER } from '../../utils/constants.js';
import { formatDate, formatResult } from '../../utils/formatting.js';
import { createButton } from '../buttons/button.js';

function sideModifier(side) {
  const value = String(side ?? '').toLowerCase();
  if (value === 'blue') return 'blue';
  if (value === 'red') return 'red';
  return '';
}

export function createGameRow({ game, onInfo }) {
  const result = formatResult(game.result);
  const side = sideModifier(game.side);
  const classes = ['game-row'];
  if (side) classes.push(`game-row--${side}`);

  return h(
    'article',
    {
      class: classes.join(' '),
      'aria-label': side ? `${side} side` : undefined,
    },
    [
      h('div', { class: 'coord' }, [formatDate(game.date)]),
      h('div', {}, [
        h('div', { class: 'coord' }, [game.split, ' · ', game.patch ?? PLACEHOLDER]),
        game.summary ? h('div', { class: 'game-row__summary' }, [game.summary]) : null,
      ]),
      h('div', { class: `game-row__result ${result === 'W' ? 'is-win' : 'is-loss'}` }, [result]),
      createButton({ label: 'Info', onClick: () => onInfo(game) }),
    ],
  );
}
