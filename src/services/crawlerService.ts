import { ScheduleItem } from '../types';

export const autoImportFromJw = async (username: string, pass: string): Promise<any> => {
  try {
    const response = await fetch('/api/jw/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password: pass }),
    });

    if (response.status === 405) {
      throw new Error("Backend Service Not Reachable (405). Please ensure the node server is running ('node server.js').");
    }

    if (response.status === 404) {
      throw new Error("API Endpoint Not Found (404). Ensure backend is running and proxy is configured.");
    }

    // Fix: Read as text first to prevent "Unexpected end of JSON input" on empty/error responses
    const text = await response.text();

    if (!text) {
      throw new Error(`Server returned empty response (Status: ${response.status})`);
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error("[Crawler] Invalid JSON received:", text.substring(0, 100));
      // If we get HTML (like a 404 or 500 page from a proxy), show a clear error
      throw new Error(`Server Error: Received invalid format (Status ${response.status}). Ensure backend is running.`);
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
