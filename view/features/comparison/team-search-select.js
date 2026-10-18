import { TEAM_LOGO_FALLBACK, bindImageFallback, teamLogoUrl } from '../../utils/assets.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { formatRole } from '../../utils/formatting.js';
import { entityNameParts, matchesQuery } from '../../utils/search-text.js';
import { trackUi } from '../../utils/track.js';

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

function optionParts(option) {
  return [
    option.label,
    ...entityNameParts('teams', option.team),
    ...(option.player ? [...entityNameParts('players', option.player), option.player.name, option.player.role, formatRole(option.player.role)] : []),
    ...(option.players ?? []).flatMap((player) => entityNameParts('players', player)),
  ];
}

export function createSearchSelect({
  label,
  placeholder,
  options,
  onChange,
  side,
  initialValue = '',
  emptyLabel = t('catalogue.noTeams'),
  selectType = 'team_selector',
  searchType = 'team_search',
}) {
  let open = false;
  let query = '';
  let value = initialValue;
  let choices = options;
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
    return choices.find((option) => option.id === value) ?? null;
  }

  function paintTrigger() {
    const option = current();
    const parts = [];
    if (option?.team) parts.push(teamMark(option.team));
    parts.push(h('span', { class: option ? 'search-select__value' : 'search-select__placeholder' }, [
      option?.label ?? placeholder,
    ]));
    trigger.replaceChildren(...parts);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function paintList() {
    const shown = choices.filter((option) => matchesQuery(query, optionParts(option)));
    list.replaceChildren(...(shown.length
      ? shown.map((option) => {
        const item = h('button', {
          type: 'button',
          class: 'search-select__option',
          role: 'option',
          'aria-selected': option.id === value ? 'true' : 'false',
        }, [
          ...(option.team ? [teamMark(option.team)] : []),
          h('span', {}, [option.label]),
        ]);
        item.addEventListener('click', () => {
          trackUi({
            event_name: 'click',
            target_type: selectType,
            target_id: option.player?.id ?? option.id,
            metadata: { side },
          });
          value = option.id;
          close();
          onChange?.(option);
        });
        return item;
      })
      : [h('p', { class: 'search-select__empty' }, [emptyLabel])]));
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
      target_type: searchType,
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

  function setValue(next) {
    value = next ?? '';
    if (open) paintList();
    paintTrigger();
  }

  function setOptions(next) {
    choices = next;
    if (!choices.some((option) => option.id === value)) value = '';
    if (open) paintList();
    paintTrigger();
  }

  paintTrigger();
  return { node, setValue, setOptions };
}
