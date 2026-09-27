import { formatFixed, formatImpact, formatPercent } from '../../utils/formatting.js';

export const SPAN_STEP = 0.05;
export const BASELINE_RADIUS = 0.5;
const SPAN_PAD = 1.04;
const MIN_SPAN_FLOOR = 0.25;
const DEVIATION_QUANTILE = 0.9;
const DEVIATION_PAD = 1.1;

const BASELINE_FIELDS = {
  shrunk_impact: 'mean_baseline_impact',
  mean_gold_share: 'mean_baseline_gold_share',
  mean_damage_share: 'mean_baseline_damage_share',
  mean_dpm: 'mean_baseline_dpm',
  mean_vision_per_minute: 'mean_baseline_vision_per_minute',
};

const PREDICTED_FIELDS = {
  mean_dpm: 'mean_expected_dpm',
};

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

export function baselineValue(stats = {}, key) {
  return finiteOrNull(stats[BASELINE_FIELDS[key]]);
}

export function predictedValue(stats = {}, key) {
  return finiteOrNull(stats[PREDICTED_FIELDS[key]]);
}

export function timelineGamesForPlayer(player, games = []) {
  const season = player.season ?? player.team?.season;
  const baselineDpm = baselineValue(player.stats, 'mean_dpm');
  return games
    .filter((game) => (season == null || String(game.season) === String(season))
      && (!player.role || !game.role || game.role === player.role))
    .map((game) => ({ ...game, season_role_baseline_dpm: baselineDpm }));
}

export function profileValues(stats = {}, axes = [], baseline = false) {
  return axes.map((axis) => baseline ? baselineValue(stats, axis.key) : finiteOrNull(stats[axis.key]));
}

function absoluteDeviations(players, key) {
  const deviations = [];
  for (const player of players) {
    const stats = player.stats ?? {};
    const baseline = baselineValue(stats, key);
    if (baseline == null) continue;
    for (const value of [stats[key], predictedValue(stats, key)]) {
      if (Number.isFinite(value)) deviations.push(Math.abs(value - baseline));
    }
  }
  return deviations.sort((a, b) => a - b);
}

function deviationHalf(players, key) {
  const deviations = absoluteDeviations(players, key);
  if (!deviations.length) return 0;
  const index = Math.round((deviations.length - 1) * DEVIATION_QUANTILE);
  return deviations[index] * DEVIATION_PAD;
}

function formatWindow(axis, half) {
  const text = axis.format(Math.abs(half));
  return text.replace(/^\+/, '');
}

export function axisRangeLabel(axis, span = 1) {
  return `±${formatWindow(axis, axis.half * span)}`;
}

export function createRadarAxes(players = []) {
  return [
    {
      key: 'mean_gold_share', label: 'Gold Share',
      half: deviationHalf(players, 'mean_gold_share'),
      format: formatPercent,
    },
    {
      key: 'mean_damage_share', label: 'Damage Share',
      half: deviationHalf(players, 'mean_damage_share'),
      format: formatPercent,
    },
    {
      key: 'mean_dpm', label: 'DPM',
      half: deviationHalf(players, 'mean_dpm'),
      format: (value) => formatFixed(value, 1),
    },
    {
      key: 'mean_vision_per_minute', label: 'Vision / min',
      half: deviationHalf(players, 'mean_vision_per_minute'),
      format: (value) => formatFixed(value, 2),
    },
    {
      key: 'shrunk_impact', label: 'Impact',
      half: deviationHalf(players, 'shrunk_impact'),
      format: formatImpact,
    },
  ];
}

export function radiusFor(axis, value, baseline, span = 1) {
  if (!Number.isFinite(value) || !Number.isFinite(baseline)) return null;
  const half = axis.half * span;
  if (!(half > 0)) return value === baseline ? BASELINE_RADIUS : null;
  const shifted = (value - baseline) / half;
  return Math.max(0, Math.min(1, BASELINE_RADIUS + BASELINE_RADIUS * shifted));
}

export function minimumRadarSpan(stats, axes, showPredicted = false) {
  const peak = Math.max(0, ...axes.map((axis) => {
    const baseline = baselineValue(stats, axis.key);
    if (baseline == null || !(axis.half > 0)) return 0;
    const values = [stats[axis.key]];
    if (showPredicted) values.push(predictedValue(stats, axis.key));
    return Math.max(0, ...values.map((value) => (
      Number.isFinite(value) ? Math.abs(value - baseline) / axis.half : 0
    )));
  }));
  const floor = Math.min(1, Math.max(peak * SPAN_PAD, MIN_SPAN_FLOOR));
  return Math.min(1, Math.ceil(floor / SPAN_STEP) * SPAN_STEP);
}

// Split the circular profile at missing axes. Only a complete profile can close
// and fill a polygon; a missing measurement must never become a center point.
export function profileSegments(values) {
  if (!values.length) return [];
  const missingIndex = values.findIndex((value) => !Number.isFinite(value));
  if (missingIndex === -1) {
    return [{ closed: true, points: values.map((value, index) => ({ index, value })) }];
  }
  const segments = [];
  let points = [];
  for (let step = 1; step <= values.length; step += 1) {
    const index = (missingIndex + step) % values.length;
    const value = values[index];
    if (Number.isFinite(value)) {
      points.push({ index, value });
    } else if (points.length) {
      segments.push({ closed: false, points });
      points = [];
    }
  }
  return segments;
}
