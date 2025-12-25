import { ScheduleItem, TodoItem, UserProfile } from '../types';
import { supabase } from '../lib/supabase';

const KEYS = {
  USER_SESSION: 'ustc_assist_user_session',
  SCHEDULE: 'ustc_assist_schedule',
  TODOS: 'ustc_assist_todos',
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

// --- Local Data Persistence ---
export const saveSchedule = (items: ScheduleItem[]) => {
  localStorage.setItem(KEYS.SCHEDULE, JSON.stringify(items));
};

export const getSchedule = (): ScheduleItem[] => {
  const data = localStorage.getItem(KEYS.SCHEDULE);
  return data ? JSON.parse(data) : [];
};

export const saveTodos = (items: TodoItem[]) => {
  localStorage.setItem(KEYS.TODOS, JSON.stringify(items));
};

export const getTodos = (): TodoItem[] => {
  const data = localStorage.getItem(KEYS.TODOS);
  return data ? JSON.parse(data) : [];
};

// --- Cloud Operations (Supabase) ---

/**
 * Register a new user with ID and Password
 */
export const registerUser = async (studentId: string, password: string): Promise<{ success: boolean; error?: string }> => {
  if (!supabase) return { success: false, error: "系统错误：数据库未连接" };

  try {
    // 1. Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('user_data')
      .select('student_id')
      .eq('student_id', studentId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingUser) {
      return { success: false, error: "用户已存在,请登录" };
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
    console.error("注册错误:", err);
    return { success: false, error: err.message };
  }
};

/**
 * Login existing user with ID and Password
 */
export const loginUser = async (studentId: string, password: string): Promise<{ success: boolean; error?: string; user?: any }> => {
  if (!supabase) return { success: false, error: "系统错误：数据库未连接" };

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('student_id, password') // Select password to verify
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { success: false, error: "找不到用户,请注册" };
    }

    // Verify Password (Simple comparison for this architecture)
    if (data.password !== password) {
      return { success: false, error: "密码不正确" };
    }

    return { success: true, user: data };
  } catch (err: any) {
    console.error("登录错误:", err);
    return { success: false, error: err.message };
  }
};

/**
 * Change Password
 */
export const changePassword = async (studentId: string, oldPass: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
  if (!supabase) return { success: false, error: "数据库已断开连接" };

  try {
    // 1. Verify old password
    const { data, error: fetchError } = await supabase
      .from('user_data')
      .select('password')
      .eq('student_id', studentId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!data) return { success: false, error: "用户未找到" };
    if (data.password !== oldPass) return { success: false, error: "当前密码不正确" };

    // 2. Update password
    const { error: updateError } = await supabase
      .from('user_data')
      .update({ password: newPass })
      .eq('student_id', studentId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (err: any) {
    console.error("更改密码错误:", err);
    return { success: false, error: err.message };
  }
};

export const fetchUserData = async (studentId: string): Promise<{ schedule: ScheduleItem[], todos: TodoItem[] } | null> => {
  if (!supabase) {
    console.error("Supabase客户端未初始化!检查.env");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      console.error(`[Storage]提取错误:`, error);
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
    console.error(`[Storage]提取过程中发生网络错误:`, err);
    return null;
  }
};

export const saveUserData = async (studentId: string, schedule: ScheduleItem[], todos: TodoItem[]): Promise<{ success: boolean; error?: string }> => {
  if (!supabase) return { success: false, error: "Supabase客户端丢失" };

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
       console.error("[Storage]更新错误:", error);
       return { success: false, error: `${error.code}: ${error.message}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
