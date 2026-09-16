import { createPageShell } from '../components/layout/page-shell.js';
import { href } from '../utils/navigation.js';
import { createButton } from '../components/buttons/button.js';

export function renderNotFound(target) {
  target.append(
    createPageShell({
      kicker: '404',
      title: 'File missing',
      meta: ['No matching entity in the mock catalog'],
      actions: [createButton({ label: 'Return home', href: href.home, variant: 'accent' })],
      breadcrumbs: [{ label: 'Home', href: href.home }, { label: 'Not found' }],
      children: null,
    }),
  );
}
