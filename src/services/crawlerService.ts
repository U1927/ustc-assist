
import { ScheduleItem } from '../types';

/**
 * CRAWLER SERVICE
 * Calls the backend proxy to fetch data from USTC JW and Young systems.
 */

const JW_BASE_URL = 'https://jw.ustc.edu.cn';
const YOUNG_BASE_URL = 'https://young.ustc.edu.cn';

/**
 * 1. PURE AUTHENTICATION (Used by Login/Register)
 * Verifies username/password with CAS, does NOT fetch data.
 */
export const verifyCredential = async (
  username: string, 
  pass: string, 
  captchaCode?: string, 
  context?: any
): Promise<any> => {
  return callProxy(username, pass, 'auth', captchaCode, context);
};

/**
 * 2. FULL SYNC (Used by Import Dialog)
 * Authenticates AND fetches First/Second classroom data.
 */
export const autoImportFromJw = async (
  username: string, 
  pass: string, 
  captchaCode?: string, 
  context?: any
): Promise<any> => {
  return callProxy(username, pass, 'fetch', captchaCode, context);
};

// Internal Helper
const callProxy = async (
  username: string, 
  pass: string, 
  mode: 'auth' | 'fetch',
  captchaCode?: string, 
  context?: any
) => {
  try {
    const payload: any = { 
        username, 
        password: pass,
        mode: mode // Send mode to server
    };
    if (captchaCode) payload.captchaCode = captchaCode;
    if (context) payload.context = context;

    // Call local API proxy
    const response = await fetch('/api/jw/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 404) throw new Error("API Proxy not found. Ensure server.js is running.");
    if (response.status === 504) throw new Error("Request Timed Out.");

    const text = await response.text();
    if (!text) throw new Error(`Empty response from server.`);

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(`Server Error: ${text.substring(0, 50)}...`);
    }

    // If captcha is required, return specific object
    if (result.requireCaptcha) return result;

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Operation failed');
    }

    return result.data || { success: true }; // auth mode might not return data
  } catch (error: any) {
    console.error('Proxy Call Error:', error);
    throw new Error(error.message || "Network Error");
  }
}

// Legacy mock function - kept for compatibility
export const fetchAllData = async (studentId: string): Promise<ScheduleItem[]> => {
  return [];
};
