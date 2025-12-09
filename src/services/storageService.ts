
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
 * Register a new user with ID and Password
 */
export const registerUser = async (studentId: string, password: string): Promise<{ success: boolean; error?: string }> => {
  if (!supabase) return { success: false, error: "System Error: Database not connected." };

  try {
    // 1. Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('user_data')
      .select('student_id')
      .eq('student_id', studentId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingUser) {
      return { success: false, error: "User already exists. Please login." };
    }

    // 2. Insert new user
    const { error: insertError } = await supabase
      .from('user_data')
      .insert({
        student_id: studentId,
        password: password, // In a real app, verify this is hashed or handled securely by Supabase Auth
        schedule: [],
        todos: []
      });

    if (insertError) throw insertError;

    return { success: true };
  } catch (err: any) {
    console.error("Registration Error:", err);
    return { success: false, error: err.message };
  }
};

/**
 * Login existing user with ID and Password
 */
export const loginUser = async (studentId: string, password: string): Promise<{ success: boolean; error?: string; user?: any }> => {
  if (!supabase) return { success: false, error: "System Error: Database not connected." };

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('student_id, password') // Select password to verify
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { success: false, error: "User not found. Please register." };
    }

    // Verify Password (Simple comparison for this architecture)
    if (data.password !== password) {
      return { success: false, error: "Incorrect password." };
    }

    return { success: true, user: data };
  } catch (err: any) {
    console.error("Login Error:", err);
    return { success: false, error: err.message };
  }
};

/**
 * Change Password
 */
export const changePassword = async (studentId: string, oldPass: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
  if (!supabase) return { success: false, error: "Database disconnected" };

  try {
    // 1. Verify old password
    const { data, error: fetchError } = await supabase
      .from('user_data')
      .select('password')
      .eq('student_id', studentId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!data) return { success: false, error: "User not found" };
    if (data.password !== oldPass) return { success: false, error: "Incorrect current password" };

    // 2. Update password
    const { error: updateError } = await supabase
      .from('user_data')
      .update({ password: newPass })
      .eq('student_id', studentId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (err: any) {
    console.error("Change Password Error:", err);
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
