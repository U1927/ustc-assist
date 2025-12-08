import { ScheduleItem, TodoItem, UserProfile } from '../types';

const KEYS = {
  SCHEDULE: 'ustc_assist_schedule',
  TODOS: 'ustc_assist_todos',
  USER: 'ustc_assist_user',
};

// Requirement: Persistent storage
export const saveSchedule = (items: ScheduleItem[]) => {
  localStorage.setItem(KEYS.SCHEDULE, JSON.stringify(items));
};

export const getSchedule = (): ScheduleItem[] => {
  const data = localStorage.getItem(KEYS.SCHEDULE);
  return data ? JSON.parse(data) : [];
};

export const saveTodos = (items: TodoItem[]) => {
  localStorage.setItem(KEYS.TODOS, JSON.stringify(items));
};

export const getTodos = (): TodoItem[] => {
  const data = localStorage.getItem(KEYS.TODOS);
  return data ? JSON.parse(data) : [];
};

export const saveUser = (user: UserProfile) => {
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
};

export const getUser = (): UserProfile | null => {
  const data = localStorage.getItem(KEYS.USER);
  return data ? JSON.parse(data) : null;
};

export const clearData = () => {
  localStorage.clear();
};