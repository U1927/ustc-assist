
import { ScheduleItem } from '../types';

/**
 * CRAWLER SERVICE
 * 
 * Targets the specific USTC JW Course Query URL.
 * 
 * Note: Direct browser requests to jw.ustc.edu.cn will likely fail due to CORS.
 * This service attempts the fetch and throws/logs real errors without falling back to mock data.
 */

const JW_TARGET_URL = 'https://jw.ustc.edu.cn/for-std/course-take-query/index/502950';

export const fetchAllData = async (studentId: string): Promise<ScheduleItem[]> => {
  console.log(`[Crawler] Starting fetch from ${JW_TARGET_URL} for student ${studentId}...`);
  
  try {
    const response = await fetch(JW_TARGET_URL, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        // 'Cookie': 'YOUR_SESSION_COOKIE' // Cookies are usually HttpOnly and handled by the browser context
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log("[Crawler] Successfully received HTML content (Length: " + html.length + ")");
    
    // Parsing logic would go here. 
    // Since we cannot verify the HTML structure without a successful CORS request,
    // we return an empty array if successful but parsing isn't implemented.
    
    return [];

  } catch (error) {
    console.error("[Crawler] Fetch failed. This is likely due to CORS policy or network issues.", error);
    // Explicitly re-throw or return empty array. NO MOCK DATA as requested.
    throw error;
  }
};
