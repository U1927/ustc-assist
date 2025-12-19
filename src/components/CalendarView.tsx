
import React from 'react';
import { ScheduleItem, ViewMode, TodoItem } from '../types';
import { 
  format, 
  addDays, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  getHours,
  getMinutes,
  compareAsc
} from 'date-fns';
import { MapPin, Book } from 'lucide-react';

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
  todos: TodoItem[];
  onDeleteEvent: (id: string) => void;
  onSelectEvent: (event: ScheduleItem) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ 
  mode, 
  currentDate, 
  events, 
  todos,
  onDeleteEvent,
  onSelectEvent
}) => {
  
  // Helper to color code events
  const getEventColor = (type: ScheduleItem['type']) => {
    switch (type) {
      case 'course': return 'bg-blue-100 border-blue-400 text-blue-900 hover:bg-blue-200';
      case 'activity': return 'bg-green-100 border-green-400 text-green-900 hover:bg-green-200';
      case 'exam': return 'bg-red-100 border-red-400 text-red-900 hover:bg-red-200';
      case 'study': return 'bg-purple-100 border-purple-400 text-purple-900 hover:bg-purple-200';
      default: return 'bg-gray-100 border-gray-400 text-gray-900';
    }
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    // 00:00 to 24:00 (24 hours)
    const hours = Array.from({ length: 24 }, (_, i) => i); 
    const HOUR_HEIGHT = 60; // px
    
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
          <div className="grid grid-cols-8 relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
            
            {/* Time Labels */}
            <div className="col-span-1 border-r border-gray-100 bg-white z-10">
              {hours.map(h => (
                <div key={h} className="text-xs text-gray-400 pr-2 text-right relative -top-2" style={{ height: `${HOUR_HEIGHT}px` }}>
                  {h}:00
                </div>
              ))}
            </div>

            {/* Grid Cells & Events */}
            {days.map((day, dayIndex) => {
               // Filter events for this day
               const dayEvents = events.filter(e => isSameDay(parseISO(e.startTime), day));
               
               // Filter todos with deadlines on this day
               const dayTodos = todos.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day) && !t.isCompleted);

               return (
                <div key={day.toISOString()} className="col-span-1 border-r border-gray-100 relative h-full">
                  {/* Horizontal grid lines */}
                  {hours.map(h => (
                     <div key={h} className="border-b border-gray-50 w-full absolute" style={{ top: `${h * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }} />
                  ))}

                  {/* Render Todo Deadlines */}
                  {dayTodos.map(todo => {
                    const ddl = parseISO(todo.deadline!);
                    const ddlHour = getHours(ddl) + getMinutes(ddl) / 60;
                    const top = ddlHour * HOUR_HEIGHT;
                    
                    return (
                      <div 
                        key={todo.id}
                        className="absolute w-full z-20 group"
                        style={{ top: `${top}px` }}
                      >
                         {/* DDL Line */}
                         <div className="w-full border-t border-red-400 border-dashed opacity-70"></div>
                         {/* Todo Label */}
                         <div className="absolute -top-4 left-0 right-0">
                            <span className="text-[10px] bg-red-50 text-red-600 px-1 rounded shadow-sm border border-red-100 truncate block max-w-full">
                              Due: {todo.content}
                            </span>
                         </div>
                      </div>
                    );
                  })}

                  {/* Render Events */}
                  {dayEvents.map(event => {
                    const start = parseISO(event.startTime);
                    const end = parseISO(event.endTime);
                    const startHour = getHours(start) + getMinutes(start) / 60;
                    const endHour = getHours(end) + getMinutes(end) / 60;
                    const durationHours = endHour - startHour;
                    
                    const top = startHour * HOUR_HEIGHT;
                    const height = Math.max(durationHours * HOUR_HEIGHT, 24); // Min height ensures readability

                    return (
                      <div 
                        key={event.id}
                        onClick={() => onSelectEvent(event)}
                        className={`absolute left-0.5 right-0.5 rounded px-1 text-xs border border-l-4 shadow-sm group overflow-hidden transition-all hover:z-30 hover:shadow-md cursor-pointer flex flex-col justify-center ${getEventColor(event.type)}`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        {/* Corner Times */}
                        <div className="absolute top-0.5 left-1 text-[9px] font-mono opacity-60 leading-none">{format(start, 'HH:mm')}</div>
                        <div className="absolute bottom-0.5 right-1 text-[9px] font-mono opacity-60 leading-none">{format(end, 'HH:mm')}</div>

                        <div className="px-0.5 py-3 w-full">
                           <div className="font-bold truncate leading-tight">{event.title}</div>
                           {height > 40 && (
                             <div className="flex items-center gap-1 mt-0.5 opacity-90 truncate text-[10px]">
                               <MapPin size={10} /> {event.location}
                             </div>
                           )}
                        </div>

                        <button 
                              onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }}
                              className="absolute top-0 right-0 hidden group-hover:block text-red-500 hover:text-red-700 font-bold px-1 bg-white/50 rounded-bl"
                        >
                          ×
                        </button>
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
          const dayEvents = events
             .filter(e => isSameDay(parseISO(e.startTime), day))
             .sort((a, b) => compareAsc(parseISO(a.startTime), parseISO(b.startTime)));
             
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();

          return (
            <div key={day.toISOString()} className={`border-r border-b p-1 flex flex-col h-full overflow-hidden ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}`}>
              <div className={`text-xs mb-1 font-medium flex-shrink-0 ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-gray-500'}`}>
                {format(day, 'd')}
              </div>
              
              {/* Scrollable Event List */}
              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                {dayEvents.map(event => (
                  <div 
                    key={event.id} 
                    onClick={() => onSelectEvent(event)}
                    className={`text-[10px] px-1 py-0.5 rounded truncate border-l-2 cursor-pointer transition hover:opacity-80 ${getEventColor(event.type)}`}
                  >
                    <span className="font-mono opacity-70 mr-1">{format(parseISO(event.startTime), 'HH:mm')}</span>
                    {event.title}
                  </div>
                ))}
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

export default CalendarView;
