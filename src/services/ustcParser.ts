
import { ScheduleItem, ClassroomCategory } from '../types';
import { USTC_TIME_SLOTS, calculateClassDate } from './utils';
import { format } from 'date-fns';
import * as cheerio from 'cheerio';

/**
 * Wakeup-Style Week Parser
 * 处理如 "1-10,12,14-18(单)" 或 "2,4,6~10" 的复杂字符串
 */
const parseWeekString = (weekStr: string): number[] => {
  const weeks: number[] = [];
  if (!weekStr) return weeks;

  // 统一替换波浪号为减号，并移除空格和“周”字
  const cleanStr = weekStr.replace(/~/g, '-').replace(/\s/g, '').replace(/周/g, '');
  const segments = cleanStr.split(',');

  segments.forEach(segment => {
    const isOnlyOdd = segment.includes('单');
    const isOnlyEven = segment.includes('双');
    // 匹配范围 "1-10" 或 单个数 "5"
    const rangeMatch = segment.match(/(\d+)(?:-(\d+))?/);
    
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : start;
      
      for (let i = start; i <= end; i++) {
        if (isOnlyOdd && i % 2 === 0) continue;
        if (isOnlyEven && i % 2 !== 0) continue;
        weeks.push(i);
      }
    }
  });
  
  return [...new Set(weeks)].sort((a, b) => a - b);
};

/**
 * 核心解析入口：处理来自各系统的数据
 */
export const parseJwJson = (input: any, semesterStart: string): ScheduleItem[] => {
  const scheduleItems: ScheduleItem[] = [];
  
  try {
    const lessons = input.firstClassroom || (Array.isArray(input) ? input : (input.lessons || []));
    const secondClass = input.secondClassroom || [];
    const graduateHtml = input.graduateHtml;

    // 1. 处理本科生/常规教务 JSON (JW)
    lessons.forEach((lesson: any) => {
      const title = lesson.courseName || lesson.nameZh || lesson.name || "未知课程";
      const location = lesson.classroom?.name || lesson.roomName || "待定";
      const teacher = lesson.teachers?.map((t: any) => t.name).join(',') || "";
      
      // 优先使用数组，否则解析字符串
      const weeks = Array.isArray(lesson.weeks) ? lesson.weeks : (lesson.weekStr ? parseWeekString(lesson.weekStr) : []);
      const weekday = lesson.weekday || lesson.dayOfWeek;
      const startUnit = lesson.startUnit || lesson.startPeriod;
      const endUnit = lesson.endUnit || lesson.endPeriod;

      if (!weekday || !startUnit) return;

      weeks.forEach((week: number) => {
        const startConf = USTC_TIME_SLOTS[startUnit];
        const endConf = USTC_TIME_SLOTS[endUnit || startUnit];
        
        if (startConf && endConf) {
          const startDt = calculateClassDate(semesterStart, week, weekday, startConf.start);
          const endDt = calculateClassDate(semesterStart, week, weekday, endConf.end);

          scheduleItems.push({
            id: crypto.randomUUID(),
            title,
            location,
            type: 'course',
            category: 'first',
            startTime: format(startDt, "yyyy-MM-dd'T'HH:mm:ss"),
            endTime: format(endDt, "yyyy-MM-dd'T'HH:mm:ss"),
            description: teacher ? `教师: ${teacher}` : '第一课堂课程',
            weeks: [week]
          });
        }
      });
    });

    // 2. 处理研究生系统 HTML 表格 (YJS)
    if (graduateHtml) {
      const $ = cheerio.load(graduateHtml);
      // 研究生系统课表通常在 table 的 tr 中
      $('table tr').each((_, tr) => {
        const $tds = $(tr).find('td');
        if ($tds.length < 9) return;
        
        const title = $tds.eq(5).text().trim();
        const teacher = $tds.eq(7).text().trim();
        const weekStr = $tds.eq(6).text().trim();
        const periodStr = $tds.eq(8).text().trim(); // 格式: "地点: 1(1,2,3)"

        if (!title || !periodStr) return;

        const weeks = parseWeekString(weekStr);
        // 匹配 "地点: 星期(节次)"
        const locMatch = periodStr.match(/(.*?):\s*(\d)\((.*?)\)/);
        
        if (locMatch) {
          const location = locMatch[1].trim();
          const weekday = parseInt(locMatch[2]);
          const units = locMatch[3].split(',').map(Number);
          const startUnit = units[0];
          const endUnit = units[units.length - 1];

          weeks.forEach(week => {
            const startConf = USTC_TIME_SLOTS[startUnit];
            const endConf = USTC_TIME_SLOTS[endUnit];
            if (startConf && endConf) {
              const startDt = calculateClassDate(semesterStart, week, weekday, startConf.start);
              const endDt = calculateClassDate(semesterStart, week, weekday, endConf.end);
              scheduleItems.push({
                id: crypto.randomUUID(),
                title,
                location,
                type: 'course',
                category: 'first',
                startTime: format(startDt, "yyyy-MM-dd'T'HH:mm:ss"),
                endTime: format(endDt, "yyyy-MM-dd'T'HH:mm:ss"),
                description: `研究生课程 | 教师: ${teacher}`,
                weeks: [week]
              });
            }
          });
        }
      });
    }

    // 3. 处理第二课堂数据 (Young)
    secondClass.forEach((act: any) => {
      // 二课堂数据通常已有具体的 ISO 时间
      if (act.startTime && act.endTime) {
        scheduleItems.push({
          id: crypto.randomUUID(),
          title: act.name || act.title || "二课堂活动",
          location: act.location || act.place || "待定",
          type: 'activity',
          category: 'second',
          startTime: format(new Date(act.startTime), "yyyy-MM-dd'T'HH:mm:ss"),
          endTime: format(new Date(act.endTime), "yyyy-MM-dd'T'HH:mm:ss"),
          description: act.description || "同步自第二课堂系统"
        });
      }
    });

  } catch (e) {
    console.error("[Parser] 解析异常:", e);
    throw new Error("课表数据解析失败，请检查导入源数据格式");
  }

  return scheduleItems;
};
