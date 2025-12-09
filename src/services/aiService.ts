import { GoogleGenAI, Type } from "@google/genai";
import { ScheduleItem } from "../types";
import { addDays, format } from "date-fns";

// Local helper since date-fns startOfWeek might be missing or causing issues
const startOfWeek = (date: Date, options?: { weekStartsOn?: number }) => {
  const weekStartsOn = options?.weekStartsOn ?? 0;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  return d;
};

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the "data:image/jpeg;base64," prefix
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateStudyPlan = async (
  currentSchedule: ScheduleItem[], 
  focusTopics: string
): Promise<ScheduleItem[]> => {
  
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.warn("No API Key provided for AI features. Please set API_KEY in your environment.");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  const today = new Date().toISOString().split('T')[0];
  const prompt = `
    I am a student at USTC. 
    Here is my current schedule for today (${today}) in JSON format: ${JSON.stringify(currentSchedule.map(s => ({ start: s.startTime, end: s.endTime, title: s.title })))}.
    
    I need to study these topics: "${focusTopics}".
    
    Please generate 2-3 study blocks (Type: 'study') to fit into empty slots in my schedule for today.
    Do not overlap with existing events.
    Keep study blocks between 45 minutes to 90 minutes.
    
    Return ONLY a JSON array of objects.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              startTime: { type: Type.STRING, description: "ISO 8601 format date string" },
              endTime: { type: Type.STRING, description: "ISO 8601 format date string" },
              description: { type: Type.STRING },
            },
            required: ["title", "startTime", "endTime"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];

    const planItems = JSON.parse(text);
    
    // Map to ScheduleItem
    return planItems.map((item: any) => ({
      id: crypto.randomUUID(),
      title: item.title,
      location: 'Library/Dorm',
      type: 'study',
      startTime: item.startTime,
      endTime: item.endTime,
      description: item.description || 'AI Generated Plan',
    }));

  } catch (error) {
    console.error("AI Planning failed:", error);
    return [];
  }
};

export const parseScheduleFromImage = async (imageFile: File): Promise<ScheduleItem[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    alert("API Key is missing. Cannot process image.");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const imagePart = await fileToGenerativePart(imageFile);

  // Calculate dates for the current week to help AI map "Monday" to an actual date
  const today = new Date();
  const mondayDate = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const weekMapping = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(mondayDate, i);
    return `${format(d, 'EEEE')} is ${format(d, 'yyyy-MM-dd')}`;
  }).join(", ");

  const prompt = `
    You are an intelligent assistant for a USTC student.
    Analyze the attached image of a course schedule (Chinese: 中国科学技术大学学生课表).
    
    Task: Extract all courses and convert them into a JSON schedule for the CURRENT WEEK.
    
    Context:
    - The current week dates are: ${weekMapping}.
    - Map "星期一" to Monday's date, "星期二" to Tuesday's date, etc.
    - Parse the time slots from the cells. 
      - Example: "1 (07:50 09:25)" means Start 07:50, End 09:25.
      - Example: "6,7 (14:00 15:35)" means Start 14:00, End 15:35.
      - If a specific time range is written in the cell (e.g. 19:30), use that.
    
    Extract fields:
    - title: The course name (e.g., 数学分析, 力学A).
    - location: The classroom code (e.g., 5202, 3C104).
    - type: Always set to 'course'.
    - startTime: ISO 8601 string (YYYY-MM-DDTHH:mm:ss) using the correct date for the weekday and time.
    - endTime: ISO 8601 string (YYYY-MM-DDTHH:mm:ss).
    - description: Include Teacher name and Week range (e.g., "Teacher: 刘明辉, Weeks: 2-18").
    
    Return ONLY raw JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          imagePart,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              location: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['course'] },
              startTime: { type: Type.STRING },
              endTime: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ["title", "startTime", "endTime"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];

    const parsedItems = JSON.parse(text);

    return parsedItems.map((item: any) => ({
      id: crypto.randomUUID(),
      title: item.title,
      location: item.location || 'TBD',
      type: 'course',
      startTime: item.startTime,
      endTime: item.endTime,
      description: item.description,
      textbook: '' 
    }));

  } catch (error) {
    console.error("AI Image Parsing failed:", error);
    throw error;
  }
};
