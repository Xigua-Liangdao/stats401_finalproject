import { createDrawerSection, createMetaGrid } from '../../components/drawers/drawer-section.js';
import { openDrawer } from '../../components/drawers/drawer.js';
import { createStatGrid } from '../../components/cards/stat-card.js';
import { createVizPlaceholder } from '../../components/cards/viz-placeholder.js';
import { h } from '../../utils/dom.js';
import { loadPairImpactContext } from './pair-impact-data.js';

export function openPairImpactDrawer(origin) {
  const context = loadPairImpactContext(origin);
  const selected =
    origin.selectedNames?.length
      ? origin.selectedNames.join(' · ')
      : origin.selectedPlayerIds?.join(' · ') || 'Awaiting selection';

  openDrawer({
    kicker: 'Shared feature',
    title: 'Pair impact',
    body: h('div', {}, [
      h('p', { class: 'notice' }, [context.note]),
      createDrawerSection({
        title: 'Selected players',
        children: createMetaGrid([
          { label: 'Origin', value: origin.source },
          { label: 'Team', value: origin.teamName ?? '—' },
          { label: 'Players', value: selected },
          { label: 'Mode', value: 'Placeholder' },
        ]),
      }),
      createDrawerSection({
        title: 'Predicted vs actual',
        children: createStatGrid([
          { label: 'Predicted', hint: 'Context model later', value: context.predicted },
          { label: 'Actual', hint: 'Observed later', value: context.actual },
          { label: 'Pair impact', hint: 'Score later', value: context.score },
          { label: 'Sample', hint: 'Games together', value: '—' },
        ]),
      }),
      createDrawerSection({
        title: 'Visualization',
        children: createVizPlaceholder({
          vizId: 'pair-impact',
          index: 'VIZ',
          title: 'Pair impact stage',
          description: 'Predicted versus actual co-performance will render here.',
        }),
      }),
      h('p', { class: 'muted' }, [
        'Opened from both player and lineup pages. One implementation, reused.',
      ]),
    ]),
  });
}
