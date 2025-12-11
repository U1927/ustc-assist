
import React, { useState, useEffect } from 'react';
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
  const [isValidatingTicket, setIsValidatingTicket] = useState(false);

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

  // 1. Initialization & CAS Ticket Validation
  useEffect(() => {
    const init = async () => {
      // A. Check for CAS Ticket
      const params = new URLSearchParams(window.location.search);
      const ticket = params.get('ticket');
      
      if (ticket) {
        await validateCasTicket(ticket);
        return; // validated or failed, state updated inside
      }

      // B. Load Local Session
      const savedUser = Storage.getUserSession();
      if (savedUser && savedUser.isLoggedIn) {
        setUser(savedUser);
        loadCloudData(savedUser.studentId);
      }
    };
    init();
  }, []);

  const validateCasTicket = async (ticket: string) => {
    setIsValidatingTicket(true);
    try {
      // Service must match the one sent to login (current page origin + path)
      const service = window.location.origin + window.location.pathname;
      const res = await fetch(`/api/cas?ticket=${ticket}&service=${encodeURIComponent(service)}`);
      const data = await res.json();
      
      if (data.success && data.studentId) {
         // Login Success
         const semesterStart = Utils.getSemesterDefaultStartDate();
         const newUser: UserProfile = {
           studentId: data.studentId,
           name: `Student ${data.studentId}`,
           isLoggedIn: true,
           settings: {
             earlyEightReminder: true,
             reminderMinutesBefore: 15,
             semester: {
                name: 'Current Semester',
                startDate: semesterStart,
                totalWeeks: 18
             }
           }
         };
         
         setUser(newUser);
         Storage.saveUserSession(newUser);
         loadCloudData(newUser.studentId);

         // Clean URL
         window.history.replaceState({}, document.title, window.location.pathname);
      } else {
         alert(`Login Failed: ${data.error}`);
         // Redirect to remove bad ticket? Or just stay
         window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e: any) {
      alert(`Validation Network Error: ${e.message}`);
    } finally {
      setIsValidatingTicket(false);
    }
  };

  const loadCloudData = async (studentId: string) => {
    setSyncStatus('syncing');
    console.log(`[App] Loading cloud data for ${studentId}...`);
    const data = await Storage.fetchUserData(studentId);
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
  };

  // 2. Auto-Save Logic
  useEffect(() => {
    if (!user || !isDataLoaded) return;

    const timeoutId = setTimeout(async () => {
      setSyncStatus('syncing');
      const result = await Storage.saveUserData(user.studentId, events, todos);
      
      if (result.success) {
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } else {
        setSyncStatus('error');
      }
    }, 500);

    setConflicts(Utils.getConflicts(events));
    return () => clearTimeout(timeoutId);
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
    loadCloudData(loggedInUser.studentId);
  };

  const handleLogout = () => {
    setUser(null);
    Storage.clearSession();
    setIsDataLoaded(false);
    setEvents([]);
    // Remove ticket params just in case
    window.history.replaceState({}, document.title, window.location.pathname);
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
       if (!confirm("Conflict detected! Add anyway?")) return;
    }

    setEvents(prev => [...prev, item]);
    setShowAddModal(false);
    setNewEvent({ type: 'activity', startTime: '', endTime: '' });
  };

  const handleAddCourseSeries = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.settings.semester) {
      alert("Please configure semester start date in settings first!");
      return;
    }
    if (!courseForm.title) {
       alert("Course title is required");
       return;
    }

    const { weekStart, weekEnd, schedule, title, location, textbook } = courseForm;
    const { startDate } = user.settings.semester;
    const newItems: ScheduleItem[] = [];

    for (let w = weekStart; w <= weekEnd; w++) {
      schedule.forEach(slot => {
        const { day, periods } = slot;
        const [startP, endP] = periods.split('-').map(Number);
        
        if (Utils.USTC_TIME_SLOTS[startP] && Utils.USTC_TIME_SLOTS[endP]) {
          const startTimeStr = Utils.USTC_TIME_SLOTS[startP].start;
          const endTimeStr = Utils.USTC_TIME_SLOTS[endP].end;
          
          const startDt = Utils.calculateClassDate(startDate, w, day, startTimeStr);
          const endDt = Utils.calculateClassDate(startDate, w, day, endTimeStr);

          newItems.push({
            id: crypto.randomUUID(),
            title: title,
            location: location || 'Classroom',
            type: 'course',
            startTime: format(startDt, "yyyy-MM-dd'T'HH:mm:ss"),
            endTime: format(endDt, "yyyy-MM-dd'T'HH:mm:ss"),
            textbook: textbook,
            description: `Week ${w} Course`
          });
        }
      });
    }

    if (newItems.length > 0 && Utils.checkForConflicts(newItems[0], events)) {
      if(!confirm(`Potential conflict detected in Week ${weekStart}. Add ${newItems.length} course sessions anyway?`)) return;
    }

    setEvents(prev => [...prev, ...newItems]);
    setShowAddModal(false);
    alert(`Added ${newItems.length} class sessions to the calendar.`);
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('Delete this event?')) {
      setEvents(events.filter(e => e.id !== id));
      setSelectedEvent(null);
    }
  };

  const handleGeneratePlan = async () => {
    setIsLoadingAI(true);
    const topics = todos.filter(t => !t.isCompleted).map(t => t.content).join(", ") || "General Revision";
    const newPlan = await generateStudyPlan(events, topics);
    if (newPlan.length > 0) {
       setEvents(prev => [...prev, ...newPlan]);
    } else {
       alert("AI Plan generation failed. Check API Key.");
    }
    setIsLoadingAI(false);
  };

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

  const navigateDate = (direction: 'prev' | 'next') => {
     if (viewMode === ViewMode.WEEK) {
       setCurrentDate(d => direction === 'prev' ? addWeeks(d, -1) : addWeeks(d, 1));
     } else {
       setCurrentDate(d => direction === 'prev' ? addMonths(d, -1) : addMonths(d, 1));
     }
  };

  const renderSyncStatus = () => {
    switch(syncStatus) {
      case 'syncing': return <span className="flex items-center gap-1 text-blue-600 text-xs"><Loader2 className="animate-spin" size={12}/> Syncing...</span>;
      case 'saved': return <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><CheckCircle size={12}/> Saved</span>;
      case 'error': return <span className="flex items-center gap-1 text-red-600 text-xs font-bold"><WifiOff size={12}/> Sync Error</span>;
      default: return <span className="flex items-center gap-1 text-gray-400 text-xs"><Cloud size={12}/> Cloud Ready</span>;
    }
  };

  if (isValidatingTicket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
         <Loader2 className="animate-spin text-blue-600" size={48} />
         <div className="text-gray-600 font-medium">Validating Identity...</div>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-slate-800">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-blue-900 tracking-tight flex items-center gap-2">
              <span className="bg-blue-900 text-white p-1 rounded text-xs">USTC</span> Assistant
            </h1>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button onClick={() => setViewMode(ViewMode.WEEK)} className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewMode === ViewMode.WEEK ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>Week</button>
              <button onClick={() => setViewMode(ViewMode.MONTH)} className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewMode === ViewMode.MONTH ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>Month</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigateDate('prev')} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={20} /></button>
              <span className="text-sm font-semibold w-32 text-center">{viewMode === ViewMode.WEEK ? `Week of ${format(currentDate, 'MMM d')}` : format(currentDate, 'MMMM yyyy')}</span>
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
             <div className="flex items-center gap-2 text-sm text-gray-600">
               <span className="font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{user.studentId}</span>
               <span className="font-medium">{user.name}</span>
             </div>
             <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 shadow-sm transition"><Plus size={16} /> New</button>
             <button onClick={() => setShowSettingsModal(true)} className="text-gray-400 hover:text-blue-600 p-1"><Settings size={20} /></button>
             <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 p-1"><LogOut size={20} /></button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden p-4 flex flex-col">
          <div className="flex-1 overflow-hidden">
             <CalendarView 
               mode={viewMode} 
               currentDate={currentDate} 
               events={events} 
               todos={todos}
               onDeleteEvent={handleDeleteEvent} 
               onSelectEvent={setSelectedEvent}
             />
          </div>
          <div className="h-6 mt-1 flex items-center justify-end px-2 bg-gray-50 border-t border-gray-200 rounded-b-lg">
             {renderSyncStatus()}
          </div>
        </main>
      </div>

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

      {/* EVENT DETAIL MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-xl shadow-2xl w-[400px] max-w-full animate-in zoom-in-95 duration-200 overflow-hidden">
             <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-start">
                <div>
                   <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{selectedEvent.type}</span>
                   <h2 className="text-xl font-bold text-gray-900 mt-1">{selectedEvent.title}</h2>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
             </div>
             
             <div className="p-6 space-y-4">
               <div className="flex items-center gap-3 text-gray-700">
                  <Clock className="text-gray-400" size={18} />
                  <div>
                    <div className="text-sm font-semibold">{format(new Date(selectedEvent.startTime), 'EEEE, MMMM d')}</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(selectedEvent.startTime), 'HH:mm')} - {format(new Date(selectedEvent.endTime), 'HH:mm')}
                    </div>
                  </div>
               </div>
               
               <div className="flex items-center gap-3 text-gray-700">
                  <MapPin className="text-gray-400" size={18} />
                  <div className="text-sm font-medium">{selectedEvent.location}</div>
               </div>

               {selectedEvent.textbook && (
                 <div className="flex items-center gap-3 text-gray-700">
                    <BookOpen className="text-gray-400" size={18} />
                    <div className="text-sm">{selectedEvent.textbook}</div>
                 </div>
               )}

               {selectedEvent.description && (
                 <div className="flex items-start gap-3 text-gray-700 pt-2 border-t">
                    <AlignLeft className="text-gray-400 mt-1" size={18} />
                    <div className="text-sm text-gray-600 leading-relaxed">{selectedEvent.description}</div>
                 </div>
               )}
             </div>

             <div className="bg-gray-50 px-6 py-3 border-t flex justify-between items-center">
                <button 
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                  className="text-red-600 text-sm font-medium hover:underline flex items-center gap-1"
                >
                  <Trash2 size={14} /> Delete Event
                </button>
                <button onClick={() => setSelectedEvent(null)} className="bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded text-sm hover:bg-gray-100">
                  Close
                </button>
             </div>
           </div>
        </div>
      )}

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[450px] max-w-full m-4 animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex border-b border-gray-200">
              <button 
                onClick={() => setAddMode('single')} 
                className={`flex-1 py-3 text-sm font-bold ${addMode === 'single' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-500'}`}
              >
                One-time Event
              </button>
              <button 
                onClick={() => setAddMode('course')} 
                className={`flex-1 py-3 text-sm font-bold ${addMode === 'course' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-500'}`}
              >
                Add Course (Term)
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {addMode === 'single' ? (
                <form onSubmit={handleAddSingleEvent} className="space-y-3">
                  <input className="w-full border p-2 rounded text-sm" placeholder="Title" required value={newEvent.title || ''} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                  <select className="w-full border p-2 rounded text-sm" value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}>
                    <option value="activity">Activity</option>
                    <option value="exam">Exam</option>
                    <option value="study">Study</option>
                    <option value="course">Makeup Class</option>
                  </select>
                  <input className="w-full border p-2 rounded text-sm" placeholder="Location" value={newEvent.location || ''} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Start</label>
                      <input type="datetime-local" required className="w-full border p-2 rounded text-xs" value={newEvent.startTime} onChange={e => setNewEvent({...newEvent, startTime: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">End</label>
                      <input type="datetime-local" required className="w-full border p-2 rounded text-xs" value={newEvent.endTime} onChange={e => setNewEvent({...newEvent, endTime: e.target.value})} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-2 border-t">
                     <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded">Cancel</button>
                     <button type="submit" className="flex-1 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Add Event</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAddCourseSeries} className="space-y-4">
                  <div>
                    <input className="w-full border p-2 rounded text-sm font-medium" placeholder="Course Name (e.g. Math Analysis)" required value={courseForm.title} onChange={e => setCourseForm({...courseForm, title: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     <input className="w-full border p-2 rounded text-sm" placeholder="Location (e.g. 3A201)" value={courseForm.location} onChange={e => setCourseForm({...courseForm, location: e.target.value})} />
                     <input className="w-full border p-2 rounded text-sm" placeholder="Textbook" value={courseForm.textbook} onChange={e => setCourseForm({...courseForm, textbook: e.target.value})} />
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                     <label className="text-xs font-bold text-blue-700 mb-2 block">Teaching Weeks (Semester: {user?.settings.semester?.name || 'Default'})</label>
                     <div className="flex items-center gap-2">
                       <span className="text-sm">Week</span>
                       <input type="number" min={1} max={20} className="w-14 text-center border p-1 rounded text-sm" value={courseForm.weekStart} onChange={e => setCourseForm({...courseForm, weekStart: Number(e.target.value)})} />
                       <span className="text-sm">to</span>
                       <input type="number" min={1} max={20} className="w-14 text-center border p-1 rounded text-sm" value={courseForm.weekEnd} onChange={e => setCourseForm({...courseForm, weekEnd: Number(e.target.value)})} />
                     </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-xs font-bold text-gray-600 uppercase">Class Sessions</label>
                       <button 
                         type="button" 
                         onClick={() => setCourseForm({...courseForm, schedule: [...courseForm.schedule, { day: 1, periods: '3-4' }]})}
                         className="text-xs bg-gray-100 px-2 py-1 rounded text-blue-600 hover:bg-blue-50 font-medium"
                       >
                         + Add Slot
                       </button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                       {courseForm.schedule.map((slot, idx) => (
                         <div key={idx} className="flex items-center gap-2">
                           <select 
                             className="flex-1 border p-1.5 rounded text-sm"
                             value={slot.day}
                             onChange={e => {
                               const newSchedule = [...courseForm.schedule];
                               newSchedule[idx].day = Number(e.target.value);
                               setCourseForm({...courseForm, schedule: newSchedule});
                             }}
                           >
                             <option value={1}>Monday</option>
                             <option value={2}>Tuesday</option>
                             <option value={3}>Wednesday</option>
                             <option value={4}>Thursday</option>
                             <option value={5}>Friday</option>
                             <option value={6}>Saturday</option>
                             <option value={7}>Sunday</option>
                           </select>
                           <select 
                              className="w-24 border p-1.5 rounded text-sm"
                              value={slot.periods}
                              onChange={e => {
                                 const newSchedule = [...courseForm.schedule];
                                 newSchedule[idx].periods = e.target.value;
                                 setCourseForm({...courseForm, schedule: newSchedule});
                              }}
                           >
                             {Utils.COMMON_PERIODS.map(p => (
                               <option key={p.label} value={`${p.start}-${p.end}`}>{p.label}</option>
                             ))}
                           </select>
                           {courseForm.schedule.length > 1 && (
                             <button type="button" onClick={() => setCourseForm({...courseForm, schedule: courseForm.schedule.filter((_, i) => i !== idx)})} className="text-gray-400 hover:text-red-500">
                               <Trash2 size={16} />
                             </button>
                           )}
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                     <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded">Cancel</button>
                     <button type="submit" className="flex-1 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Add Course Series</button>
                  </div>
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
