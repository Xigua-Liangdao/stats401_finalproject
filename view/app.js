import { closeDrawer } from './components/drawers/drawer.js';
import { renderSiteHeader } from './components/navigation/site-header.js';
import { renderHomePage } from './pages/home/home-page.js';
import { renderLineupCataloguePage } from './pages/lineup/lineup-catalogue-page.js?v=catalogue-back';
import { renderLineupPage } from './pages/lineup/lineup-page.js?v=catalogue-back';
import { renderNotFound } from './pages/not-found.js';
import { renderPlayerCataloguePage } from './pages/player/player-catalogue-page.js?v=catalogue-back';
import { renderPlayerPage } from './pages/player/player-page.js?v=scale-zoom';
import { renderTeamPage } from './pages/team/team-page.js';
import { h } from './utils/dom.js';
import { startRouter } from './utils/navigation.js?v=catalogue-back';
import { createRouteTransition, shouldPlayRouteWipe } from './utils/route-transition.js';

const header = document.querySelector('#site-header');
const app = document.querySelector('#app');
const wipe = document.querySelector('#route-wipe');
const transition = createRouteTransition(app, wipe);
let currentRouteName = null;

async function render(route) {
  closeDrawer();
  renderSiteHeader(header, route.name);
  const cinematic = shouldPlayRouteWipe(currentRouteName, route.name);
  currentRouteName = route.name;

  await transition(async (target) => {
    try {
      if (route.name === 'home') await renderHomePage(target);
      else if (route.name === 'players') await renderPlayerCataloguePage(target, route.page);
      else if (route.name === 'player') await renderPlayerPage(target, route.id);
      else if (route.name === 'lineups') await renderLineupCataloguePage(target, route.page);
      else if (route.name === 'lineup') await renderLineupPage(target, route.id);
      else if (route.name === 'team') await renderTeamPage(target, route.id);
      else renderNotFound(target);
    } catch (error) {
      console.error(error);
      target.replaceChildren(
        h('div', { class: 'page' }, [
          h('p', { class: 'notice' }, ['Terminal failed to load this file. See console.']),
        ]),
      );
    }
  }, { cinematic });
}

startRouter(render);
