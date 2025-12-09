
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
 * Handles login after successful CAS validation.
 * - If user exists: Returns success.
 * - If user does not exist: Automatically registers them (no password needed).
 */
export const loginOrRegisterCAS = async (studentId: string): Promise<{ success: boolean; error?: string; isNewUser?: boolean }> => {
  if (!supabase) return { success: false, error: "System Error: Database not connected." };

  try {
    // 1. Check if user exists
    const { data, error } = await supabase
      .from('user_data')
      .select('student_id')
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      console.error("Auth Check Error:", error);
      return { success: false, error: "Database connection failed during login." };
    }

    // 2. Scenario: New User (Register)
    if (!data) {
      const { error: insertError } = await supabase
        .from('user_data')
        .insert({
          student_id: studentId,
          // No password field needed for CAS users
          schedule: [],
          todos: []
        });
      
      if (insertError) {
        console.error("Registration Error:", insertError);
        return { success: false, error: "Failed to initialize new user data." };
      }
      return { success: true, isNewUser: true };
    }

    // 3. Scenario: Existing User (Login)
    // Simply return success because CAS has already verified their identity
    return { success: true, isNewUser: false };

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
    const { error } = await supabase
      .from('user_data')
      .update({
        schedule: cleanSchedule,
        todos: cleanTodos,
        updated_at: new Date().toISOString()
      })
      .eq('student_id', studentId);

    if (error) {
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
export const authenticateUser = async () => ({ success: false, error: "Deprecated" });
