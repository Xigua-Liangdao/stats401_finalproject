const SUPABASE_URL = 'https://hvnjcddvgzjtbvsyvaqn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Wv0xiqWoM2PrpVLDBIgCJQ_3idtPLI8';

let clientPromise = null;

export function loadSupabase() {
  if (clientPromise) return clientPromise;
  const pending = import('@supabase/supabase-js')
    .then(({ createClient }) => {
      if (typeof createClient !== 'function') {
        throw new Error('Supabase client did not load.');
      }
      return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    })
    .catch((error) => {
      if (clientPromise === pending) clientPromise = null;
      throw error;
    });
  clientPromise = pending;
  return clientPromise;
}
