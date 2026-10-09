import { createPlayerPortrait, createTeamLogo } from '../../components/media/entity-images.js';
import { dataSource } from '../../utils/data-source.js';
import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { formatCount, formatFixed, formatImpact, formatPercent, formatRole } from '../../utils/formatting.js';
import { href } from '../../utils/navigation.js';
import { getSelectedDataset } from '../../utils/season.js';

const TOP_TEAM_COUNT = 6;

function countEligible(items) {
  return items.filter((item) => item.stats?.eligible).length;
}

function sidedGames(teams, field) {
  const total = teams.reduce((sum, team) => sum + (team.stats?.[field] ?? 0), 0);
  return total / 2;
}

function forSeason(catalog, season) {
  const teams = catalog.teams.filter((team) => String(team.season) === String(season));
  const teamIds = new Set(teams.map((team) => team.id));
  return {
    season,
    teams,
    players: catalog.players.filter((player) => String(player.season) === String(season) && teamIds.has(player.teamId)),
    lineups: catalog.lineups.filter((lineup) => teamIds.has(lineup.teamId)),
  };
}

function topPlayer(players) {
  return [...players]
    .filter((player) => player.stats?.eligible && player.stats.win_rate != null)
    .sort((a, b) => {
      const win = (b.stats.win_rate ?? -1) - (a.stats.win_rate ?? -1);
      if (win) return win;
      const games = (b.stats.n_games ?? -1) - (a.stats.n_games ?? -1);
      if (games) return games;
      return a.name.localeCompare(b.name);
    })[0] ?? null;
}

function rankedTeams(teams) {
  return [...teams].sort((a, b) => {
    const win = (b.stats?.win_rate ?? -1) - (a.stats?.win_rate ?? -1);
    if (win) return win;
    const games = (b.stats?.n_games ?? -1) - (a.stats?.n_games ?? -1);
    if (games) return games;
    return a.name.localeCompare(b.name);
  });
}

function shareText(part, whole, suffix) {
  if (!whole) return suffix;
  return `${formatPercent(part / whole)} ${suffix}`;
}

const METRIC_MARKS = {
  teams: '<path d="M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z"/>',
  players: '<circle cx="8" cy="4.6" r="2.1"/><path d="M3.2 13.2c.7-2.5 2.4-3.7 4.8-3.7s4.1 1.2 4.8 3.7"/>',
  lineups: '<path d="M1.6 3.2v9.6M4.7 5v7.8M7.8 3.2v9.6M10.9 5v7.8M14 3.2v9.6"/>',
  games: '<path d="M8 2.2 13.8 8 8 13.8 2.2 8z"/>',
};

function metricMark(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'home-metric__icon');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = METRIC_MARKS[kind];
  return svg;
}

export function overviewItems(view, dataset = {}) {
  const players = new Set(view.players.map((player) => player.id)).size;
  const eligiblePlayers = new Set(view.players.filter((player) => player.stats?.eligible).map((player) => player.id)).size;
  const lineups = view.lineups.length;
  const games = dataset.games ?? sidedGames(view.teams, 'n_games_total');
  const evaluated = sidedGames(view.teams, 'n_games');
  return [
    ['teams', t('common.teams'), formatCount(view.teams.length), t('home.season', { season: view.season })],
    ['players', t('common.players'), formatCount(players), shareText(eligiblePlayers, players, t('home.eligible'))],
    ['lineups', t('common.lineups'), formatCount(lineups), shareText(countEligible(view.lineups), lineups, t('home.eligible'))],
    ['games', t('common.games'), formatCount(games), t('home.evaluationCoverage', {
      count: formatCount(evaluated), share: games ? formatPercent(evaluated / games) : '—',
    })],
  ];
}

export function championTeam(teams, dataset) {
  const champion = dataset?.champion;
  if (!champion) return null;
  const id = typeof champion === 'object' ? champion.team_id : null;
  const name = typeof champion === 'string' ? champion : champion.name;
  return teams.find((team) => (id && team.id === id) || (name && team.sourceName === name)) ?? null;
}

function createChampion(team) {
  if (!team) return h('section', { class: 'home-champion panel' }, [
    h('div', { class: 'home-champion__kicker coord' }, [t('home.champion')]),
    h('p', { class: 'home-champion__meta' }, [t('home.championMissing')]),
  ]);
  return h('a', { class: 'home-champion panel', href: href.team(team.id) }, [
    h('div', { class: 'home-champion__kicker coord' }, [t('home.champion')]),
    createTeamLogo(team),
    h('div', { class: 'home-champion__name display' }, [team.name]),
    h('p', { class: 'home-champion__meta' }, [
      t('home.championLine', {
        rate: formatPercent(team.stats?.win_rate),
        games: formatCount(team.stats?.n_games),
      }),
    ]),
  ]);
}

function playerFacts(player) {
  const stats = player.stats ?? {};
  return [
    [t('common.winRate'), formatPercent(stats.win_rate)],
    [t('home.evaluated'), formatCount(stats.n_games)],
    [t('common.dpm'), formatFixed(stats.mean_dpm, 0)],
    [t('common.goldShare'), formatPercent(stats.mean_gold_share)],
    [t('common.shrunkImpact'), formatImpact(stats.shrunk_impact)],
  ];
}

function createTopPlayer(player) {
  if (!player) return null;
  const playerHref = href.player(player.id, player.teamId, player.season);
  const teamName = player.team?.name;
  return h('section', { class: 'home-player' }, [
    h('h2', { class: 'section-block__title' }, [t('home.topPlayer')]),
    h('article', { class: 'home-player__card' }, [
      h('a', { class: 'home-player__photo', href: playerHref }, [
        createPlayerPortrait(player),
      ]),
      h('div', { class: 'home-player__copy' }, [
        h('a', { class: 'home-player__name display', href: playerHref }, [player.name]),
        h('p', { class: 'home-player__team' }, [
          [teamName, formatRole(player.role)].filter(Boolean).join(' · '),
        ]),
      ]),
      h('dl', { class: 'home-player__facts' }, playerFacts(player).map(([label, value]) => (
        h('div', {}, [h('dd', {}, [value]), h('dt', {}, [label])])
      ))),
    ]),
  ]);
}

function createTeamCard(team, index) {
  return h('a', { class: 'home-team', href: href.team(team.id) }, [
    h('span', { class: 'home-team__rank' }, [String(index + 1).padStart(2, '0')]),
    createTeamLogo(team),
    h('span', { class: 'home-team__name' }, [team.name]),
    h('span', { class: 'home-team__meta' }, [
      t('home.teamMeta', {
        rate: formatPercent(team.stats?.win_rate),
        count: formatCount(team.stats?.n_games),
      }),
    ]),
  ]);
}

export async function renderHomePage(target) {
  const catalog = await dataSource.loadCatalog();
  const dataset = catalog.dataset ?? getSelectedDataset();
  const season = dataset?.year ?? catalog.season;
  const view = forSeason(catalog, season);
  const ranked = rankedTeams(view.teams);

  target.append(
    h('div', { class: 'home' }, [
      h('section', { class: 'home-hero' }, [
        h('div', { class: 'home-hero__copy' }, [
          h('div', { class: 'kicker' }, [t('app.kicker', { league: dataset.league, year: season })]),
          h('h1', { class: 'home-title display' }, [t('home.title')]),
          h('p', { class: 'home-sub' }, [t('home.lead', { league: dataset.league, year: season })]),
          h('p', { class: 'home-sub' }, [t('dataset.coverage', {
            start: dataset.date_start?.slice(0, 10) ?? '—',
            end: dataset.date_end?.slice(0, 10) ?? '—',
          })]),
        ]),
        createChampion(championTeam(view.teams, dataset)),
      ]),
      h('section', { class: 'home-overview', 'aria-label': t('home.overview') }, [
        h('dl', {}, overviewItems(view, dataset).map(([kind, label, value, note]) => (
          h('div', { class: 'home-metric' }, [
            h('div', { class: 'home-metric__head' }, [
              metricMark(kind),
              h('dt', {}, [label]),
            ]),
            h('dd', {}, [value]),
            h('p', { class: 'home-overview__note' }, [note]),
          ])
        ))),
      ]),
      createTopPlayer(topPlayer(view.players)),
      h('section', { class: 'home-teams' }, [
        h('div', { class: 'home-teams__head' }, [
          h('h2', { class: 'section-block__title' }, [t('home.topTeams')]),
        ]),
        h('div', { class: 'home-teams__row' }, ranked.slice(0, TOP_TEAM_COUNT).map(createTeamCard)),
        h('a', { class: 'home-more', href: href.players }, [t('nav.seeMore')]),
      ]),
    ]),
  );
}
