import { trackEvent } from '../analytics/index.js';
import { closeDrawer } from './components/drawers/drawer.js';
import { createStartupScreen } from './components/layout/startup-screen.js';
import { renderSiteHeader } from './components/navigation/site-header.js';
import { renderComparisonPage } from './pages/comparison/comparison-page.js';
import { renderHomePage } from './pages/home/home-page.js';
import { renderLineupPage } from './pages/lineup/lineup-page.js?v=catalogue-back';
import { renderNotFound } from './pages/not-found.js';
import { renderPlayerCataloguePage } from './pages/player/player-catalogue-page.js?v=catalogue-back';
import { renderPlayerPage } from './pages/player/player-page.js?v=scale-zoom';
import { renderTeamPage } from './pages/team/team-page.js';
import { h } from './utils/dom.js';
import { applyDocumentCopy, setLanguage, t } from './utils/i18n.js';
import { startRouter } from './utils/navigation.js?v=catalogue-back';
import { ensureSeason, seasonOptions, setSelectedSeason } from './utils/season.js';
import { createRouteTransition, shouldPlayRouteWipe } from './utils/route-transition.js';

applyDocumentCopy();

// Temporary startup insert to verify the tracker. Not tied to a UI control.
trackEvent({
  event_name: 'click',
  page: 'home',
  target_type: 'analytics_test',
  target_id: 'supabase_connection_test',
  metadata: {
    source: 'manual_tracker_test',
  },
});

const header = document.querySelector('#site-header');
const app = document.querySelector('#app');
const wipe = document.querySelector('#route-wipe');
const transition = createRouteTransition(app, wipe);
const startup = createStartupScreen(document.querySelector('#startup'));
let currentRoute = { name: 'home' };
let booted = false;

async function render(route) {
  const opening = !booted;
  booted = true;
  closeDrawer();
  const seasons = seasonOptions();
  const season = ensureSeason(seasons);
  const previousName = currentRoute.name;
  currentRoute = route;
  renderSiteHeader(header, route.name, {
    seasons,
    season,
    onSeasonChange: (value) => {
      setSelectedSeason(value);
      if (currentRoute.name === 'home') render({ name: 'home' });
    },
    onLanguageChange: (id) => {
      if (!setLanguage(id)) return;
      render(currentRoute);
    },
  });
  const cinematic = shouldPlayRouteWipe(previousName, route.name);

  try {
    await transition(async (target) => {
      try {
        if (route.name === 'home') await renderHomePage(target);
        else if (route.name === 'compare') await renderComparisonPage(target);
        else if (route.name === 'players') await renderPlayerCataloguePage(target, route.page);
        else if (route.name === 'player') await renderPlayerPage(target, route.id, route.teamId, route.season);
        else if (route.name === 'lineup') await renderLineupPage(target, route.id);
        else if (route.name === 'team') await renderTeamPage(target, route.id);
        else renderNotFound(target);
      } catch (error) {
        console.error(error);
        target.replaceChildren(
          h('div', { class: 'page' }, [
            h('p', { class: 'notice' }, [t('app.loadFailed')]),
          ]),
        );
      }
    }, { cinematic });
  } finally {
    if (opening) await startup.finish();
  }
}

startRouter(render);
