
import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import CalendarView from './components/CalendarView';
import Sidebar from './components/Sidebar';
import SettingsDialog from './components/SettingsDialog';
import ImportDialog from './components/ImportDialog';
import { ScheduleItem, TodoItem, UserProfile, ViewMode, AppSettings, Priority } from './types';
import * as Storage from './services/storageService';
import * as Utils from './services/utils';
import * as UstcParser from './services/ustcParser';
import { generateStudyPlan } from './services/aiService';
import { Plus, ChevronLeft, ChevronRight, LogOut, Loader2, Settings, Cloud, CheckCircle, WifiOff, Trash2, X, Clock, MapPin, BookOpen, AlignLeft } from 'lucide-react';
import { addWeeks, addMonths, format, differenceInMinutes, isPast } from 'date-fns';

type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';
type AddMode = 'single' | 'course';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<ScheduleItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.WEEK);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('single');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleItem | null>(null);
  
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Single Event Form
  const [newEvent, setNewEvent] = useState<Partial<ScheduleItem>>({ type: 'activity', startTime: '', endTime: '' });

  // Course Series Form
  const [courseForm, setCourseForm] = useState({
    title: '',
    location: '',
    textbook: '',
    weekStart: 1,
    weekEnd: 18,
    schedule: [{ day: 1, periods: '3-4' }] as { day: number, periods: string }[]
  });

  // 1. Initialization
  useEffect(() => {
    const savedUser = Storage.getUserSession();
    if (savedUser && savedUser.isLoggedIn) {
      setUser(savedUser);
    }
  }, []);

  // Separate effect for loading cloud data
  useEffect(() => {
    let isActive = true;

    if (user && user.isLoggedIn) {
      const fetchCloud = async () => {
        if (!isActive) return;
        setSyncStatus('syncing');
        console.log(`[App] Loading cloud data for ${user.studentId}...`);
        
        const data = await Storage.fetchUserData(user.studentId);
        
        if (isActive) {
          if (data) {
            console.log(`[App] Data loaded. Events: ${data.schedule.length}, Todos: ${data.todos.length}`);
            setEvents(data.schedule);
            setTodos(data.todos);
            setIsDataLoaded(true); 
            setSyncStatus('idle');
          } else {
            console.warn("[App] Failed to load data. Starting with empty state.");
            setIsDataLoaded(true); 
            setSyncStatus('error');
          }
        }
      };
      
      fetchCloud();
    }

    return () => { isActive = false; };
  }, [user?.studentId]);

  // 2. Auto-Save Logic
  useEffect(() => {
    let isActive = true;
    if (!user || !isDataLoaded) return;

    const timeoutId = setTimeout(async () => {
      if (!isActive) return;
      setSyncStatus('syncing');
      
      const result = await Storage.saveUserData(user.studentId, events, todos);
      
      if (isActive) {
          if (result.success) {
            setSyncStatus('saved');
            setTimeout(() => { if(isActive) setSyncStatus('idle'); }, 2000);
          } else {
            setSyncStatus('error');
          }
      }
    }, 500);

    setConflicts(Utils.getConflicts(events));
    
    return () => {
      clearTimeout(timeoutId);
      isActive = false;
    };
  }, [events, todos, user, isDataLoaded]);

  // 3. Persist Session
  useEffect(() => {
    if (user) Storage.saveUserSession(user);
  }, [user]);

  // 4. Reminders
  useEffect(() => {
    const interval = setInterval(() => {
      if (!user) return;
      const now = new Date();
      events.forEach(event => {
        const start = new Date(event.startTime);
        const diffMinutes = differenceInMinutes(start, now);
        if (diffMinutes === user.settings.reminderMinutesBefore) {
          if (Notification.permission === 'granted') {
             new Notification(`Upcoming: ${event.title}`, { body: `Starts in ${diffMinutes} minutes.` });
          }
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [events, user]);

  const handleForceSync = async () => {
    if (!user) return;
    const result = await Storage.saveUserData(user.studentId, events, todos);
    if (result.success) alert("Manual Sync Successful!");
    else alert(`Manual Sync Failed: ${result.error}`);
  };

  const handleChangePassword = async (oldPass: string, newPass: string) => {
    if (!user) return { success: false, error: "Not logged in" };
    return await Storage.changePassword(user.studentId, oldPass, newPass);
  };

  const handleImportJson = (jsonStr: string) => {
    if (!user?.settings.semester?.startDate) {
      alert("Please check your semester start date in settings before importing.");
      return;
    }

    try {
      const newItems = UstcParser.parseJwJson(jsonStr, user.settings.semester.startDate);
      if (newItems.length === 0) {
        alert("No valid courses found in JSON. Please check the content.");
        return;
      }
      
      const existingSignatures = new Set(events.map(e => `${e.title}-${e.startTime}`));
      const uniqueItems = newItems.filter(item => !existingSignatures.has(`${item.title}-${item.startTime}`));
      
      if (uniqueItems.length === 0) {
        alert("All found courses already exist in calendar.");
        setShowImportModal(false);
        return;
      }

      setEvents(prev => [...prev, ...uniqueItems]);
      setShowImportModal(false);
      alert(`Successfully imported ${uniqueItems.length} course sessions!`);
    } catch (e: any) {
      alert(`Import Failed: ${e.message}`);
    }
  };

  const handleLogin = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    Storage.saveUserSession(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    Storage.clearSession();
    setIsDataLoaded(false);
    setEvents([]);
    window.location.reload();
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    if (user) setUser({ ...user, settings: newSettings });
  };

  // --- ADD EVENT LOGIC ---

  const handleAddSingleEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.startTime || !newEvent.endTime) return;

    const item: ScheduleItem = {
      id: crypto.randomUUID(),
      title: newEvent.title!,
      location: newEvent.location || 'TBD',
      type: newEvent.type as any,
      startTime: newEvent.startTime!,
      endTime: newEvent.endTime!,
      textbook: newEvent.textbook,
      description: newEvent.description
    };

    if (Utils.checkForConflicts(item, events)) {
       if (!confirm("⚠️ Conflict detected! Add anyway?")) return;
    }

    setEvents([...events, item]);
    setShowAddModal(false);
    setNewEvent({ type: 'activity', startTime: '', endTime: '' });
  };

  const handleAddCourseSeries = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.title || !user?.settings.semester?.startDate) {
        alert("Please enter title and ensure semester start date is set.");
        return;
    }

    const newItems: ScheduleItem[] = [];
    const semesterStart = user.settings.semester.startDate;

    // Iterate weeks
    for (let w = courseForm.weekStart; w <= courseForm.weekEnd; w++) {
        courseForm.schedule.forEach(slot => {
             // Find time slots
             const periods = slot.periods.split('-').map(Number);
             const startPeriod = periods[0];
             const endPeriod = periods[periods.length - 1];

             const startConfig = Utils.USTC_TIME_SLOTS[startPeriod];
             const endConfig = Utils.USTC_TIME_SLOTS[endPeriod];

             if (startConfig && endConfig) {
                 const startDt = Utils.calculateClassDate(semesterStart, w, slot.day, startConfig.start);
                 const endDt = Utils.calculateClassDate(semesterStart, w, slot.day, endConfig.end);

                 newItems.push({
                     id: crypto.randomUUID(),
                     title: courseForm.title,
                     location: courseForm.location || 'TBD',
                     type: 'course',
                     startTime: format(startDt, "yyyy-MM-dd'T'HH:mm:ss"),
                     endTime: format(endDt, "yyyy-MM-dd'T'HH:mm:ss"),
                     textbook: courseForm.textbook,
                     description: `Week ${w} Class`
                 });
             }
        });
    }

    setEvents([...events, ...newItems]);
    setShowAddModal(false);
    setCourseForm({
        title: '',
        location: '',
        textbook: '',
        weekStart: 1,
        weekEnd: 18,
        schedule: [{ day: 1, periods: '3-4' }]
    });
    alert(`Added ${newItems.length} course sessions!`);
  };

  // --- TODO LOGIC ---
  const handleAddTodo = (content: string, deadline?: string, priority: Priority = 'medium') => {
    const todo: TodoItem = {
      id: crypto.randomUUID(),
      content,
      deadline,
      isCompleted: false,
      isExpired: false, 
      tags: [],
      priority
    };
    setTodos([...todos, todo]);
  };

  const handleToggleTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
  };

  const handleDeleteTodo = (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('Delete this event?')) {
      setEvents(events.filter(e => e.id !== id));
      if (selectedEvent?.id === id) setSelectedEvent(null);
    }
  };

  const handleGeneratePlan = async () => {
    setIsLoadingAI(true);
    const topics = todos.filter(t => !t.isCompleted).map(t => t.content).join(", ") || "General Revision";
    const newPlan = await generateStudyPlan(events, topics);
    if (newPlan.length > 0) {
       setEvents(prev => [...prev, ...newPlan]);
    } else {
       alert("Could not generate a plan. Ensure API Key is set.");
    }
    setIsLoadingAI(false);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
     if (viewMode === ViewMode.WEEK) {
       setCurrentDate(d => direction === 'prev' ? addWeeks(d, -1) : addWeeks(d, 1));
     } else {
       setCurrentDate(d => direction === 'prev' ? addMonths(d, -1) : addMonths(d, 1));
     }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-slate-800">
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm z-10 relative">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-blue-900 tracking-tight flex items-center gap-2">
              <span className="bg-blue-900 text-white p-1 rounded text-xs">USTC</span>
              Assistant
            </h1>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => setViewMode(ViewMode.WEEK)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewMode === ViewMode.WEEK ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}
              >
                Week
              </button>
              <button 
                onClick={() => setViewMode(ViewMode.MONTH)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewMode === ViewMode.MONTH ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}
              >
                Month
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={() => navigateDate('prev')} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={20} /></button>
              <span className="text-sm font-semibold w-32 text-center">
                {viewMode === ViewMode.WEEK ? 
                  `Week of ${format(currentDate, 'MMM d')}` : 
                  format(currentDate, 'MMMM yyyy')}
              </span>
              <button onClick={() => navigateDate('next')} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={20} /></button>
            </div>
            <button 
               onClick={() => setCurrentDate(new Date())}
               className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-4">
             {/* Sync Status Indicator */}
             <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 bg-gray-50 rounded-full border border-gray-100">
                {syncStatus === 'idle' && <Cloud size={14} className="text-gray-400" />}
                {syncStatus === 'syncing' && <Loader2 size={14} className="text-blue-500 animate-spin" />}
                {syncStatus === 'saved' && <CheckCircle size={14} className="text-green-500" />}
                {syncStatus === 'error' && <WifiOff size={14} className="text-red-500" />}
                <span className={`${syncStatus === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                   {syncStatus === 'idle' ? 'Synced' : syncStatus === 'syncing' ? 'Saving...' : syncStatus === 'saved' ? 'Saved' : 'Offline'}
                </span>
             </div>

             <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
               <span className="font-mono font-bold text-gray-700">{user.studentId}</span>
               {/* <span className="w-px h-3 bg-gray-300 mx-1"></span>
               <span className="font-medium max-w-[100px] truncate">{user.name}</span> */}
             </div>
             
             <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 shadow-sm transition active:scale-95">
               <Plus size={16} /> Add
             </button>
             <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition p-1 hover:bg-gray-100 rounded">
               <LogOut size={20} />
             </button>
          </div>
        </header>

        {/* Calendar Grid */}
        <main className="flex-1 overflow-hidden p-4 relative">
          <CalendarView 
            mode={viewMode}
            currentDate={currentDate}
            events={events}
            todos={todos}
            onDeleteEvent={handleDeleteEvent}
            onSelectEvent={setSelectedEvent}
          />
        </main>
      </div>

      {/* Right Sidebar */}
      <Sidebar 
        todos={todos}
        onAddTodo={handleAddTodo}
        onToggleTodo={handleToggleTodo}
        onDeleteTodo={handleDeleteTodo}
        onGeneratePlan={handleGeneratePlan}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenImport={() => setShowImportModal(true)}
        conflicts={conflicts}
        isLoadingAI={isLoadingAI}
      />

      {/* Modals */}
      <SettingsDialog 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={user.settings}
        onSave={handleUpdateSettings}
        onForceSync={handleForceSync}
        onChangePassword={handleChangePassword}
      />

      <ImportDialog 
         isOpen={showImportModal}
         onClose={() => setShowImportModal(false)}
         onImport={handleImportJson}
      />

      {/* Event Details Popover */}
      {selectedEvent && (
         <div className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center backdrop-blur-sm" onClick={() => setSelectedEvent(null)}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-80 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-800 leading-tight">{selectedEvent.title}</h3>
                  <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
               </div>
               
               <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                     <Clock size={16} className="text-blue-500"/>
                     <span>
                        {format(new Date(selectedEvent.startTime), 'EEE, HH:mm')} - {format(new Date(selectedEvent.endTime), 'HH:mm')}
                     </span>
                  </div>
                  <div className="flex items-center gap-2">
                     <MapPin size={16} className="text-red-500"/>
                     <span>{selectedEvent.location}</span>
                  </div>
                  {selectedEvent.textbook && (
                     <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-green-500"/>
                        <span>{selectedEvent.textbook}</span>
                     </div>
                  )}
                  {selectedEvent.description && (
                     <div className="flex items-start gap-2 bg-gray-50 p-2 rounded">
                        <AlignLeft size={16} className="text-gray-400 mt-0.5"/>
                        <p className="text-xs leading-relaxed">{selectedEvent.description}</p>
                     </div>
                  )}
               </div>

               <div className="mt-6 pt-4 border-t flex justify-end gap-2">
                  <button 
                     onClick={() => handleDeleteEvent(selectedEvent.id)}
                     className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition"
                  >
                     <Trash2 size={14}/> Delete
                  </button>
                  <button 
                     onClick={() => setSelectedEvent(null)}
                     className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-xs font-bold transition"
                  >
                     Close
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-[450px] max-w-full animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center">
               <h2 className="text-lg font-bold text-gray-800">Add to Schedule</h2>
               <button onClick={() => setShowAddModal(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
               <button 
                 onClick={() => setAddMode('single')}
                 className={`flex-1 py-2 text-sm font-medium ${addMode === 'single' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
               >
                 Single Event
               </button>
               <button 
                 onClick={() => setAddMode('course')}
                 className={`flex-1 py-2 text-sm font-medium ${addMode === 'course' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
               >
                 Course Series
               </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {addMode === 'single' ? (
                <form onSubmit={handleAddSingleEvent} className="space-y-3">
                  <input 
                    className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Title (e.g. Club Meeting)" 
                    required
                    value={newEvent.title || ''}
                    onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                  />
                  <select 
                    className="w-full border p-2 rounded text-sm outline-none"
                    value={newEvent.type}
                    onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}
                  >
                    <option value="activity">Activity</option>
                    <option value="exam">Exam</option>
                    <option value="study">Self Study</option>
                    <option value="course">Makeup Class</option>
                  </select>
                  <input 
                    className="w-full border p-2 rounded text-sm outline-none" 
                    placeholder="Location" 
                    value={newEvent.location || ''}
                    onChange={e => setNewEvent({...newEvent, location: e.target.value})}
                  />
                  <textarea 
                    className="w-full border p-2 rounded text-sm outline-none resize-none h-20" 
                    placeholder="Description / Notes" 
                    value={newEvent.description || ''}
                    onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Start</label>
                      <input 
                        type="datetime-local" 
                        required
                        className="w-full border p-2 rounded text-xs"
                        value={newEvent.startTime}
                        onChange={e => setNewEvent({...newEvent, startTime: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">End</label>
                      <input 
                        type="datetime-local" 
                        required
                        className="w-full border p-2 rounded text-xs"
                        value={newEvent.endTime}
                        onChange={e => setNewEvent({...newEvent, endTime: e.target.value})}
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-2.5 mt-2 text-sm bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Add Event</button>
                </form>
              ) : (
                <form onSubmit={handleAddCourseSeries} className="space-y-4">
                   <div className="space-y-2">
                      <input 
                        className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                        placeholder="Course Name (e.g. Linear Algebra)" 
                        required
                        value={courseForm.title}
                        onChange={e => setCourseForm({...courseForm, title: e.target.value})}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                            className="w-full border p-2 rounded text-sm outline-none" 
                            placeholder="Location (e.g. 3C102)" 
                            value={courseForm.location}
                            onChange={e => setCourseForm({...courseForm, location: e.target.value})}
                        />
                        <input 
                            className="w-full border p-2 rounded text-sm outline-none" 
                            placeholder="Textbook" 
                            value={courseForm.textbook}
                            onChange={e => setCourseForm({...courseForm, textbook: e.target.value})}
                        />
                      </div>
                   </div>

                   <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                      <h3 className="text-xs font-bold text-gray-500 uppercase">Schedule Logic</h3>
                      
                      <div className="flex items-center gap-2 text-sm">
                         <span className="text-gray-600">Weeks:</span>
                         <input 
                            type="number" min="1" max="30"
                            className="w-16 border p-1 rounded text-center outline-none"
                            value={courseForm.weekStart}
                            onChange={e => setCourseForm({...courseForm, weekStart: Number(e.target.value)})}
                         />
                         <span className="text-gray-400">-</span>
                         <input 
                            type="number" min="1" max="30"
                            className="w-16 border p-1 rounded text-center outline-none"
                            value={courseForm.weekEnd}
                            onChange={e => setCourseForm({...courseForm, weekEnd: Number(e.target.value)})}
                         />
                      </div>

                      <div className="space-y-2">
                         {courseForm.schedule.map((slot, idx) => (
                             <div key={idx} className="flex gap-2">
                                <select 
                                  className="flex-1 border p-1.5 rounded text-sm outline-none"
                                  value={slot.day}
                                  onChange={e => {
                                      const newSched = [...courseForm.schedule];
                                      newSched[idx].day = Number(e.target.value);
                                      setCourseForm({...courseForm, schedule: newSched});
                                  }}
                                >
                                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
                                        <option key={d} value={i+1}>{d}</option>
                                    ))}
                                </select>
                                <select
                                  className="flex-1 border p-1.5 rounded text-sm outline-none"
                                  value={slot.periods}
                                  onChange={e => {
                                      const newSched = [...courseForm.schedule];
                                      newSched[idx].periods = e.target.value;
                                      setCourseForm({...courseForm, schedule: newSched});
                                  }}
                                >
                                    {Utils.COMMON_PERIODS.map(p => (
                                        <option key={p.label} value={`${p.start}-${p.end}`}>{p.label}</option>
                                    ))}
                                </select>
                                <button 
                                  type="button"
                                  onClick={() => {
                                     const newSched = courseForm.schedule.filter((_, i) => i !== idx);
                                     setCourseForm({...courseForm, schedule: newSched});
                                  }}
                                  className="text-red-400 hover:text-red-600 px-1"
                                >
                                   <Trash2 size={16}/>
                                </button>
                             </div>
                         ))}
                         <button 
                           type="button"
                           onClick={() => setCourseForm({
                               ...courseForm, 
                               schedule: [...courseForm.schedule, { day: 1, periods: '3-4' }]
                           })}
                           className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                         >
                            <Plus size={12}/> Add Another Time Slot
                         </button>
                      </div>
                   </div>

                   <button type="submit" className="w-full py-2.5 text-sm bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow-md">
                       Generate & Add Course
                   </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
