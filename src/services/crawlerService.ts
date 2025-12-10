
import { ScheduleItem } from '../types';

export const autoImportFromJw = async (
  username: string, 
  pass: string, 
  captchaCode?: string, 
  context?: any
): Promise<any> => {
  try {
    const payload: any = { username, password: pass };
    if (captchaCode) payload.captchaCode = captchaCode;
    if (context) payload.context = context;

    // Note: On Vercel, this requests /api/jw/login
    const response = await fetch('/api/jw/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 404) {
      throw new Error("API Endpoint Not Found. Ensure 'api/jw/login.js' is deployed.");
    }
    
    if (response.status === 504) {
       throw new Error("Request Timed Out. CAS might be slow.");
    }

    const text = await response.text();
    if (!text) {
      throw new Error(`Server returned empty response (Status: ${response.status})`);
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(`Server Error: Received invalid format (Status ${response.status}).`);
    }

    // Special Case: Captcha Required (Not an error, but a step)
    if (result.requireCaptcha) {
        return result; // Return the whole object so frontend can handle it
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Login failed');
    }

    // result.data contains the JW JSON
    return result.data;
  } catch (error: any) {
    console.error('Auto Import Error:', error);
    throw new Error(error.message || "Network Error");
  }
};
