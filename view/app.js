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
import { datasetRequestForRoute, navigate, routeAfterDatasetChange, routeHref, startRouter } from './utils/navigation.js?v=catalogue-back';
import { leagueOptions, loadDatasetManifest, seasonOptions, setDatasetSelection } from './utils/season.js';
import { dataSource } from './utils/data-source.js';
import { createRouteTransition, shouldPlayRouteWipe } from './utils/route-transition.js';

applyDocumentCopy();

const header = document.querySelector('#site-header');
const app = document.querySelector('#app');
const wipe = document.querySelector('#route-wipe');
const transition = createRouteTransition(app, wipe);
const startup = createStartupScreen(document.querySelector('#startup'));
let currentRoute = { name: 'home' };
let startupFinished = false;
let renderGeneration = 0;

function replaceRoute(route, entry) {
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}${routeHref(route, entry)}`);
}

async function entityExists(route) {
  if (route.name === 'player') return Boolean(await dataSource.getPlayer(route.id, route.teamId, route.year ?? route.season));
  if (route.name === 'team') return Boolean(await dataSource.getTeam(route.id));
  if (route.name === 'lineup') return Boolean(await dataSource.getLineup(route.id));
  return true;
}

async function render(route) {
  const generation = ++renderGeneration;
  const isCurrent = () => generation === renderGeneration;
  closeDrawer();
  const previousName = currentRoute.name;

  try {
    const manifest = await loadDatasetManifest();
    if (!isCurrent()) return;
    // Old season-only links describe the original LPL dataset, regardless of a
    // later saved choice. New links always carry both league and year.
    const request = datasetRequestForRoute(route, manifest.default);
    const entry = setDatasetSelection(request);
    const unavailableRequest = (route.league && route.league !== entry.league)
      || (route.year && String(route.year) !== String(entry.year));
    let notice = unavailableRequest ? t('dataset.selectionMissing') : null;
    if (unavailableRequest && ['player', 'team', 'lineup'].includes(route.name)) {
      route = { name: 'players', page: 1 };
    }
    currentRoute = { ...route, league: entry.league, year: String(entry.year) };
    if (currentRoute.name === 'player') currentRoute.season = String(entry.year);
    replaceRoute(currentRoute, entry);

    const changeDataset = (request) => {
      const next = setDatasetSelection(request);
      navigate(routeHref(routeAfterDatasetChange(currentRoute), next));
    };
    renderSiteHeader(header, currentRoute.name, {
      leagues: leagueOptions(manifest),
      datasets: manifest.datasets,
      seasons: seasonOptions(entry.league, manifest),
      selection: entry,
      onLeagueChange: (league) => changeDataset({ league }),
      onSeasonChange: (year) => changeDataset({ league: entry.league, year }),
      onLanguageChange: (id) => {
        if (setLanguage(id)) render(currentRoute);
      },
    });

    if (entry.status === 'ready' && !(await entityExists(currentRoute))) {
      if (!isCurrent()) return;
      currentRoute = { name: 'players', page: 1, league: entry.league, year: String(entry.year) };
      replaceRoute(currentRoute, entry);
      notice = t('dataset.entityMissing');
    }
    if (!isCurrent()) return;
    const renderedRoute = { ...currentRoute };
    const cinematic = shouldPlayRouteWipe(previousName, renderedRoute.name);
    await transition(async (target) => {
      if (entry.status !== 'ready') {
        target.append(h('div', { class: 'page' }, [
          h('h1', {}, [t('dataset.unavailable')]),
          h('p', { class: 'notice', role: 'status' }, [entry.reason || t('dataset.unavailableReason')]),
        ]));
        return;
      }
      if (notice) target.append(h('p', { class: 'notice dataset-notice', role: 'status' }, [notice]));
      if (entry.model_status === 'insufficient_history') {
        target.append(h('p', { class: 'notice dataset-notice', role: 'status' }, [t('dataset.noModel')]));
      }
      try {
        if (renderedRoute.name === 'home') await renderHomePage(target);
        else if (renderedRoute.name === 'compare') await renderComparisonPage(target);
        else if (renderedRoute.name === 'players') await renderPlayerCataloguePage(target, renderedRoute.page);
        else if (renderedRoute.name === 'player') await renderPlayerPage(target, renderedRoute.id, renderedRoute.teamId, renderedRoute.year);
        else if (renderedRoute.name === 'lineup') await renderLineupPage(target, renderedRoute.id);
        else if (renderedRoute.name === 'team') await renderTeamPage(target, renderedRoute.id);
        else renderNotFound(target);
      } catch (error) {
        console.error(error);
        target.replaceChildren(
          h('div', { class: 'page' }, [
            h('p', { class: 'notice' }, [t('app.loadFailed')]),
          ]),
        );
      }
    }, { cinematic, isCurrent });
  } catch (error) {
    if (!isCurrent()) return;
    console.error(error);
    app.replaceChildren(h('div', { class: 'page' }, [h('p', { class: 'notice' }, [t('app.loadFailed')])]));
  } finally {
    if (!startupFinished && isCurrent()) {
      startupFinished = true;
      await startup.finish();
    }
  }
}

startRouter(render);
