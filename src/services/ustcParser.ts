
import { ScheduleItem } from '../types';
import { USTC_TIME_SLOTS, calculateClassDate } from './utils';
import { format } from 'date-fns';

/**
 * 解析从教务系统提取的 JSON 数据
 * 兼容 `get-data` API 返回的 `lessons` 结构
 */
export const parseJwJson = (input: any, semesterStart: string): ScheduleItem[] => {
  const scheduleItems: ScheduleItem[] = [];
  
  try {
    // 1. 确定数据源结构
    let lessons: any[] = [];
    let secondClass: any[] = [];

    // 后端代理返回的组合数据
    if (input.firstClassroom || input.secondClassroom) {
        lessons = Array.isArray(input.firstClassroom) ? input.firstClassroom : [];
        secondClass = Array.isArray(input.secondClassroom) ? input.secondClassroom : [];
    } 
    // 直接粘贴 studentTableVm
    else if (input.lessons) {
        lessons = input.lessons;
    } else if (input.activities) {
        lessons = input.activities;
    }
    // 直接粘贴数组
    else if (Array.isArray(input)) {
        lessons = input;
    }

    console.log(`[Parser] Found ${lessons.length} lessons to parse.`);

    // 2. 解析第一课堂 (JW)
    lessons.forEach((lesson) => {
      const title = lesson.courseName || lesson.nameZh || lesson.name || "Unknown Course";
      // 兼容 API 返回的 classroom 对象或 room 对象
      const location = lesson.classroom?.name || lesson.room?.name || lesson.roomName || "TBD";
      
      // 提取教师
      let teacherName = "";
      if (lesson.teachers && Array.isArray(lesson.teachers)) {
          teacherName = lesson.teachers.map((t: any) => t.name).join(',');
      } else if (lesson.teacherAssignmentList && Array.isArray(lesson.teacherAssignmentList)) {
          teacherName = lesson.teacherAssignmentList.map((t: any) => t.teacher?.name || t.name).join(',');
      }

      // 时间信息
      // API 返回: weeks (number[]), weekday (number), startUnit (number), endUnit (number)
      const weeks = lesson.weeks || [];
      const weekday = lesson.weekday || lesson.dayOfWeek;
      const startUnit = lesson.startUnit || lesson.startPeriod;
      const endUnit = lesson.endUnit || lesson.endPeriod;

      if (!weeks.length || !weekday || !startUnit || !endUnit) return;

      weeks.forEach((week: number) => {
         const startConf = USTC_TIME_SLOTS[startUnit];
         const endConf = USTC_TIME_SLOTS[endUnit];
         
         if (startConf && endConf) {
             const startDt = calculateClassDate(semesterStart, week, weekday, startConf.start);
             const endDt = calculateClassDate(semesterStart, week, weekday, endConf.end);

             scheduleItems.push({
                 id: crypto.randomUUID(),
                 title: title,
                 location: location,
                 type: 'course',
                 startTime: format(startDt, "yyyy-MM-dd'T'HH:mm:ss"),
                 endTime: format(endDt, "yyyy-MM-dd'T'HH:mm:ss"),
                 description: teacherName ? `Teacher: ${teacherName}` : undefined,
                 textbook: '' 
             });
         }
      });
    });

    // 3. 解析第二课堂
    secondClass.forEach((evt) => {
         scheduleItems.push({
             id: crypto.randomUUID(),
             title: evt.name || "Second Classroom Event",
             location: evt.place || "TBD",
             type: 'activity',
             startTime: format(new Date(evt.startTime), "yyyy-MM-dd'T'HH:mm:ss"),
             endTime: format(new Date(evt.endTime), "yyyy-MM-dd'T'HH:mm:ss"),
             description: evt.description || "Imported from Young"
         });
    });

  } catch (e) {
      console.error("Parse Error:", e);
      throw new Error("解析数据失败，请确认 JSON 格式是否正确");
  }

  return scheduleItems;
};

