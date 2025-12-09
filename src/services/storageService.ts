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

/**
 * Authenticates a user.
 * - If user does not exist: Registers them with the provided password.
 * - If user exists: Verifies the password.
 */
export const authenticateUser = async (studentId: string, passwordInput: string): Promise<{ success: boolean; error?: string; isNewUser?: boolean }> => {
  if (!supabase) return { success: false, error: "System Error: Database not connected." };

  try {
    // 1. Check if user exists
    const { data, error } = await supabase
      .from('user_data')
      .select('student_id, password')
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      console.error("Auth Check Error:", error);
      return { success: false, error: "Network error during authentication." };
    }

    // 2. Scenario: New User (Register)
    if (!data) {
      const { error: insertError } = await supabase
        .from('user_data')
        .insert({
          student_id: studentId,
          password: passwordInput, // Note: In a real production app, hash this!
          schedule: [],
          todos: []
        });
      
      if (insertError) {
        return { success: false, error: "Registration failed." };
      }
      return { success: true, isNewUser: true };
    }

    // 3. Scenario: Existing User (Login)
    // Handle legacy users who might have null password
    if (data.password === null) {
       // Optional: Update legacy user with new password
       await supabase.from('user_data').update({ password: passwordInput }).eq('student_id', studentId);
       return { success: true };
    }

    if (data.password === passwordInput) {
      return { success: true };
    } else {
      return { success: false, error: "Incorrect password." };
    }

  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const fetchUserData = async (studentId: string): Promise<{ schedule: ScheduleItem[], todos: TodoItem[] } | null> => {
  if (!supabase) {
    console.error("Supabase client not initialized! Check .env");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      console.error(`[Storage] Fetch Error:`, error);
      return null;
    }

    if (!data) {
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

  const cleanSchedule = JSON.parse(JSON.stringify(schedule));
  const cleanTodos = JSON.parse(JSON.stringify(todos));

  try {
    // We only update schedule/todos, we don't touch the password here
    const { error } = await supabase
      .from('user_data')
      .update({
        schedule: cleanSchedule,
        todos: cleanTodos,
        updated_at: new Date().toISOString()
      })
      .eq('student_id', studentId);

    // If update fails (e.g. row doesn't exist, which shouldn't happen if logged in), try upsert but be careful about password
    if (error) {
       // Fallback for extreme cases, but generally 'authenticateUser' ensures row exists
       console.error("[Storage] Update Error:", error);
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
