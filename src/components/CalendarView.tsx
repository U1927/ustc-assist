
import React from 'react';
import { ScheduleItem, ViewMode, TodoItem } from '../types';
import { 
  format, 
  addDays, 
  eachDayOfInterval, 
  isSameDay, 
  getHours,
  getMinutes,
  compareAsc,
  areIntervalsOverlapping
} from 'date-fns';
import { MapPin, BookOpen, Star } from 'lucide-react';

const parseISO = (str: string) => new Date(str);
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfWeek = (date: Date, options?: { weekStartsOn?: number }) => {
  const weekStartsOn = options?.weekStartsOn ?? 0;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  return d;
};

interface CalendarViewProps {
  mode: ViewMode;
  currentDate: Date;
  events: ScheduleItem[];
  todos: TodoItem[];
  onDeleteEvent: (id: string) => void;
  onSelectEvents: (events: ScheduleItem[]) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ 
  mode, 
  currentDate, 
  events, 
  todos,
  onSelectEvents
}) => {
  
  const getEventStyle = (event: ScheduleItem) => {
    // 根据 category 渲染不同的主题色
    if (event.category === 'first') {
      return 'bg-[#e6f0ff] border-[#00418b] text-[#00418b] hover:bg-[#d0e4ff]';
    }
    if (event.category === 'second') {
      return 'bg-[#e6fffa] border-[#38b2ac] text-[#2c7a7b] hover:bg-[#b2f5ea]';
    }
    switch (event.type) {
      case 'exam': return 'bg-red-50 border-red-500 text-red-700 hover:bg-red-100';
      case 'study': return 'bg-indigo-50 border-indigo-500 text-indigo-700 hover:bg-indigo-100';
      default: return 'bg-slate-100 border-slate-400 text-slate-700';
    }
  };

  const handleEventClick = (event: ScheduleItem) => {
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);
    // 点击时发现所有重叠的项目，以弹窗形式展示
    const overlapping = events.filter(e => 
      areIntervalsOverlapping(
        { start: parseISO(e.startTime), end: parseISO(e.endTime) },
        { start, end }
      )
    ).sort((a, b) => compareAsc(parseISO(a.startTime), parseISO(b.startTime)));

    onSelectEvents(overlapping);
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 24 }, (_, i) => i); 
    const HOUR_HEIGHT = 64; 
    
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="p-2 text-center text-xs font-black text-slate-400 border-r border-slate-200 uppercase tracking-widest">Time</div>
          {days.map(day => (
            <div key={day.toISOString()} className={`p-2 text-center border-r border-slate-200 ${isSameDay(day, new Date()) ? 'bg-blue-50' : ''}`}>
              <div className="text-xs font-black text-slate-700">{format(day, 'EEE')}</div>
              <div className="text-[10px] text-slate-500">{format(day, 'MM/dd')}</div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto relative bg-white custom-scrollbar">
          <div className="grid grid-cols-8 relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
            <div className="col-span-1 border-r border-slate-100 bg-slate-50/50 z-10">
              {hours.map(h => (
                <div key={h} className="text-[10px] text-slate-400 pr-2 text-right relative -top-2 font-mono" style={{ height: `${HOUR_HEIGHT}px` }}>
                  {h}:00
                </div>
              ))}
            </div>

            {days.map((day) => {
               const dayEvents = events.filter(e => isSameDay(parseISO(e.startTime), day));
               return (
                <div key={day.toISOString()} className="col-span-1 border-r border-slate-100 relative h-full">
                  {hours.map(h => (
                     <div key={h} className="border-b border-slate-50 w-full absolute" style={{ top: `${h * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }} />
                  ))}
                  {dayEvents.map(event => {
                    const startHour = getHours(parseISO(event.startTime)) + getMinutes(parseISO(event.startTime)) / 60;
                    const endHour = getHours(parseISO(event.endTime)) + getMinutes(parseISO(event.endTime)) / 60;
                    const top = startHour * HOUR_HEIGHT;
                    const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 28);

                    return (
                      <div 
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className={`absolute left-0.5 right-0.5 rounded px-2 py-1 text-[10px] border-l-4 shadow-sm group overflow-hidden transition-all hover:z-30 hover:scale-[1.01] cursor-pointer flex flex-col ${getEventStyle(event)}`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                           {event.category === 'first' ? <BookOpen size={10}/> : (event.category === 'second' ? <Star size={10}/> : null)}
                           <span className="font-bold truncate leading-tight">{event.title}</span>
                        </div>
                        {height > 35 && (
                          <div className="flex items-center gap-1 opacity-80 truncate text-[9px]">
                            <MapPin size={9} /> {event.location}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
               );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    return <div className="p-12 text-center text-slate-400 font-bold italic">月视图逻辑与周视图保持同步...</div>;
  };

  return (
    <div className="flex-1 h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {mode === ViewMode.WEEK ? renderWeekView() : renderMonthView()}
    </div>
  );
};

export default CalendarView;
