import { formatFixed, formatImpact, formatPercent } from '../../utils/formatting.js';

export const SPAN_STEP = 0.05;
const SPAN_PAD = 1.04;
const MIN_SPAN_FLOOR = 0.25;

const BASELINE_FIELDS = {
  mean_gold_share: 'mean_baseline_gold_share',
  mean_damage_share: 'mean_baseline_damage_share',
  mean_dpm: 'mean_baseline_dpm',
  mean_vision_per_minute: 'mean_baseline_vision_per_minute',
};

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

export function baselineValue(stats = {}, key) {
  // Impact is a residual against the context model, whose reference is zero.
  // The other axes use same-role means from earlier training games.
  if (key === 'shrunk_impact') return Number.isFinite(stats.n_games) && stats.n_games > 0 ? 0 : null;
  return finiteOrNull(stats[BASELINE_FIELDS[key]]);
}

export function profileValues(stats = {}, axes = [], baseline = false) {
  return axes.map((axis) => baseline ? baselineValue(stats, axis.key) : finiteOrNull(stats[axis.key]));
}

function valuesFor(players, key) {
  return players.flatMap(({ stats = {} }) => [stats[key], baselineValue(stats, key)]).filter(Number.isFinite);
}

export function displayMax(axis, span = 1) {
  return axis.min + (axis.max - axis.min) * span;
}

export function axisRangeLabel(axis, span = 1) {
  return `${axis.format(axis.min)}–${axis.format(displayMax(axis, span))}`;
}

export function createRadarAxes(players = []) {
  const dpmMax = Math.max(0, ...valuesFor(players, 'mean_dpm'));
  const visionMax = Math.max(0, ...valuesFor(players, 'mean_vision_per_minute'));
  const impactValues = valuesFor(players, 'shrunk_impact');
  const impactMin = Math.min(0, ...impactValues);
  const impactMax = Math.max(0, ...impactValues);

  return [
    {
      key: 'mean_gold_share', label: 'Gold Share', min: 0, max: 1,
      kind: 'theoretical', rangeLabel: '0–100%', format: formatPercent,
    },
    {
      key: 'mean_damage_share', label: 'Damage Share', min: 0, max: 1,
      kind: 'theoretical', rangeLabel: '0–100%', format: formatPercent,
    },
    {
      key: 'mean_dpm', label: 'DPM', min: 0, max: dpmMax || 1,
      kind: 'observed', rangeLabel: `0–${formatFixed(dpmMax, 1)}`,
      format: (value) => formatFixed(value, 1),
    },
    {
      key: 'mean_vision_per_minute', label: 'Vision / min', min: 0, max: visionMax || 1,
      kind: 'observed', rangeLabel: `0–${formatFixed(visionMax, 2)}`,
      format: (value) => formatFixed(value, 2),
    },
    {
      key: 'shrunk_impact', label: 'Impact', min: impactMin,
      max: impactMax === impactMin ? impactMin + 1 : impactMax,
      kind: 'observed', rangeLabel: `${formatImpact(impactMin)}–${formatImpact(impactMax)}`,
      format: formatImpact, zeroLabel: '0 = on expected DPM',
    },
  ];
}

export function radiusFor(axis, value, span = 1) {
  if (!Number.isFinite(value)) return null;
  const max = displayMax(axis, span);
  if (max === axis.min) return 0;
  return Math.max(0, Math.min(1, (value - axis.min) / (max - axis.min)));
}

export function minimumRadarSpan(stats, axes, showBaseline = false) {
  const peak = Math.max(0, ...axes.map((axis) => Math.max(
    radiusFor(axis, stats[axis.key]) ?? 0,
    showBaseline ? radiusFor(axis, baselineValue(stats, axis.key)) ?? 0 : 0,
  )));
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
