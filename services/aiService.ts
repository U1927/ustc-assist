import { GoogleGenAI, Type } from "@google/genai";
import { ScheduleItem } from "../types";

// Requirement: Smart planning using Gemini
export const generateStudyPlan = async (
  currentSchedule: ScheduleItem[], 
  focusTopics: string
): Promise<ScheduleItem[]> => {
  
  // Requirement: API Key must be obtained exclusively from process.env.API_KEY
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