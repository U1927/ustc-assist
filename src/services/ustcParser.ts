
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
  nameZh?: string;
  course?: { nameZh: string };
  classroom?: { name: string };
  teacherAssignmentList?: Array<{ teacher?: { name?: string }, name?: string }>;
  teachers?: Array<{ name: string }>;
  weeks?: number[];
  weekIndex?: number;
  weekday?: number;
  startUnit?: number;
  endUnit?: number;
}

export const parseJwJson = (input: string | any, semesterStart: string): ScheduleItem[] => {
  try {
    let data: any;

    // Handle both string input (from manual paste) and object input (from API)
    if (typeof input === 'string') {
        try {
            data = JSON.parse(input.trim());
        } catch (e) {
            throw new Error("Invalid JSON format. Please check your input.");
        }
    } else {
        data = input;
    }

    // Locate the Lessons Array
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
      throw new Error("Could not find course list in data structure.");
    }

    const scheduleItems: ScheduleItem[] = [];

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
      const weeks = lesson.weeks || [];
      const weekday = lesson.weekday || lesson.weekIndex || 1;
      const startUnit = lesson.startUnit;
      const endUnit = lesson.endUnit;

      if (weeks.length === 0 || !startUnit || !endUnit) return;

      // C. Generate Events
      weeks.forEach((week) => {
        const startTimeConfig = USTC_TIME_SLOTS[startUnit];
        const endTimeConfig = USTC_TIME_SLOTS[endUnit];

        if (!startTimeConfig || !endTimeConfig) return;

        const startDt = calculateClassDate(semesterStart, week, weekday, startTimeConfig.start);
        const endDt = calculateClassDate(semesterStart, week, weekday, endTimeConfig.end);

        scheduleItems.push({
          id: crypto.randomUUID(),
          title: title,
          location: location,
          type: 'course',
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
