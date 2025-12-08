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

export interface TodoItem {
  id: string;
  content: string;
  deadline?: string; // ISO string
  isCompleted: boolean;
  isExpired: boolean;
  tags: string[];
}

export interface AppSettings {
  earlyEightReminder: boolean;
  reminderMinutesBefore: number;
  supabaseUrl?: string;
  supabaseKey?: string;
  proxyUrl?: string; // URL of the Node.js crawler server
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