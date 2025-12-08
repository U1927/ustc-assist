import { createClient } from '@supabase/supabase-js';

// Access environment variables directly using import.meta.env
// This allows Vite to statically replace them during the build process on Vercel.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// DEBUG LOGS
console.log(`[Supabase] Init...`);
console.log(`[Supabase] URL Present: ${!!supabaseUrl}`);

if (!supabaseUrl || !supabaseKey) {
  console.warn("[Supabase] Config missing. Data syncing will be disabled. Check .env or Vercel Settings.");
}

// Create a single shared client instance
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (supabase) {
  console.log("[Supabase] Client successfully created.");
} else {
  console.error("[Supabase] Client creation failed (Missing URL or Key).");
}