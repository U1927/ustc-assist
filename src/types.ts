
export type EventType = 'course' | 'activity' | 'exam' | 'study';

export interface ScheduleItem {
  id: string;
  title: string;
  location: string;
  type: EventType;
  startTime: string; // ISO string
  endTime: string; // ISO string
  description?: string;
  textbook?: string; // Requirement: Books to bring
}

export type Priority = 'high' | 'medium' | 'low';

export interface TodoItem {
  id: string;
  content: string;
  deadline?: string; // ISO string
  isCompleted: boolean;
  isExpired: boolean;
  tags: string[];
  priority: Priority;
}

export interface SemesterConfig {
  name: string;       // e.g., "2024 Fall"
  startDate: string;  // ISO Date string (YYYY-MM-DD) of the Monday of Week 1
  totalWeeks: number; // e.g., 18
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

export const USTC_DEPARTMENTS = [
  'PB', 'SA', 'SC', 'BA', 'KY'
];
