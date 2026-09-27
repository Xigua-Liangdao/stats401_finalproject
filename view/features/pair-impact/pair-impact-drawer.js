import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { h } from '../../utils/dom.js';
import { loadLineupHeatmap } from './pair-impact-data.js';
import { createPairHeatmapPanel } from './pair-impact-heatmap.js';

export async function openPairImpactDrawer({ lineupId, teamName, selectedIds }) {
  const heatmap = await loadLineupHeatmap(lineupId);
  const players = heatmap.players.map((player) => player.name).join(' · ');
  const highlighted = selectedIds?.length
    ? selectedIds
    : heatmap.players.map((player) => player.id);

  openDrawer({
    kicker: 'Shared feature',
    title: 'Pair impact',
    className: 'drawer--heatmap',
    body: h('div', {}, [
      createDrawerSection({
        title: 'Selected players',
        children: createMetaGrid([
          { label: 'Team', value: teamName ?? '—' },
          { label: 'Players', value: players || '—' },
        ]),
      }),
      createDrawerSection({
        title: 'Visualization',
        children: createPairHeatmapPanel({
          heatmap,
          selectedIds: highlighted,
          teamName,
        }),
      }),
    ]),
  });
}
