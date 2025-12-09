import { ScheduleItem, TodoItem, UserProfile } from '../types';
import { supabase } from '../lib/supabase';

const KEYS = {
  USER_SESSION: 'ustc_assist_user_session',
};

// --- Session (Local Only) ---
export const saveUserSession = (user: UserProfile) => {
  localStorage.setItem(KEYS.USER_SESSION, JSON.stringify(user));
};

export const getUserSession = (): UserProfile | null => {
  const data = localStorage.getItem(KEYS.USER_SESSION);
  return data ? JSON.parse(data) : null;
};

export const clearSession = () => {
  localStorage.clear();
};

// --- Cloud Operations (Supabase) ---

export const fetchUserData = async (studentId: string): Promise<{ schedule: ScheduleItem[], todos: TodoItem[] } | null> => {
  if (!supabase) {
    console.error("Supabase client not initialized! Check .env");
    return null;
  }

  try {
    // FIX: Use maybeSingle() instead of single() to handle new users (0 rows) gracefully without 406 error
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      console.error(`[Storage] Fetch Error:`, error);
      // alert(`Fetch Error: ${error.message}`);
      return null;
    }

    // If data is null (new user), return empty arrays
    if (!data) {
      console.log(`[Storage] No data found for ${studentId}, initializing new user.`);
      return { schedule: [], todos: [] };
    }

    return {
      schedule: data.schedule || [],
      todos: data.todos || []
    };
  } catch (err: any) {
    console.error(`[Storage] Network Error during Fetch:`, err);
    return null;
  }
};

export const saveUserData = async (studentId: string, schedule: ScheduleItem[], todos: TodoItem[]): Promise<{ success: boolean; error?: string }> => {
  if (!supabase) return { success: false, error: "Supabase client missing" };

  // Sanitize data (remove undefined)
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
      return { success: false, error: `${error.code}: ${error.message}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

// Legacy stubs
export const saveSchedule = () => {};
export const getSchedule = () => [];
export const saveTodos = () => {};
export const getTodos = () => [];
export const saveUser = () => {};
export const getUser = () => null;
export const clearData = () => {};
