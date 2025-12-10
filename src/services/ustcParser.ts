
import { ScheduleItem, SemesterConfig } from '../types';
import { USTC_TIME_SLOTS, calculateClassDate } from './utils';
import { format } from 'date-fns';

/**
 * Parsing logic for USTC JW System Data.
 * Matches the JSON structure typically returned by /for-std/course-table/get-data
 */

interface JwLesson {
  id?: string;
  courseName?: string;
  nameZh?: string; // Some APIs use this
  course?: { nameZh: string }; // Nested structure
  classroom?: { name: string };
  teacherAssignmentList?: Array<{ teacher?: { name?: string }, name?: string }>;
  teachers?: Array<{ name: string }>;
  scheduleGroupStr?: string; // Text description
  weeks?: number[]; // [1, 2, 3...]
  weekIndex?: number; // 1 (Mon) - 7 (Sun)
  weekday?: number;
  startUnit?: number;
  endUnit?: number;
  credits?: number;
}

export const parseJwJson = (jsonString: string, semesterStart: string): ScheduleItem[] => {
  try {
    // 1. Clean and Parse JSON
    const cleanStr = jsonString.trim();
    let data: any;
    
    try {
      data = JSON.parse(cleanStr);
    } catch (e) {
      console.error("JSON Parse Error:", e);
      throw new Error("Invalid JSON format. Please copy the raw response array or object.");
    }

    // 2. Locate the Lessons Array
    // USTC JSON structure varies. Could be root array, or inside { studentTableVm: { activities: [...] } }
    let lessons: JwLesson[] = [];

    if (Array.isArray(data)) {
      lessons = data;
    } else if (data.studentTableVm && Array.isArray(data.studentTableVm.activities)) {
      lessons = data.studentTableVm.activities;
    } else if (data.studentTableVm && Array.isArray(data.studentTableVm.lessons)) {
        lessons = data.studentTableVm.lessons;
    } else if (data.lessons && Array.isArray(data.lessons)) {
      lessons = data.lessons;
    } else if (data.activities && Array.isArray(data.activities)) {
      lessons = data.activities;
    } else {
      throw new Error("Could not find course list in JSON. Ensure you copied the correct 'get-data' response.");
    }

    const scheduleItems: ScheduleItem[] = [];

    // 3. Iterate and Convert
    lessons.forEach((lesson) => {
      // A. Extract Basic Info
      const title = lesson.courseName || lesson.nameZh || lesson.course?.nameZh || "Unknown Course";
      
      let location = "TBD";
      if (lesson.classroom?.name) location = lesson.classroom.name;
      
      let teachers = "";
      if (lesson.teacherAssignmentList && lesson.teacherAssignmentList.length > 0) {
        teachers = lesson.teacherAssignmentList.map(t => t.teacher?.name || t.name).join(", ");
      } else if (lesson.teachers && lesson.teachers.length > 0) {
         teachers = lesson.teachers.map(t => t.name).join(", ");
      }

      // B. Extract Time Info
      // Weeks: Array of week indices (e.g. [1,2,3...18])
      const weeks = lesson.weeks || [];
      // Weekday: 1-7
      const weekday = lesson.weekday || lesson.weekIndex || 1;
      // Units: e.g. Start 3, End 5
      const startUnit = lesson.startUnit;
      const endUnit = lesson.endUnit;

      if (weeks.length === 0 || !startUnit || !endUnit) {
        // Skip invalid entries or text-only entries without parsed time
        return;
      }

      // C. Generate Events for each Week
      weeks.forEach((week) => {
        // Validate Time Slots
        const startTimeConfig = USTC_TIME_SLOTS[startUnit];
        const endTimeConfig = USTC_TIME_SLOTS[endUnit];

        if (!startTimeConfig || !endTimeConfig) return;

        const startDt = calculateClassDate(semesterStart, week, weekday, startTimeConfig.start);
        const endDt = calculateClassDate(semesterStart, week, weekday, endTimeConfig.end);

        scheduleItems.push({
          id: crypto.randomUUID(),
          title: title,
          location: location,
          type: 'course', // Default to course
          startTime: format(startDt, "yyyy-MM-dd'T'HH:mm:ss"),
          endTime: format(endDt, "yyyy-MM-dd'T'HH:mm:ss"),
          description: teachers ? `Instructor: ${teachers}` : undefined,
          textbook: undefined
        });
      });
    });

    return scheduleItems;

  } catch (err: any) {
    console.error("JW Parsing Logic Error:", err);
    throw new Error(err.message || "Failed to parse schedule data.");
  }
};
