/**
 * Image mapping for Style 1.
 *
 * Later, point team IDs / player IDs at real files under data/img/
 * without changing UI components. Unmapped IDs use the placeholders.
 *
 * TEAM_LOGOS example:
 *   'oe:team:d356a144644879dabb5f34cd99c886d': 'blg.png',
 *   'BLG': 'blg.png',
 *
 * PLAYER_IMAGES example:
 *   'oe:player:0d9b0a3b3a93a8f759c9d8ac8eef97c': 'breathe.png',
 *   'Breathe': 'breathe.png',
 *
 * Values may be a filename in the folder, or a path like data/img/team/blg.png.
 */
const IMG_ROOT = new URL('../../data/img/', import.meta.url);

export const TEAM_LOGO_FALLBACK = new URL('team/cat_zw.png', IMG_ROOT).href;
export const PLAYER_IMAGE_FALLBACK = new URL('player/cat_zw.png', IMG_ROOT).href;

export const TEAM_LOGOS = {
  // 'blg': 'blg.png',
};

export const PLAYER_IMAGES = {
  // 'bin': 'bin.png',
};

function lookup(map, keys) {
  for (const key of keys) {
    if (key == null || key === '') continue;
    const direct = map[key];
    if (direct) return direct;
    const lower = map[String(key).toLowerCase()];
    if (lower) return lower;
  }
  return null;
}

function assetUrl(folder, file, fallback) {
  if (!file) return fallback;
  try {
    if (file.startsWith('data/img/')) {
      return new URL(`../../${file}`, import.meta.url).href;
    }
    if (file.includes('/')) {
      return new URL(file, IMG_ROOT).href;
    }
    return new URL(`${folder}/${file}`, IMG_ROOT).href;
  } catch {
    return fallback;
  }
}

export function teamLogoUrl(team) {
  const keys =
    team && typeof team === 'object' ? [team.id, team.short, team.name] : [team];
  return assetUrl('team', lookup(TEAM_LOGOS, keys), TEAM_LOGO_FALLBACK);
}

export function playerImageUrl(player) {
  const keys =
    player && typeof player === 'object' ? [player.id, player.name] : [player];
  return assetUrl('player', lookup(PLAYER_IMAGES, keys), PLAYER_IMAGE_FALLBACK);
}

export function bindImageFallback(img, fallback) {
  img.addEventListener('error', () => {
    if (img.dataset.fallbackApplied === 'true') return;
    img.dataset.fallbackApplied = 'true';
    img.src = fallback;
  });
}
