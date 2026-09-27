import { TEAM_LOGO_FALLBACK, bindImageFallback, teamLogoUrl } from '../../utils/assets.js';
import { h } from '../../utils/dom.js';
import { formatRole } from '../../utils/formatting.js';
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

function createSearchSelect({ label, placeholder, options, onChange }) {
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
    placeholder: 'Search',
    'aria-label': `Search ${label.toLowerCase()}`,
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
          value = option.id;
          close();
          onChange?.(value);
        });
        return item;
      })
      : [h('p', { class: 'search-select__empty' }, ['No teams'])]));
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
  return mode === 'lineup' ? 'Lineup' : 'Player';
}

function subjectPlaceholder(mode) {
  return mode === 'lineup' ? 'Select lineup' : 'Select player';
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
  }, ['Player']);
  const lineupButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-pressed': 'false',
  }, ['Lineup']);
  const leftSubject = createSubjectSelect('Player');
  const rightSubject = createSubjectSelect('Player');
  const contentSelect = h('select', { class: 'chart-select', 'aria-label': 'Comparison' });
  const contentNote = h('p', { class: 'compare-content__note' }, ['Same role only']);
  const result = h('div', { class: 'compare-stage' }, [
    h('p', { class: 'compare-stage__label' }, ['Select both sides']),
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
      ? [{ id: 'profile', label: 'Player profile' }]
      : [{ id: 'pair-impact', label: 'Pair impact' }];
    contentSelect.replaceChildren(
      ...options.map((option) => h('option', { value: option.id }, [option.label])),
    );
    contentSelect.value = options[0].id;
    contentNote.textContent = mode === 'player'
      ? 'Same role only'
      : 'One pair-impact chart per lineup';
  }

  function paint() {
    const left = entity(leftTeamId, leftId);
    const right = entity(rightTeamId, rightId);
    if (!left || !right || left.id === right.id) {
      result.className = 'compare-stage';
      result.replaceChildren(h('p', { class: 'compare-stage__label' }, ['Select both sides']));
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
    label: 'Team',
    placeholder: 'Select team',
    options: teamOptions,
    onChange: (teamId) => {
      leftTeamId = teamId;
      leftId = '';
      refresh('left');
    },
  });
  const rightTeam = createSearchSelect({
    label: 'Team',
    placeholder: 'Select team',
    options: teamOptions,
    onChange: (teamId) => {
      rightTeamId = teamId;
      rightId = '';
      refresh('right');
    },
  });

  function setMode(next) {
    const resolved = next === 'lineup' ? 'lineup' : 'player';
    if (resolved === mode) return;
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
    leftId = leftSubject.select.value;
    refresh('left');
  });
  rightSubject.select.addEventListener('change', () => {
    rightId = rightSubject.select.value;
    refresh('right');
  });
  contentSelect.addEventListener('change', paint);
  fillSubject(leftSubject, 'left');
  fillSubject(rightSubject, 'right');
  syncContent();

  const side = (kicker, teamSelect, subject) => h('div', { class: 'compare-side' }, [
    h('div', { class: 'coord compare-side__label' }, [kicker]),
    teamSelect.node,
    subject.node,
  ]);

  return h('div', { class: 'compare-section' }, [
    h('div', { class: 'compare-mode', role: 'group', 'aria-label': 'Comparison type' }, [
      playerButton,
      lineupButton,
    ]),
    h('div', { class: 'compare-board' }, [
      side('Left', leftTeam, leftSubject),
      h('div', { class: 'compare-content' }, [
        h('div', { class: 'coord compare-side__label' }, ['Content']),
        h('label', { class: 'chart-control' }, ['Comparison', contentSelect]),
        contentNote,
      ]),
      side('Right', rightTeam, rightSubject),
    ]),
    result,
  ]);
}
