import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { h } from '../../utils/dom.js';
import { loadPairImpactContext } from './pair-impact-data.js?v=pair-heatmap5';
import { createPairHeatmapPanel } from './pair-impact-heatmap.js?v=pair-heatmap5';

export async function openPairImpactDrawer(origin) {
  const context = await loadPairImpactContext(origin);
  const selected =
    origin.selectedNames?.length
      ? origin.selectedNames.join(' · ')
      : origin.selectedPlayerIds?.join(' · ') || 'Awaiting selection';

  openDrawer({
    kicker: 'Shared feature',
    title: 'Pair impact',
    className: 'drawer--heatmap',
    body: h('div', {}, [
      createDrawerSection({
        title: 'Selected players',
        children: createMetaGrid([
          { label: 'Team', value: origin.teamName ?? '—' },
          { label: 'Players', value: selected },
        ]),
      }),
      createDrawerSection({
        title: 'Visualization',
        children: createPairHeatmapPanel({
          players: context.players,
          pairs: context.pairs,
          selectedIds: context.selectedPlayers,
          teamName: origin.teamName,
        }),
      }),
    ]),
  });
}
