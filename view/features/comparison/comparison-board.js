import { TEAM_LOGO_FALLBACK, bindImageFallback, teamLogoUrl } from '../../utils/assets.js';
import { ROLE_ORDER } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { formatRole } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { trackUi } from '../../utils/track.js';
import { createLineupComparison, createPlayerComparison } from './comparison-result.js';

function teamMark(team) {
  const img = h('img', {
    class: 'search-select__logo',
    src: teamLogoUrl(team),
    alt: '',
    draggable: 'false',
  });
  bindImageFallback(img, TEAM_LOGO_FALLBACK);
  return img;
}

function createSearchSelect({ label, placeholder, options, onChange, side }) {
  let open = false;
  let query = '';
  let value = '';
  const trigger = h('button', {
    type: 'button',
    class: 'search-select__trigger',
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
  });
  const input = h('input', {
    type: 'search',
    class: 'search-select__input',
    placeholder: t('common.search'),
    'aria-label': t('compare.search', { label: String(label).toLowerCase() }),
  });
  const list = h('div', { class: 'search-select__list', role: 'listbox', 'aria-label': label });
  const menu = h('div', { class: 'search-select__menu', hidden: true }, [input, list]);
  const node = h('div', { class: 'chart-control search-select' }, [
    label,
    h('div', { class: 'search-select__control' }, [trigger, menu]),
  ]);

  function current() {
    return options.find((option) => option.id === value) ?? null;
  }

  function paintTrigger() {
    const option = current();
    const parts = [];
    if (option) parts.push(teamMark(option.team));
    parts.push(h('span', { class: option ? 'search-select__value' : 'search-select__placeholder' }, [
      option?.label ?? placeholder,
    ]));
    trigger.replaceChildren(...parts);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function paintList() {
    const needle = query.trim().toLowerCase();
    const shown = options.filter((option) => {
      const haystack = `${option.label} ${option.hint ?? ''}`.toLowerCase();
      return haystack.includes(needle);
    });
    list.replaceChildren(...(shown.length
      ? shown.map((option) => {
        const item = h('button', {
          type: 'button',
          class: 'search-select__option',
          role: 'option',
          'aria-selected': option.id === value ? 'true' : 'false',
        }, [
          teamMark(option.team),
          h('span', {}, [option.label]),
        ]);
        item.addEventListener('click', () => {
          trackUi({
            event_name: 'click',
            target_type: 'team_selector',
            target_id: option.id,
            metadata: { side },
          });
          value = option.id;
          close();
          onChange?.(value);
        });
        return item;
      })
      : [h('p', { class: 'search-select__empty' }, [t('catalogue.noTeams')])]));
  }

  function close() {
    if (!open) return;
    open = false;
    query = '';
    input.value = '';
    menu.hidden = true;
    list.replaceChildren();
    paintTrigger();
  }

  function openMenu() {
    open = true;
    trackUi({
      event_name: 'search_open',
      target_type: 'team_search',
      target_id: side,
    });
    menu.hidden = false;
    paintTrigger();
    paintList();
    input.focus();
  }

  trigger.addEventListener('click', () => (open ? close() : openMenu()));
  input.addEventListener('input', () => {
    query = input.value;
    paintList();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      trigger.focus();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!node.contains(event.target)) close();
  });

  paintTrigger();
  return { node };
}

function createSubjectSelect(labelText) {
  const label = document.createTextNode(labelText);
  const select = h('select', { class: 'chart-select', 'aria-label': labelText });
  const node = h('label', { class: 'chart-control' }, [label, select]);
  return { node, label, select };
}

function subjectLabel(mode) {
  return mode === 'lineup' ? t('common.lineup') : t('common.player');
}

function subjectPlaceholder(mode) {
  return mode === 'lineup' ? t('compare.selectLineup') : t('compare.selectPlayer');
}

export function createComparisonBoard({ teams = [], playersByTeam, lineupsByTeam }) {
  let mode = 'player';
  let leftTeamId = '';
  let rightTeamId = '';
  let leftId = '';
  let rightId = '';
  const players = [...playersByTeam.values()].flat();
  const teamOptions = teams.map((team) => ({
    id: team.id,
    label: team.name,
    hint: team.short,
    team,
  }));

  const playerButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-pressed': 'true',
  }, [t('common.player')]);
  const lineupButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-pressed': 'false',
  }, [t('common.lineup')]);
  const leftSubject = createSubjectSelect(t('common.player'));
  const rightSubject = createSubjectSelect(t('common.player'));
  const contentSelect = h('select', { class: 'chart-select', 'aria-label': t('common.comparison') });
  const contentNote = h('p', { class: 'compare-content__note' }, [t('compare.sameRole')]);
  const leftRoster = h('div', { class: 'compare-roster compare-roster--left' });
  const rightRoster = h('div', { class: 'compare-roster compare-roster--right' });
  const result = h('div', { class: 'compare-stage' }, [
    h('p', { class: 'compare-stage__label' }, [t('compare.selectBoth')]),
  ]);

  function roster(teamId) {
    if (!teamId) return [];
    return mode === 'lineup'
      ? (lineupsByTeam.get(teamId) ?? [])
      : (playersByTeam.get(teamId) ?? []);
  }

  function entity(teamId, id) {
    return roster(teamId).find((item) => item.id === id) ?? null;
  }

  function lockedRole(side) {
    if (mode !== 'player') return null;
    const other = side === 'left' ? entity(rightTeamId, rightId) : entity(leftTeamId, leftId);
    return other?.role ?? null;
  }

  function subjectsFor(teamId, side) {
    const role = lockedRole(side);
    const taken = side === 'left' ? rightId : leftId;
    return roster(teamId)
      .filter((item) => (!role || item.role === role) && item.id !== taken)
      .map((item) => ({
        id: item.id,
        label: mode === 'player' ? `${item.name} · ${formatRole(item.role)}` : item.name,
      }));
  }

  function fillSubject(field, side) {
    const teamId = side === 'left' ? leftTeamId : rightTeamId;
    const current = side === 'left' ? leftId : rightId;
    const options = subjectsFor(teamId, side);
    field.select.replaceChildren(
      h('option', { value: '' }, [subjectPlaceholder(mode)]),
      ...options.map((option) => h('option', { value: option.id }, [option.label])),
    );
    const keep = options.some((option) => option.id === current);
    field.select.value = keep ? current : '';
    field.select.disabled = !teamId;
    if (side === 'left') leftId = field.select.value;
    else rightId = field.select.value;
    field.label.data = subjectLabel(mode);
    field.select.setAttribute('aria-label', subjectLabel(mode));
  }

  function syncContent() {
    const options = mode === 'player'
      ? [{ id: 'profile', label: t('compare.profile') }]
      : [{ id: 'pair-impact', label: t('compare.pair') }];
    contentSelect.replaceChildren(
      ...options.map((option) => h('option', { value: option.id }, [option.label])),
    );
    contentSelect.value = options[0].id;
    contentNote.textContent = mode === 'player'
      ? t('compare.sameRole')
      : t('compare.pairNote');
  }

  function rosterRows(lineup) {
    if (!lineup) return [];
    const byRole = ROLE_ORDER.map((role) => (lineup.players ?? []).find((player) => player.role === role));
    const players = byRole.some(Boolean) ? byRole.filter(Boolean) : (lineup.players ?? []);
    return players.map((player) => h('div', { class: 'compare-roster__row' }, [
      h('span', { class: 'compare-roster__role' }, [formatRole(player.role)]),
      h('span', { class: 'compare-roster__name' }, [player.name]),
    ]));
  }

  function paintRosters() {
    const show = mode === 'lineup';
    leftRoster.replaceChildren(...(show ? rosterRows(entity(leftTeamId, leftId)) : []));
    rightRoster.replaceChildren(...(show ? rosterRows(entity(rightTeamId, rightId)) : []));
  }

  function paint() {
    paintRosters();
    const left = entity(leftTeamId, leftId);
    const right = entity(rightTeamId, rightId);
    if (!left || !right || left.id === right.id) {
      result.className = 'compare-stage';
      result.replaceChildren(h('p', { class: 'compare-stage__label' }, [t('compare.selectBoth')]));
      return;
    }
    result.className = 'compare-result';
    result.replaceChildren(mode === 'player'
      ? createPlayerComparison({ left, right, players })
      : createLineupComparison({ left, right }));
  }

  function refresh(changedSide) {
    fillSubject(changedSide === 'left' ? rightSubject : leftSubject, changedSide === 'left' ? 'right' : 'left');
    fillSubject(changedSide === 'left' ? leftSubject : rightSubject, changedSide);
    paint();
  }

  const leftTeam = createSearchSelect({
    label: t('common.team'),
    placeholder: t('compare.selectTeam'),
    options: teamOptions,
    side: 'left',
    onChange: (teamId) => {
      leftTeamId = teamId;
      leftId = '';
      refresh('left');
    },
  });
  const rightTeam = createSearchSelect({
    label: t('common.team'),
    placeholder: t('compare.selectTeam'),
    options: teamOptions,
    side: 'right',
    onChange: (teamId) => {
      rightTeamId = teamId;
      rightId = '';
      refresh('right');
    },
  });

  function setMode(next) {
    const resolved = next === 'lineup' ? 'lineup' : 'player';
    if (resolved === mode) return;
    trackUi({
      event_name: 'click',
      target_type: 'comparison_mode',
      target_id: resolved,
    });
    mode = resolved;
    leftId = '';
    rightId = '';
    playerButton.setAttribute('aria-pressed', mode === 'player' ? 'true' : 'false');
    lineupButton.setAttribute('aria-pressed', mode === 'lineup' ? 'true' : 'false');
    fillSubject(leftSubject, 'left');
    fillSubject(rightSubject, 'right');
    syncContent();
    paint();
  }

  playerButton.addEventListener('click', () => setMode('player'));
  lineupButton.addEventListener('click', () => setMode('lineup'));
  leftSubject.select.addEventListener('change', () => {
    const from = leftId;
    const to = leftSubject.select.value;
    leftId = to;
    if (to !== from) {
      trackUi({
        event_name: 'click',
        target_type: mode === 'lineup' ? 'lineup_selector' : 'player_selector',
        target_id: to,
        metadata: { side: 'left', from, to },
      });
    }
    refresh('left');
  });
  rightSubject.select.addEventListener('change', () => {
    const from = rightId;
    const to = rightSubject.select.value;
    rightId = to;
    if (to !== from) {
      trackUi({
        event_name: 'click',
        target_type: mode === 'lineup' ? 'lineup_selector' : 'player_selector',
        target_id: to,
        metadata: { side: 'right', from, to },
      });
    }
    refresh('right');
  });
  contentSelect.addEventListener('change', paint);
  fillSubject(leftSubject, 'left');
  fillSubject(rightSubject, 'right');
  syncContent();

  const side = (kicker, teamSelect, subject, roster) => h('div', { class: 'compare-side' }, [
    h('div', { class: 'coord compare-side__label' }, [kicker]),
    teamSelect.node,
    subject.node,
    roster,
  ]);

  return h('div', { class: 'compare-section' }, [
    h('div', { class: 'compare-mode', role: 'group', 'aria-label': t('compare.type') }, [
      playerButton,
      lineupButton,
    ]),
    h('div', { class: 'compare-board' }, [
      side(t('common.left'), leftTeam, leftSubject, leftRoster),
      h('div', { class: 'compare-content' }, [
        h('div', { class: 'coord compare-side__label' }, [t('common.content')]),
        h('label', { class: 'chart-control' }, [t('common.comparison'), contentSelect]),
        contentNote,
      ]),
      side(t('common.right'), rightTeam, rightSubject, rightRoster),
    ]),
    result,
  ]);
}
