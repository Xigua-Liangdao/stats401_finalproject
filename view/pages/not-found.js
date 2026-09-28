import { createPageShell } from '../components/layout/page-shell.js';
import { t } from '../utils/i18n.js';
import { href } from '../utils/navigation.js';
import { createButton } from '../components/buttons/button.js';

export function renderNotFound(target) {
  target.append(
    createPageShell({
      kicker: '404',
      title: t('notFound.kicker'),
      meta: [t('notFound.title')],
      actions: [createButton({ label: t('nav.returnHome'), href: href.home, variant: 'accent' })],
      breadcrumbs: [{ label: t('nav.home'), href: href.home }, { label: t('notFound.crumb') }],
      children: null,
    }),
  );
}
