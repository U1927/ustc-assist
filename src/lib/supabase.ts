
import { createClient } from '@supabase/supabase-js';

console.warn("[Supabase] Module loading...");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  const msg = "[Supabase] CRITICAL ERROR: Missing Environment Variables! Check your .env file.";
  console.error(msg);
  // Force alert so user sees it immediately
  if (typeof window !== 'undefined') {
    alert(msg + "\n\nURL: " + (supabaseUrl || "MISSING") + "\nKey: " + (supabaseKey ? "PRESENT" : "MISSING"));
  }
} else {
  console.log("[Supabase] Configuration loaded. URL:", supabaseUrl);
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
