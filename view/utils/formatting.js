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
  const date = String(iso).includes('T') ? new Date(iso) : new Date(`${iso}T00:00:00`);
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

export function formatCount(value) {
  if (value == null || value === '') return PLACEHOLDER;
  const number = Number(value);
  if (!Number.isFinite(number)) return PLACEHOLDER;
  return String(Math.round(number));
}

export function formatFixed(value, digits = 2) {
  if (value == null || value === '') return PLACEHOLDER;
  const number = Number(value);
  if (!Number.isFinite(number)) return PLACEHOLDER;
  return number.toFixed(digits);
}

export function formatPercent(value) {
  if (value == null || value === '') return PLACEHOLDER;
  const number = Number(value);
  if (!Number.isFinite(number)) return PLACEHOLDER;
  return `${(number * 100).toFixed(1)}%`;
}

export function formatImpact(value) {
  if (value == null || value === '') return PLACEHOLDER;
  const number = Number(value);
  if (!Number.isFinite(number)) return PLACEHOLDER;
  return `${number >= 0 ? '+' : ''}${number.toFixed(3)}`;
}

export function lineupPlayerIds(lineup) {
  return ROLE_ORDER.map((role) => lineup.players.find((player) => player.role === role)?.id).filter(
    Boolean,
  );
}
