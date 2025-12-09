import { ScheduleItem, TodoItem, UserProfile } from '../types';
import { supabase } from '../lib/supabase';

const KEYS = {
  USER: 'ustc_assist_user',
};

// --- Session Management (Local Only) ---
export const saveUserSession = (user: UserProfile) => {
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
};

export const getUserSession = (): UserProfile | null => {
  const data = localStorage.getItem(KEYS.USER);
  return data ? JSON.parse(data) : null;
};

export const clearSession = () => {
  localStorage.clear();
};

// --- Cloud Data Operations ---

export const fetchUserData = async (studentId: string): Promise<{ schedule: ScheduleItem[], todos: TodoItem[] } | null> => {
  console.log(`[Supabase] Fetching data for user: ${studentId}...`);
  if (!supabase) {
    console.warn("[Supabase] Client is null, cannot fetch.");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('student_id', studentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log("[Supabase] User not found (New User), returning empty defaults.");
        return { schedule: [], todos: [] };
      }
      console.error("[Supabase] Fetch Error:", error);
      return null;
    }

    console.log("[Supabase] Fetch Success:", data);
    return {
      schedule: data.schedule || [],
      todos: data.todos || []
    };
  } catch (err) {
    console.error("[Supabase] Unexpected Fetch Exception:", err);
    return null;
  }
};

export const saveUserData = async (studentId: string, schedule: ScheduleItem[], todos: TodoItem[]): Promise<boolean> => {
  console.log(`[Supabase] Attempting save for ${studentId}. Events: ${schedule.length}, Todos: ${todos.length}`);
  
  if (!supabase) {
    console.warn("[Supabase] Client is null, save skipped (Offline Mode).");
    return false;
  }

  // Sanitization: Ensure clean JSON (removes undefined, functions, etc)
  const cleanSchedule = JSON.parse(JSON.stringify(schedule));
  const cleanTodos = JSON.parse(JSON.stringify(todos));

  try {
    const { error } = await supabase
      .from('user_data')
      .upsert({
        student_id: studentId,
        schedule: cleanSchedule,
        todos: cleanTodos,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id' });

    if (error) {
      console.error("[Supabase] Save API Error:", error);
      // Alert user about Policy error (RLS) specifically
      if (error.code === '42501' || error.message.includes('row-level security')) {
        console.error("CRITICAL: RLS Policy Violation. Please run the schema.sql again in Supabase.");
      }
      return false;
    }

    console.log("[Supabase] Save Success!");
    return true;
  } catch (err) {
    console.error("[Supabase] Unexpected Save Exception:", err);
    return false;
  }
};
