import { createRosterSlot, createMiniSlot } from '../../components/catalogue/roster-slot.js';
import { createSectionBlock } from '../../components/layout/section-block.js';
import { href } from '../../utils/navigation.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';

export function renderTeamPlayers(players) {
  return createSectionBlock({
    index: t('team.rosterKicker'),
    title: t('common.players'),
    meta: t('team.files', { count: players.length }),
    children: h(
      'div',
      { class: 'team-block__items', style: { padding: 0 } },
      players.map((player) => createRosterSlot(player)),
    ),
  });
}

export function renderTeamLineups(lineups) {
  return createSectionBlock({
    index: t('team.compositions'),
    title: t('common.lineups'),
    meta: t('team.files', { count: lineups.length }),
    children: h(
      'div',
      { class: 'team-block team-block--lineups', style: { border: '0', background: 'transparent' } },
      [
        h(
          'div',
          { class: 'team-block__items', style: { padding: 0 } },
          lineups.map((lineup) =>
            h('a', { class: 'lineup-strip', href: href.lineup(lineup.id) }, [
              h('div', { class: 'lineup-strip__top' }, [
                h('div', { class: 'lineup-strip__name' }, [lineup.name]),
                h('div', { class: 'coord' }, [lineup.context]),
              ]),
              h(
                'div',
                { class: 'lineup-strip__slots' },
                lineup.players.map((player) => createMiniSlot(player)),
              ),
            ]),
          ),
        ),
      ],
    ),
  });
}
