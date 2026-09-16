import { closeDrawer } from './components/drawers/drawer.js';
import { renderSiteHeader } from './components/navigation/site-header.js';
import { renderHomePage } from './pages/home/home-page.js';
import { renderLineupCataloguePage } from './pages/lineup/lineup-catalogue-page.js';
import { renderLineupPage } from './pages/lineup/lineup-page.js';
import { renderNotFound } from './pages/not-found.js';
import { renderPlayerCataloguePage } from './pages/player/player-catalogue-page.js';
import { renderPlayerPage } from './pages/player/player-page.js';
import { renderTeamPage } from './pages/team/team-page.js';
import { h } from './utils/dom.js';
import { startRouter } from './utils/navigation.js';

const header = document.querySelector('#site-header');
const app = document.querySelector('#app');

async function render(route) {
  closeDrawer();
  renderSiteHeader(header, route.name);
  app.replaceChildren();

  try {
    if (route.name === 'home') await renderHomePage(app);
    else if (route.name === 'players') await renderPlayerCataloguePage(app);
    else if (route.name === 'player') await renderPlayerPage(app, route.id);
    else if (route.name === 'lineups') await renderLineupCataloguePage(app);
    else if (route.name === 'lineup') await renderLineupPage(app, route.id);
    else if (route.name === 'team') await renderTeamPage(app, route.id);
    else renderNotFound(app);
  } catch (error) {
    console.error(error);
    app.replaceChildren(
      h('div', { class: 'page' }, [
        h('p', { class: 'notice' }, ['Terminal failed to load this file. See console.']),
      ]),
    );
  }

  window.scrollTo(0, 0);
}

startRouter(render);
