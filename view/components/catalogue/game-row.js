import { h } from '../../utils/dom.js';
import { PLACEHOLDER } from '../../utils/constants.js';
import { formatDate, formatResult } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { createButton } from '../buttons/button.js';

function sideModifier(side) {
  const value = String(side ?? '').toLowerCase();
  if (value === 'blue') return 'blue';
  if (value === 'red') return 'red';
  return '';
}

export function createGameRow({ game, onInfo, champion = false }) {
  const result = formatResult(game.result);
  const side = sideModifier(game.side);
  const classes = ['game-row'];
  if (side) classes.push(`game-row--${side}`);

  return h('tr', { class: classes.join(' ') }, [
    h('td', {}, [formatDate(game.date)]),
    h('td', {}, [game.split || PLACEHOLDER]),
    h('td', {}, [game.patch ?? PLACEHOLDER]),
    champion ? h('td', { class: 'game-row__summary' }, [game.summary || PLACEHOLDER]) : null,
    h('td', { class: `game-row__result ${game.result === 1 ? 'is-win' : 'is-loss'}` }, [result]),
    h('td', { class: 'game-table__info' }, [
      createButton({ label: t('common.info'), onClick: () => onInfo(game) }),
    ]),
  ]);
}
