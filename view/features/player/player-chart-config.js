import { formatCount, formatFixed, formatPercent } from '../../utils/formatting.js';
import { t } from '../../utils/i18n.js';
import { PLACEHOLDER } from '../../utils/constants.js';

function metric(id, key, field = id) {
  return { id, field, get label() { return t(key); } };
}

export const PLAYER_CHART_CATEGORIES = [
  {
    id: 'combat',
    get label() { return t('chart.combat'); },
    metrics: [
      metric('kills', 'chart.kills'),
      metric('deaths', 'chart.deaths'),
      metric('assists', 'chart.assists'),
      metric('kda', 'stat.kda'),
    ],
  },
  {
    id: 'resources',
    get label() { return t('chart.resources'); },
    metrics: [
      metric('total_gold', 'chart.totalGold'),
      metric('total_cs', 'chart.totalCs'),
      metric('damage', 'chart.damage'),
      metric('dpm', 'common.dpm'),
    ],
  },
  {
    id: 'contribution',
    get label() { return t('chart.contribution'); },
    metrics: [
      metric('gold_share', 'chart.goldShare'),
      metric('damage_share', 'chart.damageShare'),
      metric('vision_per_minute', 'chart.visionMinute'),
      metric('kill_participation', 'chart.killPart'),
    ],
  },
  {
    id: 'early',
    get label() { return t('chart.early'); },
    metrics: [
      metric('gold_diff_at_15', 'chart.gold15'),
      metric('xp_diff_at_15', 'chart.xp15'),
      metric('cs_diff_at_15', 'chart.cs15'),
    ],
  },
  {
    id: 'dpm',
    get label() { return t('chart.dpmAnalysis'); },
    metrics: [
      metric('dpm', 'chart.actualDpm'),
      metric('expected_dpm', 'chart.expectedDpm'),
      metric('season_role_baseline_dpm', 'chart.seasonDpm'),
      metric('baseline_dpm', 'chart.trainingDpm'),
    ],
  },
];

export const SERIES_PALETTE = ['var(--accent)', 'var(--ember)', 'var(--side-blue)', 'var(--gold)', 'var(--accent-strong)'];

function series(key) {
  return { get label() { return t(key); } };
}

export const SERIES_META = {
  kills: series('chart.kills'),
  deaths: series('chart.deaths'),
  assists: series('chart.assists'),
  kda: series('stat.kda'),
  total_gold: series('chart.totalGold'),
  total_cs: series('chart.totalCs'),
  damage: series('chart.damage'),
  dpm: series('chart.actualDpm'),
  expected_dpm: series('chart.expectedDpm'),
  season_role_baseline_dpm: series('chart.seasonDpm'),
  baseline_dpm: series('chart.trainingDpm'),
  vision_per_minute: series('chart.visionMinute'),
  gold_share: series('chart.goldShare'),
  damage_share: series('chart.damageShare'),
  kill_participation: series('chart.killPart'),
  gold_diff_at_15: series('chart.gold15'),
  xp_diff_at_15: series('chart.xp15'),
  cs_diff_at_15: series('chart.cs15'),
};

const PERCENT_FIELDS = new Set(['gold_share', 'damage_share', 'kill_participation']);

export function findCategory(id) {
  return PLAYER_CHART_CATEGORIES.find((category) => category.id === id) ?? PLAYER_CHART_CATEGORIES[0];
}

export function colorForSeries(index) {
  return SERIES_PALETTE[index % SERIES_PALETTE.length];
}

export function formatChartValue(field, value) {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  if (PERCENT_FIELDS.has(field)) return formatPercent(value);
  if (field === 'kda' || DPM_FIELDS.has(field) || field === 'vision_per_minute') {
    return formatFixed(value, 2);
  }
  if (field.endsWith('_at_15')) return formatCount(value);
  return formatCount(value);
}

const DPM_FIELDS = new Set(['dpm', 'expected_dpm', 'baseline_dpm', 'season_role_baseline_dpm']);

export function yTickFormat(fields) {
  if (fields.every((field) => PERCENT_FIELDS.has(field))) return (value) => formatPercent(value);
  if (fields.includes('kda') || fields.includes('vision_per_minute') || fields.some((field) => DPM_FIELDS.has(field))) {
    return (value) => formatFixed(value, 1);
  }
  return (value) => formatCount(value);
}

const DPM_FORM_BAND = 0.05;

export function dpmFormVsModel(stats) {
  const actual = stats?.mean_dpm;
  const expected = stats?.mean_expected_dpm;
  const hint = t('chart.dpmHint');
  if (actual == null || expected == null || !Number.isFinite(actual) || !Number.isFinite(expected) || expected === 0) {
    return {
      value: PLACEHOLDER,
      hint: t('chart.dpmEmpty'),
      tone: 'empty',
    };
  }
  const relative = (actual - expected) / expected;
  if (relative > DPM_FORM_BAND) {
    return { value: t('chart.above'), hint, tone: 'above' };
  }
  if (relative < -DPM_FORM_BAND) {
    return { value: t('chart.below'), hint, tone: 'below' };
  }
  return { value: t('chart.inline'), hint, tone: 'inline' };
}

export function seasonRecord(games, season) {
  const seasonGames = games.filter((game) => String(game.season) === String(season));
  const decided = seasonGames.filter((game) => game.result === 0 || game.result === 1);
  const wins = decided.filter((game) => game.result === 1).length;
  return {
    gamesPlayed: seasonGames.length,
    winRate: decided.length ? wins / decided.length : null,
    totalGames: games.length,
  };
}
