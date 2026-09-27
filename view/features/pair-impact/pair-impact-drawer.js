import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { h } from '../../utils/dom.js';
import { loadLineupHeatmap, loadTeamHeatmap } from './pair-impact-data.js';
import { createPairHeatmapPanel } from './pair-impact-heatmap.js';

export async function openPairImpactDrawer({ lineupId, teamId, teamName, selectedIds }) {
  const heatmap = teamId ? await loadTeamHeatmap(teamId) : await loadLineupHeatmap(lineupId);
  const players = heatmap.players.map((player) => player.name).join(' · ');
  const highlighted = selectedIds?.length
    ? selectedIds
    : heatmap.players.map((player) => player.id);

  openDrawer({
    kicker: 'Shared feature',
    title: 'Pair impact',
    className: heatmap.players.length > 5 ? 'drawer--heatmap drawer--heatmap-wide' : 'drawer--heatmap',
    body: h('div', {}, [
      createDrawerSection({
        title: teamId ? 'Team roster' : 'Selected players',
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
