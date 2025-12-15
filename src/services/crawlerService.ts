
import { ScheduleItem } from '../types';

/**
 * CRAWLER SERVICE
 * Provides interfaces to connect to USTC systems via backend proxy.
 */

// 1. JW SYSTEM (First Classroom)
export const syncFromJW = async (
  username: string, 
  pass: string, 
  captchaCode?: string, 
  context?: any
): Promise<any> => {
  return callProxy('/api/jw/login', username, pass, captchaCode, context);
};

// 2. YOUNG SYSTEM (Second Classroom)
export const syncFromYoung = async (
  username: string, 
  pass: string, 
  captchaCode?: string, 
  context?: any
): Promise<any> => {
  return callProxy('/api/young/login', username, pass, captchaCode, context);
};

// Helper
const callProxy = async (
  endpoint: string,
  username: string, 
  pass: string, 
  captchaCode?: string, 
  context?: any
) => {
  try {
    const payload: any = { username, password: pass };
    if (captchaCode) payload.captchaCode = captchaCode;
    if (context) payload.context = context;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 404) throw new Error("Proxy endpoint not found (Server down?)");
    
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(`Server Error: ${text.substring(0, 50)}...`);
    }

    if (result.requireCaptcha) return result;

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Connection failed');
    }

    return result.data; 
  } catch (error: any) {
    console.error(`Proxy Error (${endpoint}):`, error);
    throw new Error(error.message || "Network Error");
  }
}

// Deprecated legacy function stub to prevent compile errors if referenced
export const fetchAllData = async (studentId: string): Promise<ScheduleItem[]> => {
  throw new Error("Use syncFromJW or syncFromYoung with credentials.");
};

