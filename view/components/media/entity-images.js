import { h } from '../../utils/dom.js';
import {
  PLAYER_IMAGE_FALLBACK,
  TEAM_LOGO_FALLBACK,
  bindImageFallback,
  playerImageUrl,
  playerImageAsset,
  teamLogoUrl,
} from '../../utils/assets.js';

export function createTeamLogo(team) {
  const img = h('img', {
    class: 'entity-image entity-image--logo',
    src: teamLogoUrl(team),
    alt: team?.name ? `${team.name} logo` : 'Team logo',
    draggable: 'false',
  });
  bindImageFallback(img, TEAM_LOGO_FALLBACK);
  return h('div', { class: 'identity-mark identity-mark--logo' }, [img]);
}

export function createPlayerPortrait(player, { variant = 'slot' } = {}) {
  const asset = playerImageAsset(player);
  const img = h('img', {
    class: 'entity-image entity-image--portrait',
    src: playerImageUrl(player),
    alt: player?.name ? player.name : 'Player portrait',
    title: asset
      ? `${asset.player} · ${asset.team_short} · ${asset.season} ${asset.source_split} photo (Leaguepedia)`
      : 'Season/team photo unavailable',
    draggable: 'false',
  });
  bindImageFallback(img, PLAYER_IMAGE_FALLBACK);

  const className =
    variant === 'hero'
      ? 'player-portrait player-portrait--hero'
      : variant === 'mini'
        ? 'player-portrait player-portrait--mini'
        : 'player-portrait';

  return h('div', { class: className }, [img]);
}
