
import { createClient } from '@supabase/supabase-js';

console.warn("[Supabase] Module loading...");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[Supabase] CRITICAL ERROR: Missing Environment Variables!");
  console.error("VITE_SUPABASE_URL:", supabaseUrl);
  console.error("VITE_SUPABASE_ANON_KEY:", supabaseKey ? "Set (Hidden)" : "Missing");
} else {
  console.log("[Supabase] Configuration loaded. URL:", supabaseUrl);
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
