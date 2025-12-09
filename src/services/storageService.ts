
import { ScheduleItem, TodoItem, UserProfile } from '../types';
import { supabase } from '../lib/supabase';

const KEYS = {
  USER: 'ustc_assist_user_session',
};

// --- Session Management (Keep Login State Local) ---
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

// --- Cloud Data Operations (Supabase) ---

export const fetchUserData = async (studentId: string): Promise<{ schedule: ScheduleItem[], todos: TodoItem[] } | null> => {
  console.log(`[Storage] Fetching cloud data for: ${studentId}`);
  
  if (!supabase) {
    console.error("[Storage] Supabase client is not initialized.");
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
        console.warn("[Storage] User not found in DB (New User). Returning empty data.");
        return { schedule: [], todos: [] };
      }
      console.error("[Storage] Fetch Error:", error.message);
      return null;
    }

    console.log("[Storage] Data loaded successfully:", data);
    return {
      schedule: data.schedule || [],
      todos: data.todos || []
    };
  } catch (err) {
    console.error("[Storage] Unexpected error during fetch:", err);
    return null;
  }
};

export const saveUserData = async (studentId: string, schedule: ScheduleItem[], todos: TodoItem[]): Promise<boolean> => {
  console.log(`[Storage] Saving data for ${studentId}...`);

  if (!supabase) {
    console.error("[Storage] Supabase client offline.");
    return false;
  }

  // Sanitize data (remove undefined) to avoid JSON errors
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
      console.error("[Storage] Save Error:", error);
      return false;
    }

    console.log("[Storage] Save Successful!");
    return true;
  } catch (err) {
    console.error("[Storage] Unexpected error during save:", err);
    return false;
  }
};
