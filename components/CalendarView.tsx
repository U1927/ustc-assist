import React, { useMemo } from 'react';
import { ScheduleItem, ViewMode } from '../types';
import { 
  format, 
  addDays, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  getHours,
  getMinutes,
  differenceInMinutes
} from 'date-fns';
import { Clock, MapPin, Book } from 'lucide-react';

// Helpers to replace missing date-fns exports
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
  onDeleteEvent: (id: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ mode, currentDate, events, onDeleteEvent }) => {
  
  // Helper to color code events
  const getEventColor = (type: ScheduleItem['type']) => {
    switch (type) {
      case 'course': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'activity': return 'bg-green-100 border-green-300 text-green-800'; // Second classroom
      case 'exam': return 'bg-red-100 border-red-300 text-red-800';
      case 'study': return 'bg-purple-100 border-purple-300 text-purple-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 to 22:00

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header Days */}
        <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="p-2 text-center text-xs font-semibold text-gray-500 border-r">Time</div>
          {days.map(day => (
            <div key={day.toISOString()} className={`p-2 text-center border-r ${isSameDay(day, new Date()) ? 'bg-blue-50' : ''}`}>
              <div className="text-xs font-bold text-slate-700">{format(day, 'EEE')}</div>
              <div className="text-sm text-slate-500">{format(day, 'MM/dd')}</div>
            </div>
          ))}
        </div>

        {/* Time Grid */}
        <div className="flex-1 overflow-y-auto relative bg-white">
          <div className="grid grid-cols-8 relative" style={{ height: '960px' }}> {/* 16 hours * 60px */}
            
            {/* Time Labels */}
            <div className="col-span-1 border-r border-gray-100">
              {hours.map(h => (
                <div key={h} className="h-[60px] text-xs text-gray-400 p-1 text-right relative -top-2">
                  {h}:00
                </div>
              ))}
            </div>

            {/* Grid Cells & Events */}
            {days.map((day, dayIndex) => {
               // Filter events for this day
               const dayEvents = events.filter(e => isSameDay(parseISO(e.startTime), day));

               return (
                <div key={day.toISOString()} className="col-span-1 border-r border-gray-100 relative h-full">
                  {/* Horizontal grid lines */}
                  {hours.map(h => (
                     <div key={h} className="h-[60px] border-b border-gray-50 w-full absolute" style={{ top: `${(h - 7) * 60}px` }} />
                  ))}

                  {/* Render Events */}
                  {dayEvents.map(event => {
                    const start = parseISO(event.startTime);
                    const end = parseISO(event.endTime);
                    const startHour = getHours(start) + getMinutes(start) / 60;
                    const endHour = getHours(end) + getMinutes(end) / 60;
                    const durationHours = endHour - startHour;
                    
                    const top = (startHour - 7) * 60;
                    const height = durationHours * 60;

                    return (
                      <div 
                        key={event.id}
                        className={`absolute left-0.5 right-0.5 rounded px-1 py-1 text-xs border border-l-4 shadow-sm group overflow-hidden transition-all hover:z-10 hover:shadow-md ${getEventColor(event.type)}`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="flex justify-between items-start">
                           <span className="font-bold truncate">{event.title}</span>
                           <button 
                              onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }}
                              className="hidden group-hover:block text-red-500 hover:text-red-700 font-bold px-1 bg-white/50 rounded"
                           >
                             ×
                           </button>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 opacity-90 truncate">
                          <MapPin size={10} /> {event.location}
                        </div>
                        {event.textbook && (
                          <div className="flex items-center gap-1 mt-0.5 opacity-80 truncate">
                             <Book size={10} /> {event.textbook}
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
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    // const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 }); // helper below uses startOfWeek
    
    // date-fns endOfWeek helper if not imported
    const finalDate = addDays(startDate, 41); // Ensure 6 rows

    const days = eachDayOfInterval({ start: startDate, end: finalDate });

    return (
      <div className="grid grid-cols-7 grid-rows-6 h-full border-t border-l border-gray-200">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="bg-gray-50 text-center py-1 text-xs font-semibold text-gray-500 border-r border-b">
            {d}
          </div>
        ))}
        {days.slice(0, 42).map(day => {
          const dayEvents = events.filter(e => isSameDay(parseISO(e.startTime), day));
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();

          return (
            <div key={day.toISOString()} className={`border-r border-b p-1 min-h-[80px] ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}`}>
              <div className={`text-xs mb-1 font-medium ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-gray-500'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div key={event.id} className={`text-[10px] px-1 rounded truncate border-l-2 ${getEventColor(event.type)}`}>
                    {format(parseISO(event.startTime), 'HH:mm')} {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-gray-400 pl-1">+ {dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {mode === ViewMode.WEEK ? renderWeekView() : renderMonthView()}
    </div>
  );
};

// Local helper just in case
const endOfWeek = (date: Date, options?: { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) => {
   const weekStart = startOfWeek(date, options as any);
   return addDays(weekStart, 6);
}

export default CalendarView;