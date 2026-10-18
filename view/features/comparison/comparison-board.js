import { ROLE_ORDER } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';
import { formatRole } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { trackUi } from '../../utils/track.js';
import { updateRouteState } from '../../utils/navigation.js';
import { createLineupComparison, createPlayerComparison } from './comparison-result.js';
import { resolveComparisonState } from './comparison-state.js';
import { createSearchSelect } from './team-search-select.js';

const COMPARE_FOCUS_MEDIA = '(max-width: 720px)';

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

export function createComparisonBoard({ teams = [], playersByTeam, lineupsByTeam, initialState = {} }) {
  let { mode, leftTeamId, rightTeamId, leftId, rightId } = resolveComparisonState(
    initialState, { teams, playersByTeam, lineupsByTeam },
  );
  const players = [...playersByTeam.values()].flat();
  const teamOptions = teams.map((team) => ({
    id: team.id,
    label: team.name,
    hint: team.short,
    team,
    players: playersByTeam.get(team.id) ?? [],
  }));

  const playerButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-pressed': String(mode === 'player'),
  }, [t('common.player')]);
  const lineupButton = h('button', {
    class: 'radar-zoom-btn', type: 'button', 'aria-pressed': String(mode === 'lineup'),
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
  let controlsCollapsed = false;
  const selection = h('p', { class: 'compare-selection', 'aria-live': 'polite' });
  const toggle = h('button', {
    class: 'compare-controls-toggle', type: 'button', 'aria-controls': 'compare-controls',
  });

  function syncCollapse() {
    root.classList.toggle('is-controls-collapsed', controlsCollapsed);
    toggle.setAttribute('aria-expanded', String(!controlsCollapsed));
    toggle.textContent = t(controlsCollapsed ? 'compare.editSelection' : 'compare.hideSelection');
  }

  function persist() {
    updateRouteState({ mode, leftTeamId, rightTeamId, leftId, rightId }, initialState);
  }

  function roster(teamId) {
    if (mode === 'player' && !teamId) return players;
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

  function playerOption(player) {
    const teamId = player.teamId || player.team?.id || '';
    const teamName = player.team?.short || player.team?.name || '';
    const name = `${player.name} · ${formatRole(player.role)}`;
    return {
      id: `${teamId}|${player.id}`,
      label: teamName ? `${name} · ${teamName}` : name,
      team: player.team,
      player,
    };
  }

  function subjectsFor(teamId, side) {
    const role = lockedRole(side);
    const taken = side === 'left' ? rightId : leftId;
    return roster(teamId)
      .filter((item) => (!role || item.role === role) && item.id !== taken);
  }

  function fillSubject(field, side) {
    const teamId = side === 'left' ? leftTeamId : rightTeamId;
    const current = side === 'left' ? leftId : rightId;
    const options = subjectsFor(teamId, side);
    field.select.replaceChildren(
      h('option', { value: '' }, [subjectPlaceholder(mode)]),
      ...options.map((item) => h('option', { value: item.id }, [item.name])),
    );
    const keep = options.some((item) => item.id === current);
    field.select.value = keep ? current : '';
    field.select.disabled = !teamId;
    if (side === 'left') leftId = field.select.value;
    else rightId = field.select.value;
    field.label.data = subjectLabel(mode);
    field.select.setAttribute('aria-label', subjectLabel(mode));
  }

  function fillPlayerSearch(field, side) {
    const teamId = side === 'left' ? leftTeamId : rightTeamId;
    const current = side === 'left' ? leftId : rightId;
    const options = subjectsFor(teamId, side).map(playerOption);
    const selected = options.find((option) => option.player.id === current && (option.player.teamId || option.player.team?.id) === teamId);
    field.setOptions(options);
    field.setValue(selected?.id ?? '');
    if (side === 'left') leftId = selected?.player.id ?? '';
    else rightId = selected?.player.id ?? '';
  }

  function fillSide(field, search, side) {
    if (mode === 'player') fillPlayerSearch(search, side);
    else fillSubject(field, side);
  }

  function showSubjectControls() {
    const players = mode === 'player';
    leftPlayerSearch.node.hidden = !players;
    rightPlayerSearch.node.hidden = !players;
    leftSubject.node.hidden = players;
    rightSubject.node.hidden = players;
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
    const ready = Boolean(left && right && left.id !== right.id);
    root.classList.toggle('has-comparison', ready);
    controlsCollapsed = ready;
    selection.textContent = ready ? t('compare.selectionSummary', {
      left: `${left.name} · ${left.team?.short || left.team?.name || ''}`,
      right: `${right.name} · ${right.team?.short || right.team?.name || ''}`,
    }) : '';
    syncCollapse();
    if (!ready) {
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
    fillSide(changedSide === 'left' ? rightSubject : leftSubject, changedSide === 'left' ? rightPlayerSearch : leftPlayerSearch, changedSide === 'left' ? 'right' : 'left');
    fillSide(changedSide === 'left' ? leftSubject : rightSubject, changedSide === 'left' ? leftPlayerSearch : rightPlayerSearch, changedSide);
    paint();
    persist();
    if (controlsCollapsed && window.matchMedia(COMPARE_FOCUS_MEDIA).matches) toggle.focus();
  }

  const leftTeam = createSearchSelect({
    label: t('common.team'),
    placeholder: t('compare.selectTeam'),
    options: teamOptions,
    side: 'left',
    initialValue: leftTeamId,
    onChange: (option) => {
      leftTeamId = option?.id ?? '';
      leftId = '';
      refresh('left');
    },
  });
  const rightTeam = createSearchSelect({
    label: t('common.team'),
    placeholder: t('compare.selectTeam'),
    options: teamOptions,
    side: 'right',
    initialValue: rightTeamId,
    onChange: (option) => {
      rightTeamId = option?.id ?? '';
      rightId = '';
      refresh('right');
    },
  });
  const leftPlayerSearch = createSearchSelect({
    label: t('common.player'),
    placeholder: t('compare.selectPlayer'),
    options: [],
    side: 'left',
    emptyLabel: t('compare.noPlayers'),
    selectType: 'player_selector',
    searchType: 'player_search',
    onChange: (option) => {
      const player = option?.player;
      leftTeamId = player?.teamId || player?.team?.id || '';
      leftId = player?.id ?? '';
      leftTeam.setValue(leftTeamId);
      refresh('left');
    },
  });
  const rightPlayerSearch = createSearchSelect({
    label: t('common.player'),
    placeholder: t('compare.selectPlayer'),
    options: [],
    side: 'right',
    emptyLabel: t('compare.noPlayers'),
    selectType: 'player_selector',
    searchType: 'player_search',
    onChange: (option) => {
      const player = option?.player;
      rightTeamId = player?.teamId || player?.team?.id || '';
      rightId = player?.id ?? '';
      rightTeam.setValue(rightTeamId);
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
    showSubjectControls();
    fillSide(leftSubject, leftPlayerSearch, 'left');
    fillSide(rightSubject, rightPlayerSearch, 'right');
    syncContent();
    paint();
    persist();
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
  toggle.addEventListener('click', () => {
    controlsCollapsed = !controlsCollapsed;
    syncCollapse();
  });
  showSubjectControls();
  fillSide(leftSubject, leftPlayerSearch, 'left');
  fillSide(rightSubject, rightPlayerSearch, 'right');
  syncContent();

  const side = (kicker, teamSelect, subject, playerSearch, roster) => h('div', { class: 'compare-side' }, [
    h('div', { class: 'coord compare-side__label' }, [kicker]),
    teamSelect.node,
    playerSearch.node,
    subject.node,
    roster,
  ]);

  const controls = h('div', { class: 'compare-controls', id: 'compare-controls' }, [
    h('div', { class: 'compare-mode', role: 'group', 'aria-label': t('compare.type') }, [
      playerButton,
      lineupButton,
    ]),
    h('div', { class: 'compare-board' }, [
      side(t('common.left'), leftTeam, leftSubject, leftPlayerSearch, leftRoster),
      h('div', { class: 'compare-content' }, [
        h('div', { class: 'coord compare-side__label' }, [t('common.content')]),
        h('label', { class: 'chart-control' }, [t('common.comparison'), contentSelect]),
        contentNote,
      ]),
      side(t('common.right'), rightTeam, rightSubject, rightPlayerSearch, rightRoster),
    ]),
  ]);
  const root = h('div', { class: 'compare-section' }, [
    h('div', { class: 'compare-selection-bar' }, [selection, toggle]),
    controls,
    result,
  ]);
  paint();
  persist();
  return root;
}
