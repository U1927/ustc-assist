
export type EventType = 'course' | 'activity' | 'exam' | 'study';
export type ClassroomCategory = 'first' | 'second' | 'none';

export interface ScheduleItem {
  id: string;
  title: string;
  location: string;
  type: EventType;
  category: ClassroomCategory; 
  startTime: string; // ISO string
  endTime: string; // ISO string
  description?: string;
  teacher?: string;
  weeks?: number[]; // 解析出的具体周次
}

export type Priority = 'high' | 'medium' | 'low';

export interface TodoItem {
  id: string;
  content: string;
  deadline?: string; 
  isCompleted: boolean;
  isExpired: boolean;
  tags: string[];
  priority: Priority;
}

export interface SemesterConfig {
  name: string;
  startDate: string;
  totalWeeks: number;
}

export interface AppSettings {
  earlyEightReminder: boolean;
  reminderMinutesBefore: number;
  semester: SemesterConfig;
}

export interface UserProfile {
  studentId: string;
  name: string;
  isLoggedIn: boolean;
  settings: AppSettings;
}

export enum ViewMode {
  WEEK = 'WEEK',
  MONTH = 'MONTH'
}
