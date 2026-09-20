import { formatCount, formatFixed, formatPercent } from '../../utils/formatting.js';

export const PLAYER_CHART_CATEGORIES = [
  {
    id: 'combat',
    label: 'Combat Performance',
    metrics: [
      { id: 'kills', label: 'Kills', field: 'kills' },
      { id: 'deaths', label: 'Deaths', field: 'deaths' },
      { id: 'assists', label: 'Assists', field: 'assists' },
      { id: 'kda', label: 'KDA', field: 'kda' },
    ],
  },
  {
    id: 'resources',
    label: 'Resources & Output',
    metrics: [
      { id: 'total_gold', label: 'Total Gold', field: 'total_gold' },
      { id: 'total_cs', label: 'Total CS', field: 'total_cs' },
      { id: 'damage', label: 'Damage', field: 'damage' },
      { id: 'dpm', label: 'DPM', field: 'dpm' },
    ],
  },
  {
    id: 'contribution',
    label: 'Team Contribution',
    metrics: [
      { id: 'gold_share', label: 'Gold Share', field: 'gold_share' },
      { id: 'damage_share', label: 'Damage Share', field: 'damage_share' },
      { id: 'vision_per_minute', label: 'Vision / Minute', field: 'vision_per_minute' },
      { id: 'kill_participation', label: 'Kill Participation', field: 'kill_participation' },
    ],
  },
  {
    id: 'early',
    label: 'Early Game Advantage @ 15 min',
    metrics: [
      { id: 'gold_diff_at_15', label: 'Gold Difference @ 15', field: 'gold_diff_at_15' },
      { id: 'xp_diff_at_15', label: 'XP Difference @ 15', field: 'xp_diff_at_15' },
      { id: 'cs_diff_at_15', label: 'CS Difference @ 15', field: 'cs_diff_at_15' },
    ],
  },
  {
    id: 'dpm',
    label: 'DPM Analysis',
    metrics: [
      { id: 'dpm', label: 'Actual DPM', field: 'dpm' },
      { id: 'expected_dpm', label: 'Expected DPM', field: 'expected_dpm' },
      { id: 'season_role_baseline_dpm', label: 'Season role baseline DPM', field: 'season_role_baseline_dpm' },
      { id: 'baseline_dpm', label: 'Training role mean DPM', field: 'baseline_dpm' },
    ],
  },
];

export const SERIES_PALETTE = ['var(--accent)', 'var(--ember)', 'var(--side-blue)', 'var(--gold)', 'var(--accent-strong)'];

export const SERIES_META = {
  kills: { label: 'Kills' },
  deaths: { label: 'Deaths' },
  assists: { label: 'Assists' },
  kda: { label: 'KDA' },
  total_gold: { label: 'Total Gold' },
  total_cs: { label: 'Total CS' },
  damage: { label: 'Damage' },
  dpm: { label: 'Actual DPM' },
  expected_dpm: { label: 'Expected DPM' },
  season_role_baseline_dpm: { label: 'Season role baseline DPM' },
  baseline_dpm: { label: 'Training role mean DPM' },
  vision_per_minute: { label: 'Vision / Minute' },
  gold_share: { label: 'Gold Share' },
  damage_share: { label: 'Damage Share' },
  kill_participation: { label: 'Kill Participation' },
  gold_diff_at_15: { label: 'Gold Difference @ 15' },
  xp_diff_at_15: { label: 'XP Difference @ 15' },
  cs_diff_at_15: { label: 'CS Difference @ 15' },
};

const PERCENT_FIELDS = new Set(['gold_share', 'damage_share', 'kill_participation']);

export function findCategory(id) {
  return PLAYER_CHART_CATEGORIES.find((category) => category.id === id) ?? PLAYER_CHART_CATEGORIES[0];
}

export function colorForSeries(index) {
  return SERIES_PALETTE[index % SERIES_PALETTE.length];
}

export function formatChartValue(field, value) {
  if (value == null || !Number.isFinite(value)) return '—';
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
  const hint = 'Evaluated-game mean DPM vs model-expected DPM';
  if (actual == null || expected == null || !Number.isFinite(actual) || !Number.isFinite(expected) || expected === 0) {
    return {
      value: '—',
      hint: 'Not enough modeled games this season',
      tone: 'empty',
    };
  }
  const relative = (actual - expected) / expected;
  if (relative > DPM_FORM_BAND) {
    return { value: 'Above Expected', hint, tone: 'above' };
  }
  if (relative < -DPM_FORM_BAND) {
    return { value: 'Below Expected', hint, tone: 'below' };
  }
  return { value: 'As Expected', hint, tone: 'inline' };
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
