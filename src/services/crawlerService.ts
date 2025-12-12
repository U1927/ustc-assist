
import { ScheduleItem } from '../types';

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
        includeSecondClassroom: true // Request Second Classroom (Young) Data
    };
    if (captchaCode) payload.captchaCode = captchaCode;
    if (context) payload.context = context;

    // Use relative path which is proxied by Vite to the backend server
    const response = await fetch('/api/jw/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 404) throw new Error("Backend API Not Found. Ensure server.js is running.");
    if (response.status === 504) throw new Error("Request Timed Out.");

    const text = await response.text();
    if (!text) throw new Error(`Empty response from server.`);

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response: ${text.substring(0, 50)}...`);
    }

    if (result.requireCaptcha) return result;

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Login failed');
    }

    return result.data; // Now contains { firstClassroom, secondClassroom }
  } catch (error: any) {
    console.error('Auto Import Error:', error);
    throw new Error(error.message || "Network Error");
  }
};

// Legacy mock function - kept for compatibility if referenced elsewhere
export const fetchAllData = async (studentId: string): Promise<ScheduleItem[]> => {
  return [];
};
