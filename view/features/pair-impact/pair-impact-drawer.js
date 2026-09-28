import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { PLACEHOLDER } from '../../utils/constants.js';
import { loadLineupHeatmap, loadTeamHeatmap } from './pair-impact-data.js';
import { createPairHeatmapPanel } from './pair-impact-heatmap.js';

export async function openPairImpactDrawer({ lineupId, teamId, teamName, selectedIds }) {
  const heatmap = teamId ? await loadTeamHeatmap(teamId) : await loadLineupHeatmap(lineupId);
  const players = heatmap.players.map((player) => player.name).join(' · ');
  const highlighted = selectedIds?.length
    ? selectedIds
    : heatmap.players.map((player) => player.id);

  openDrawer({
    kicker: t('drawer.shared'),
    title: t('drawer.pair'),
    className: heatmap.players.length > 5 ? 'drawer--heatmap drawer--heatmap-wide' : 'drawer--heatmap',
    body: h('div', {}, [
      createDrawerSection({
        title: teamId ? t('drawer.roster') : t('drawer.selected'),
        children: createMetaGrid([
          { label: t('common.team'), value: teamName ?? PLACEHOLDER },
          { label: t('common.players'), value: players || PLACEHOLDER },
        ]),
      }),
      createDrawerSection({
        title: t('common.visualization'),
        children: createPairHeatmapPanel({
          heatmap,
          selectedIds: highlighted,
          teamName,
        }),
      }),
    ]),
  });
}
