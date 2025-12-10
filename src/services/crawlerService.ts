import { ScheduleItem } from '../types';

export const autoImportFromJw = async (username: string, pass: string): Promise<any> => {
  try {
    // Note: On Vercel, this requests /api/jw/login which is handled by api/jw/login.js
    const response = await fetch('/api/jw/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password: pass }),
    });

    // Handle generic server errors
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
      console.error("[Crawler] Invalid JSON received:", text.substring(0, 100));
      throw new Error(`Server Error: Received invalid format (Status ${response.status}).`);
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
