
import { ScheduleItem, SemesterConfig } from '../types';
import { areIntervalsOverlapping, addWeeks, addDays, setHours, setMinutes, parseISO, format } from 'date-fns';

// USTC 13-period System
export const USTC_TIME_SLOTS: Record<number, { start: string; end: string }> = {
  1:  { start: '07:50', end: '08:35' },
  2:  { start: '08:40', end: '09:25' },
  3:  { start: '09:45', end: '10:30' },
  4:  { start: '10:35', end: '11:20' },
  5:  { start: '11:25', end: '12:10' },
  6:  { start: '14:00', end: '14:45' },
  7:  { start: '14:50', end: '15:35' },
  8:  { start: '15:55', end: '16:40' },
  9:  { start: '16:45', end: '17:30' },
  10: { start: '17:35', end: '18:20' },
  11: { start: '19:30', end: '20:15' },
  12: { start: '20:20', end: '21:05' },
  13: { start: '21:10', end: '21:55' },
};

export const COMMON_PERIODS = [
  { label: '1-2 (Early Morning)', start: 1, end: 2 },
  { label: '3-4 (Morning 1)', start: 3, end: 4 },
  { label: '3-5 (Morning Long)', start: 3, end: 5 },
  { label: '6-7 (Afternoon 1)', start: 6, end: 7 },
  { label: '8-9 (Afternoon 2)', start: 8, end: 9 },
  { label: '8-10 (Afternoon Long)', start: 8, end: 10 },
  { label: '11-12 (Evening)', start: 11, end: 12 },
  { label: '11-13 (Evening Long)', start: 11, end: 13 },
];

export const checkForConflicts = (newItem: ScheduleItem, existingItems: ScheduleItem[]): boolean => {
  const newStart = new Date(newItem.startTime);
  const newEnd = new Date(newItem.endTime);

  return existingItems.some(item => {
    if (item.id === newItem.id) return false; // Don't check against self
    const itemStart = new Date(item.startTime);
    const itemEnd = new Date(item.endTime);
    
    return areIntervalsOverlapping(
      { start: newStart, end: newEnd },
      { start: itemStart, end: itemEnd }
    );
  });
};

export const getConflicts = (items: ScheduleItem[]): string[] => {
  const conflicts: string[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      
      const overlap = areIntervalsOverlapping(
        { start: new Date(a.startTime), end: new Date(a.endTime) },
        { start: new Date(b.startTime), end: new Date(b.endTime) }
      );

      if (overlap) {
        conflicts.push(`Conflict: ${a.title} overlaps with ${b.title}`);
      }
    }
  }
  return [...new Set(conflicts)];
};

export const validateStudentId = (id: string): boolean => {
  // Regex: 2-3 uppercase letters + 8-10 digits, or just 10 digits
  const regex = /^[A-Z]{2,3}\d{8,10}$/;
  return regex.test(id) || /^\d{10}$/.test(id);
};

// --- Course Generation Helpers ---

export const getSemesterDefaultStartDate = (): string => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  
  // Simple heuristic: 
  // If Feb-Jul -> Spring Semester (Start approx Feb 20)
  // If Aug-Jan -> Fall Semester (Start approx Sept 1)
  
  let targetDate: Date;
  
  if (month >= 1 && month <= 6) {
    // Spring
    targetDate = new Date(year, 1, 20); // Feb 20
  } else {
    // Fall
    targetDate = new Date(month === 0 ? year - 1 : year, 8, 1); // Sept 1
  }

  // Find the Monday of that week
  const day = targetDate.getDay();
  const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(targetDate.setDate(diff));
  
  return format(monday, 'yyyy-MM-dd');
};

export const calculateClassDate = (
  semesterStart: string, 
  weekIndex: number, // 1-based index (e.g. Week 1, Week 2)
  dayIndex: number,  // 1=Mon, 7=Sun
  timeString: string // "HH:MM"
): Date => {
  const start = parseISO(semesterStart);
  
  // Add weeks (weekIndex - 1 because adding 0 weeks gives us week 1)
  const weekDate = addWeeks(start, weekIndex - 1);
  
  // Add days (dayIndex - 1 because start is Monday)
  const targetDate = addDays(weekDate, dayIndex - 1);
  
  const [hours, minutes] = timeString.split(':').map(Number);
  
  return setMinutes(setHours(targetDate, hours), minutes);
};
