import { h } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';

export function createEligibilityNotice(eligible, entity = 'record') {
  if (eligible) return null;
  return h('p', { class: 'notice' }, [
    t('eligible.record', { entity: t(`eligible.entity.${entity}`), notice: t('eligible.notice') }),
  ]);
}
