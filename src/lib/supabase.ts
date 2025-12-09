
import { createClient } from '@supabase/supabase-js';

console.log("[Supabase] Initializing Client...");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[Supabase] MISSING ENV VARIABLES! Check your .env file or Vercel Settings.");
  console.error("Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY");
} else {
  console.log("[Supabase] URL found:", supabaseUrl);
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
