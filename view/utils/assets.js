/** Historical media, shared by data/test and data/processed. */
import { t } from './i18n.js';

const IMG_ROOT = new URL('../../data/img/', import.meta.url);

export const TEAM_LOGO_FALLBACK = new URL('team/unknown.svg', IMG_ROOT).href;
export const PLAYER_IMAGE_FALLBACK = new URL('player/unknown.svg', IMG_ROOT).href;

let teams = new Map();
let players = new Map();
let mediaPromise;

const teamKey = (league, season, teamId) => `${league}|${season}|${teamId}`;
const playerKey = (league, season, teamId, playerId) => `${league}|${season}|${teamId}|${playerId}`;
const splitNumber = (split) => Number(/^Split ([1-3])(?: Placements)?$/.exec(split)?.[1]) || null;

export function setMedia(media) {
  if (media.schema_version !== 1) throw new Error('Unsupported media.json version');
  // The existing v1 archive is LPL-only; newer media can specify its league.
  teams = new Map(media.teams.map((item) => [teamKey(item.league ?? 'LPL', item.season, item.team_id), item]));
  players = new Map();
  for (const item of media.players) {
    const key = playerKey(item.league ?? 'LPL', item.season, item.team_id, item.player_id);
    if (!players.has(key)) players.set(key, []);
    players.get(key).push(item);
  }
}

export function loadMedia() {
  if (!mediaPromise) {
    const mediaUrl = new URL('media.json', IMG_ROOT);
    mediaUrl.search = new URL(import.meta.url).search;
    mediaPromise = fetch(mediaUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Failed to load media.json (${response.status})`);
      setMedia(await response.json());
    });
  }
  return mediaPromise;
}

export function teamLogoAsset(team) {
  return teams.get(teamKey(team?.league ?? 'LPL', team?.season, team?.id)) ?? null;
}

export function playerImageAsset(player) {
  const season = player?.season ?? player?.team?.season;
  const teamId = player?.teamId ?? player?.team?.id;
  const league = player?.league ?? player?.team?.league ?? 'LPL';
  const candidates = players.get(playerKey(league, season, teamId, player?.id)) ?? [];
  // Catalogues summarize the year. Only an explicit player.split represents a
  // split filter; team.split in team_panel.csv is the team's most common split.
  const split = splitNumber(player?.split);
  if (player?.split && !split) return null;
  return [...candidates]
    .filter((item) => !split || splitNumber(item.source_split) <= split)
    .sort((a, b) => splitNumber(b.source_split) - splitNumber(a.source_split))[0] ?? null;
}

export function teamLogoUrl(team) {
  const asset = teamLogoAsset(team);
  return asset ? new URL(asset.path, IMG_ROOT).href : TEAM_LOGO_FALLBACK;
}

export function playerImageUrl(player) {
  const asset = playerImageAsset(player);
  return asset ? new URL(asset.path, IMG_ROOT).href : PLAYER_IMAGE_FALLBACK;
}

export function bindImageFallback(img, fallback) {
  img.addEventListener('error', () => {
    if (img.dataset.fallbackApplied === 'true') return;
    img.dataset.fallbackApplied = 'true';
    img.title = t('player.imageMissing');
    img.src = fallback;
  });
}
