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

    const result = await response.json();

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
