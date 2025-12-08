import { ScheduleItem } from '../types';
import { isSameDay, areIntervalsOverlapping } from 'date-fns';

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
  // USTC ID Format: usually starts with letters (PB, SA, SC, BA, etc.) followed by year and sequence
  // Ref: https://www.teach.ustc.edu.cn/document/doc-administration/4063.html
  // Regex: 2-3 uppercase letters + 8-10 digits
  const regex = /^[A-Z]{2,3}\d{8,10}$/;
  // Allow simple numbers for demo too if strictly digits
  return regex.test(id) || /^\d{10}$/.test(id);
};