import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hvnjcddvgzjtbvsyvaqn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Wv0xiqWoM2PrpVLDBIgCJQ_3idtPLI8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
