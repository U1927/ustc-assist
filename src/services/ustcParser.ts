
import { ScheduleItem } from '../types';
import { USTC_TIME_SLOTS, calculateClassDate } from './utils';
import { format } from 'date-fns';

/**
 * 解析从教务系统提取的 JSON 数据
 * 兼容 `studentTableVm` 对象结构
 */
export const parseJwJson = (input: any, semesterStart: string): ScheduleItem[] => {
  const scheduleItems: ScheduleItem[] = [];
  
  try {
    // 1. 确定数据源结构
    let lessons: any[] = [];
    let secondClass: any[] = [];

    // 如果是后端代理返回的组合数据
    if (input.firstClassroom) {
        lessons = Array.isArray(input.firstClassroom) ? input.firstClassroom : [];
        secondClass = Array.isArray(input.secondClassroom) ? input.secondClassroom : [];
    } 
    // 如果是用户手动粘贴的 studentTableVm 对象
    else if (input.activities) {
        lessons = input.activities;
    } else if (input.lessons) {
        lessons = input.lessons;
    }
    // 如果是用户手动粘贴的 activities 数组
    else if (Array.isArray(input)) {
        lessons = input;
    }

    console.log(`[Parser] Found ${lessons.length} lessons to parse.`);

    // 2. 解析第一课堂 (JW)
    lessons.forEach((lesson) => {
      // 字段映射：教务系统不同接口返回的字段名可能不同
      const title = lesson.courseName || lesson.nameZh || lesson.name || "Unknown Course";
      const location = lesson.classroom?.name || lesson.room?.name || lesson.roomName || "TBD";
      
      // 提取教师
      let teacherName = "";
      if (lesson.teachers && Array.isArray(lesson.teachers)) {
          teacherName = lesson.teachers.map((t: any) => t.name).join(',');
      } else if (lesson.teacherAssignmentList && Array.isArray(lesson.teacherAssignmentList)) {
          teacherName = lesson.teacherAssignmentList.map((t: any) => t.teacher?.name || t.name).join(',');
      }

      // 时间信息
      // `weeks`: [1, 2, 3...]
      // `weekday`: 1-7
      // `startUnit`: 1 (第1节)
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
                 textbook: '' // 教务系统通常不返回教材信息
             });
         }
      });
    });

    // 3. 解析第二课堂 (Simple Mapping)
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
