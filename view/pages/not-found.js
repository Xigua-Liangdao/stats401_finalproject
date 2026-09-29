import { createPageShell } from '../components/layout/page-shell.js';
import { t } from '../utils/i18n.js';
import { href } from '../utils/navigation.js';
import { createButton } from '../components/buttons/button.js';
import { routeTargetId } from '../utils/track.js';

export function renderNotFound(target) {
  target.append(
    createPageShell({
      kicker: '404',
      title: t('notFound.kicker'),
      meta: [t('notFound.title')],
      actions: [createButton({
        label: t('nav.returnHome'),
        href: href.home,
        variant: 'accent',
        track: {
          event_name: 'click',
          target_type: 'nav_link',
          target_id: routeTargetId(href.home),
        },
      })],
      breadcrumbs: [{ label: t('nav.home'), href: href.home }, { label: t('notFound.crumb') }],
      children: null,
    }),
  );
}
