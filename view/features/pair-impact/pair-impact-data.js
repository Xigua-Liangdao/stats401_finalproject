import { dataSource } from '../../utils/data-source.js';

export const PAIR_STAT_CARDS = [
  { key: 'n_games', field: 'n_games', format: 'count', label: 'Games together', hint: 'Evaluated pair-games' },
  { key: 'win_rate', field: 'win_rate', format: 'percent', label: 'Win rate', hint: 'Evaluated games won' },
  { key: 'mean_impact', field: 'mean_impact', format: 'impact', label: 'Mean impact', hint: 'Unshrunk co-performance' },
  { key: 'shrunk_impact', field: 'shrunk_impact', format: 'impact', label: 'Shrunk impact', hint: 'Stabilized co-performance' },
];

export async function loadPairImpactContext(origin) {
  const ids = origin.selectedPlayerIds ?? [];
  const pairs =
    origin.source === 'lineup'
      ? await dataSource.listPairsForPlayers(ids, origin.teamId)
      : await dataSource.listPairsForPlayer(ids[0], origin.teamId);

  const context = {
    origin,
    selectedPlayers: ids,
    pairs,
    focus: pairs[0] ?? null,
  };
  console.info('[data] pair impact', {
    source: origin.source,
    teamId: origin.teamId,
    selected: ids.length,
    pairs: pairs.length,
    file: 'pairs.csv',
  });
  return context;
}
