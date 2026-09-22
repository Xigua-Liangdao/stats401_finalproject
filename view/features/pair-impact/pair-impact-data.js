import { dataSource } from '../../utils/data-source.js';

export async function loadLineupHeatmap(lineupId) {
  const heatmap = await dataSource.getLineupAffinity(lineupId);
  if (!heatmap) throw new Error(`No affinity_score found for lineup ${lineupId}.`);
  return heatmap;
}
