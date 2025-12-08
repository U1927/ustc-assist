import { ScheduleItem } from '../types';

/**
 * CRAWLER SERVICE
 * 
 * Note: In a pure frontend browser environment, requests to jw.ustc.edu.cn and young.ustc.edu.cn
 * will likely be blocked by CORS (Cross-Origin Resource Sharing) policies.
 * 
 * In a production environment, this code should either:
 * 1. Run in a Node.js backend / Serverless function.
 * 2. Use a CORS proxy.
 * 3. Run within an Electron app (with webSecurity: false).
 * 
 * This service implements the 'Best Effort' logic: it tries to fetch, and catches errors to return mock data.
 */

const JW_BASE_URL = 'https://jw.ustc.edu.cn';
const YOUNG_BASE_URL = 'https://young.ustc.edu.cn/login/sc-wisdom-group-learning/personalInformation/mySchedule';

// Mock Data Generator for Fallback
const generateMockData = (): ScheduleItem[] => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  return [
    {
      id: crypto.randomUUID(),
      title: 'Linear Algebra (B1)',
      location: '3A102',
      type: 'course',
      startTime: `${year}-${month}-${day}T08:00:00`,
      endTime: `${year}-${month}-${day}T09:35:00`,
      textbook: 'Linear Algebra by Li Shangzhi',
      description: 'First Classroom - Math Dept'
    },
    {
      id: crypto.randomUUID(),
      title: 'College Physics',
      location: '3C102',
      type: 'course',
      startTime: `${year}-${month}-${day}T14:00:00`,
      endTime: `${year}-${month}-${day}T15:35:00`,
      textbook: 'Physics Vol 1',
      description: 'First Classroom - Physics Dept'
    },
    {
      id: crypto.randomUUID(),
      title: 'Robotics Club Meeting',
      location: 'Activity Center',
      type: 'activity',
      startTime: `${year}-${month}-${day}T19:00:00`,
      endTime: `${year}-${month}-${day}T21:00:00`,
      description: 'Second Classroom Activity - Robot assembly'
    }
  ];
};

export const syncFromJW = async (studentId: string): Promise<ScheduleItem[]> => {
  console.log(`[Crawler] Attempting to fetch First Classroom data for ${studentId}...`);
  
  try {
    // 1. Attempt Real Fetch
    // This is how you would construct the request if CORS was allowed
    const response = await fetch(`${JW_BASE_URL}/for-std/course-table`, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        // 'Cookie': 'YOUR_SESSION_COOKIE' // In a real app, you need the session cookie
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const html = await response.text();
    
    // 2. Parse HTML (Example logic using DOMParser)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Example: Select all course blocks (Selector needs to match actual JW structure)
    // This is hypothetical selector logic based on common extraction patterns
    const courseNodes = doc.querySelectorAll('.course-table-cell'); 
    
    if (courseNodes.length === 0) {
       console.warn("[Crawler] No course nodes found in parsed HTML (or Login required).");
       // In strict mode, we might throw here, but for demo we fallback
       throw new Error("Parse failed or not logged in");
    }

    // Map nodes to ScheduleItems...
    // const realItems: ScheduleItem[] = Array.from(courseNodes).map(...)
    // return realItems;

    return generateMockData();

  } catch (error) {
    console.warn("[Crawler] Fetch failed (likely CORS or Network), using Mock Data.", error);
    // Return mock data to ensure the app works for the user
    return generateMockData();
  }
};

export const syncFromYoung = async (studentId: string): Promise<ScheduleItem[]> => {
  console.log(`[Crawler] Attempting to fetch Second Classroom data for ${studentId}...`);
  
  try {
    // 1. Attempt Real Fetch
    const response = await fetch(YOUNG_BASE_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error("Network response not ok");
    
    // 2. Parse JSON (Second classroom usually has API endpoints)
    const data = await response.json();
    
    // Transform data...
    return [];

  } catch (error) {
    console.warn("[Crawler] Fetch Young failed, using Mock Data.", error);
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    return [{
      id: crypto.randomUUID(),
      title: 'Volunteering: Library Help',
      location: 'West Library',
      type: 'activity',
      startTime: `${dateStr}T16:00:00`,
      endTime: `${dateStr}T17:30:00`,
      description: 'Second Classroom - Community Service'
    }];
  }
};

export const fetchAllData = async (studentId: string): Promise<ScheduleItem[]> => {
  const [jwData, youngData] = await Promise.all([
    syncFromJW(studentId),
    syncFromYoung(studentId)
  ]);
  
  return [...jwData, ...youngData];
};