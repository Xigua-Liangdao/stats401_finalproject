import { t } from './i18n.js';

export const DATASET = 'processed';
export const DATASET_MODE = DATASET;

export const ROLE_ORDER = ['top', 'jng', 'mid', 'bot', 'sup'];

export const ROLE_LABELS = {
  get top() { return t('role.top'); },
  get jng() { return t('role.jng'); },
  get mid() { return t('role.mid'); },
  get bot() { return t('role.bot'); },
  get sup() { return t('role.sup'); },
};

export const ROLE_COLORS = {
  top: '#3569ab',
  jng: '#0c8979',
  mid: '#b58018',
  bot: '#c35264',
  sup: '#8857ad',
};

export const PLACEHOLDER = '—';
