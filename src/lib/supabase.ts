import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url?.startsWith('https://') && url.includes('.supabase.co') && !url.includes('YOUR_PROJECT') && key && !key.includes('REPLACE_ME') && (key.startsWith('sb_publishable_') || key.startsWith('eyJ')));
export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
