/** Generated from the message files in this folder. */
import { locale, name } from './meta.js';
import names from './names.js';
import catalogue from './catalogue.js';
import charts from './charts.js';
import compare from './compare.js';
import drawer from './drawer.js';
import home from './home.js';
import lineup from './lineup.js';
import not_found from './not-found.js';
import player from './player.js';
import shell from './shell.js';
import stats from './stats.js';
import team from './team.js';

export default {
  name,
  locale,
  messages: {
    ...catalogue,
    ...charts,
    ...compare,
    ...drawer,
    ...home,
    ...lineup,
    ...not_found,
    ...player,
    ...shell,
    ...stats,
    ...team,
  },
  names,
};
