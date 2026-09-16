import { ELIGIBLE_NOTICE } from '../../utils/constants.js';
import { h } from '../../utils/dom.js';

export function createEligibilityNotice(eligible, entity = 'record') {
  if (eligible) return null;
  return h('p', { class: 'notice' }, [
    `This ${entity}'s data is not eligible for analysis. ${ELIGIBLE_NOTICE}`,
  ]);
}
