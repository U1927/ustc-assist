
import { ScheduleItem } from '../types';

/**
 * CRAWLER SERVICE
 * Calls the backend proxy to fetch data from USTC JW and Young systems.
 */

const JW_BASE_URL = 'https://jw.ustc.edu.cn';
const YOUNG_BASE_URL = 'https://young.ustc.edu.cn';

// Call the proxy server defined in server.js
export const autoImportFromJw = async (
  username: string, 
  pass: string, 
  captchaCode?: string, 
  context?: any
): Promise<any> => {
  try {
    const payload: any = { 
        username, 
        password: pass,
        includeSecondClassroom: true 
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
      throw new Error(result.error || 'Login failed');
    }

    return result.data; // { firstClassroom: [], secondClassroom: [] }
  } catch (error: any) {
    console.error('Auto Import Error:', error);
    throw new Error(error.message || "Network Error");
  }
};

// Legacy mock function - kept for compatibility
export const fetchAllData = async (studentId: string): Promise<ScheduleItem[]> => {
  return [];
};
