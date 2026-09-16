import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { createVizPlaceholder } from '../../components/cards/viz-placeholder.js';
import { h } from '../../utils/dom.js';
import { loadPairImpactContext } from './pair-impact-data.js';

export async function openPairImpactDrawer(origin) {
  await loadPairImpactContext(origin);
  const selected =
    origin.selectedNames?.length
      ? origin.selectedNames.join(' · ')
      : origin.selectedPlayerIds?.join(' · ') || 'Awaiting selection';

  // Visualization stage only: pair rows are loaded but not listed here.
  openDrawer({
    kicker: 'Shared feature',
    title: 'Pair impact',
    body: h('div', {}, [
      createDrawerSection({
        title: 'Selected players',
        children: createMetaGrid([
          { label: 'Origin', value: origin.source },
          { label: 'Team', value: origin.teamName ?? '—' },
          { label: 'Players', value: selected },
        ]),
      }),
      createDrawerSection({
        title: 'Visualization',
        children: createVizPlaceholder({
          vizId: 'pair-impact',
          index: 'VIZ',
          title: 'Pair impact stage',
          description: 'Pair scores will surface from this stage once the visualization is mounted.',
        }),
      }),
    ]),
  });
}
