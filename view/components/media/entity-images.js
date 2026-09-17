import { h } from '../../utils/dom.js';
import {
  PLAYER_IMAGE_FALLBACK,
  TEAM_LOGO_FALLBACK,
  bindImageFallback,
  playerImageUrl,
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
  const img = h('img', {
    class: 'entity-image entity-image--portrait',
    src: playerImageUrl(player),
    alt: player?.name ? player.name : 'Player portrait',
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
