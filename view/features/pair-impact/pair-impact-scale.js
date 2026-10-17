export const PAIR_HEATMAP_COLORS = ['#c35264', '#1c2a40', '#3ec8ff'];

// Include every colored cell, including pairs below the display threshold.
// The minimum keeps empty and all-zero panels on a useful, nondegenerate scale.
export function sharedPairHeatmapLimit(heatmaps) {
  let limit = 0.15;
  for (const heatmap of heatmaps) {
    for (const cell of heatmap?.cells ?? []) {
      if (Number.isFinite(cell.value)) limit = Math.max(limit, Math.abs(cell.value));
    }
  }
  return limit;
}
