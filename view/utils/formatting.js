import { PLACEHOLDER, ROLE_LABELS, ROLE_ORDER } from './constants.js';

export function formatRole(role) {
  return ROLE_LABELS[role] ?? String(role).toUpperCase();
}

export function formatResult(result) {
  if (result === 1) return 'W';
  if (result === 0) return 'L';
  return PLACEHOLDER;
}

export function formatDate(iso) {
  if (!iso) return PLACEHOLDER;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function placeholderValue() {
  return PLACEHOLDER;
}

export function lineupPlayerIds(lineup) {
  return ROLE_ORDER.map((role) => lineup.players.find((player) => player.role === role)?.id).filter(
    Boolean,
  );
}
