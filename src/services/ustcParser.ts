
import { ScheduleItem } from '../types';
import { USTC_TIME_SLOTS, calculateClassDate } from './utils';
import { format, addWeeks, addDays, setHours, setMinutes } from 'date-fns';
import * as cheerio from 'cheerio';

/**
 * 解析从教务系统提取的 JSON 数据 (本科)
 */
export const parseJwJson = (input: any, semesterStart: string): ScheduleItem[] => {
  const scheduleItems: ScheduleItem[] = [];
  
  try {
    let lessons: any[] = [];
    let secondClass: any[] = [];
    let graduateHtml: string = "";

    if (input.firstClassroom) lessons = input.firstClassroom;
    if (input.secondClassroom) secondClass = input.secondClassroom;
    if (input.graduateHtml) graduateHtml = input.graduateHtml;

    // Direct array inputs
    if (Array.isArray(input)) lessons = input;
    if (input.lessons) lessons = input.lessons;

    // 1. 本科生 (First Classroom)
    if (lessons.length > 0) {
        lessons.forEach((lesson) => {
            const title = lesson.courseName || lesson.nameZh || lesson.name || "Unknown Course";
            const location = lesson.classroom?.name || lesson.room?.name || lesson.roomName || "TBD";
            
            let teacherName = "";
            if (lesson.teachers && Array.isArray(lesson.teachers)) {
                teacherName = lesson.teachers.map((t: any) => t.name).join(',');
            }

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
    }

    // 2. 研究生 (YJS)
    if (graduateHtml) {
        const yjsItems = parseYjsHtml(graduateHtml, semesterStart);
        scheduleItems.push(...yjsItems);
    }

    // 3. 第二课堂 (Young)
    if (secondClass.length > 0) {
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
    }

  } catch (e) {
      console.error("Parse Error:", e);
      throw new Error("Data Parsing Failed");
  }

  return scheduleItems;
};

/**
 * Ported from Kotlin USTCGraduateParser.kt
 * 解析研究生教务系统 HTML 表格
 */
const parseYjsHtml = (html: string, semesterStart: string): ScheduleItem[] => {
    const items: ScheduleItem[] = [];
    const $ = cheerio.load(html);

    // Try to find the iframe content if we parsed the portal page, 
    // otherwise assume we have the table page directly.
    let $table = $('table').first();
    const iframeSrc = $('iframe#iframeContent_kbcxappustcxskbcx').attr('srcdoc');
    if (iframeSrc) {
        const $iframe = cheerio.load(iframeSrc);
        $table = $iframe('table').first();
    }

    const $trs = $table.find('tr');
    
    // Graduate System Standard Time Slots (Mapped to USTC_TIME_SLOTS roughly or specific)
    // The Kotlin code defines its own slots but they map closely to standard ones.
    // We will parse times dynamically or use standard slots.

    $trs.each((idx, tr) => {
        const $tds = $(tr).find('td');
        // Kotlin: if (tds.lastIndex < 8) continue;
        // Indices: 1:Code, 5:Name, 6:Weeks, 7:Teacher, 8:TimeLoc
        if ($tds.length < 9) return; 

        // Helper to get text, handling span or direct text
        const getText = (idx: number) => {
            const el = $tds.eq(idx);
            return el.find('span').length > 0 ? el.find('span').text().trim() : el.text().trim();
        };

        const title = getText(5); // 课堂名称
        // const code = getText(1); // 课堂号
        const teacher = getText(7); // 教师
        const weekStr = getText(6); // 起止周 e.g., "2~6(双),7~15;3~5(单)"
        const periodStr = getText(8); // 上课时间地点 e.g., "G311: 1(1,2,3);..."

        if (!title || !periodStr) return;

        // Parse Periods (separated by ';')
        const periods = periodStr.split(';');
        const weekGroups = weekStr.split(';');

        periods.forEach((p, pIdx) => {
            if (!p.trim()) return;
            
            // Format: "Location: Weekday(StartNode...EndNode)" or "Location: Weekday(HH:MM~HH:MM)"
            // Kotlin: items = period.split(": ", "(", ",", ")")
            // Regex to parse: Location: Day(...)
            const locMatch = p.match(/(.*?):\s*(\d)\((.*?)\)/);
            if (!locMatch) return;

            const location = locMatch[1].trim();
            const weekday = parseInt(locMatch[2]); // 1-7
            const timeContent = locMatch[3]; // "1,2,3" or "18:40~21:55"

            let startUnit = 0;
            let endUnit = 0;
            let customStart = "";
            let customEnd = "";

            if (timeContent.includes('~') || timeContent.includes(':')) {
                // Time Range Format (e.g., 18:40~21:55)
                const times = timeContent.split('~');
                customStart = times[0];
                customEnd = times[1];
            } else {
                // Unit Format (e.g., 1,2,3)
                const units = timeContent.split(',').map(Number);
                startUnit = units[0];
                endUnit = units[units.length - 1];
            }

            // Parse Weeks for this period group
            // Note: periods index usually matches weekGroups index if size matches, 
            // otherwise weekGroups[0] applies to all. Logic implies 1-to-1 or 1-to-many.
            // Kotlin loop implies matching indices or generic. 
            // We'll try to match index, fallback to last or 0.
            const wStr = weekGroups[pIdx] || weekGroups[0] || ""; 
            
            const subWeeks = wStr.split(',');
            subWeeks.forEach(subW => {
                if (!subW.trim()) return;

                // Parse "2~6(双)" or "3"
                // Regex: (\d+)(?:~(\d+))?(?:\((.*?)\))?
                const wMatch = subW.match(/(\d+)(?:~(\d+))?(?:\((.*?)\))?/);
                if (!wMatch) return;

                let startW = parseInt(wMatch[1]);
                let endW = wMatch[2] ? parseInt(wMatch[2]) : startW;
                const type = wMatch[3]; // "单" or "双"

                for (let w = startW; w <= endW; w++) {
                    // Check Odd/Even
                    if (type === '单' && w % 2 === 0) continue;
                    if (type === '双' && w % 2 !== 0) continue;

                    // Calculate Time
                    let startDate: Date, endDate: Date;

                    if (customStart && customEnd) {
                        // Custom time logic
                        const [sh, sm] = customStart.split(':').map(Number);
                        const [eh, em] = customEnd.split(':').map(Number);
                        const dateBase = addDays(addWeeks(new Date(semesterStart), w - 1), weekday - 1); // semStart is Mon week 1
                        // Fix: semStart is usually week 1 monday. 
                        // Logic: addWeeks(start, w-1) gets Monday of week w. addDays(..., day-1) gets the day.
                        // Wait, calculateClassDate uses addWeeks(start, weekIndex - 1).
                        // Re-implement manually for custom time:
                        
                        // Recalc base
                        const baseDate = calculateClassDate(semesterStart, w, weekday, "00:00");
                        startDate = setMinutes(setHours(baseDate, sh), sm);
                        endDate = setMinutes(setHours(baseDate, eh), em);

                    } else {
                        // Unit logic
                        const startConf = USTC_TIME_SLOTS[startUnit];
                        const endConf = USTC_TIME_SLOTS[endUnit];
                        if (!startConf || !endConf) return; // skip invalid

                        startDate = calculateClassDate(semesterStart, w, weekday, startConf.start);
                        endDate = calculateClassDate(semesterStart, w, weekday, endConf.end);
                    }

                    items.push({
                        id: crypto.randomUUID(),
                        title: title,
                        location: location,
                        type: 'course',
                        startTime: format(startDate, "yyyy-MM-dd'T'HH:mm:ss"),
                        endTime: format(endDate, "yyyy-MM-dd'T'HH:mm:ss"),
                        description: teacher ? `Teacher: ${teacher}` : undefined,
                    });
                }
            });
        });
    });

    return items;
}
