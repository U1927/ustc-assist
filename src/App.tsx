import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import CalendarView from './components/CalendarView';
import Sidebar from './components/Sidebar';
import SettingsDialog from './components/SettingsDialog';
import { ScheduleItem, TodoItem, UserProfile, ViewMode, AppSettings } from './types';
import * as Storage from './services/storageService';
import * as Utils from './services/utils';
import { generateStudyPlan } from './services/aiService';
import { Plus, ChevronLeft, ChevronRight, LogOut, Loader2, Settings, Cloud, CheckCircle, WifiOff } from 'lucide-react';
import { addWeeks, addMonths, format, differenceInMinutes, isPast } from 'date-fns';

type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<ScheduleItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.WEEK);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [newEvent, setNewEvent] = useState<Partial<ScheduleItem>>({ type: 'course', startTime: '', endTime: '' });

  // 1. Initialization
  useEffect(() => {
    console.log("App Version: Cloud V3 (Fixed 406)");
    
    const savedUser = Storage.getUserSession();
    if (savedUser && savedUser.isLoggedIn) {
      setUser(savedUser);
      loadCloudData(savedUser.studentId);
    }
  }, []);

  const loadCloudData = async (studentId: string) => {
    setSyncStatus('syncing');
    console.log(`[App] Loading cloud data for ${studentId}...`);
    const data = await Storage.fetchUserData(studentId);
    if (data) {
      console.log(`[App] Data loaded. Events: ${data.schedule.length}, Todos: ${data.todos.length}`);
      setEvents(data.schedule);
      setTodos(data.todos);
      setIsDataLoaded(true); // Enable auto-save
      setSyncStatus('idle');
    } else {
      console.warn("[App] Failed to load data (or network error). Starting with empty state.");
      setIsDataLoaded(true); // Enable saving even if load failed (assuming new user or recovery)
      setSyncStatus('error');
    }
  };

  // 2. Auto-Save Logic
  useEffect(() => {
    if (!user || !isDataLoaded) return;

    // Debounce slightly to avoid rapid saves during typing
    const timeoutId = setTimeout(async () => {
      setSyncStatus('syncing');
      console.log("[App] Auto-save triggered...");
      const result = await Storage.saveUserData(user.studentId, events, todos);
      
      if (result.success) {
        console.log("[App] Save Successful!");
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } else {
        console.error("[App] Save Failed:", result.error);
        setSyncStatus('error');
        // Alert only on serious auth/policy errors to avoid spamming user
        if (result.error?.includes('policy') || result.error?.includes('401')) {
          alert(`Cloud Save Failed: ${result.error}\n\nPlease check database permissions.`);
        }
      }
    }, 500);

    setConflicts(Utils.getConflicts(events));
    return () => clearTimeout(timeoutId);
  }, [events, todos, user, isDataLoaded]);

  // 3. Persist Session Locally
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

  // Handlers
  const handleLogin = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    loadCloudData(loggedInUser.studentId);
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

  const handleAddEvent = (e: React.FormEvent) => {
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
    setNewEvent({ type: 'course', startTime: '', endTime: '' });
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('Delete this event?')) {
      setEvents(events.filter(e => e.id !== id));
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

  const handleAddTodo = (content: string, deadline?: string) => {
    const todo: TodoItem = {
      id: crypto.randomUUID(),
      content,
      deadline,
      isCompleted: false,
      isExpired: false,
      tags: []
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
             <CalendarView mode={viewMode} currentDate={currentDate} events={events} onDeleteEvent={handleDeleteEvent} />
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
        conflicts={conflicts}
        isLoadingAI={isLoadingAI}
      />

      <SettingsDialog 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
        settings={user.settings} 
        onSave={handleUpdateSettings} 
        onForceSync={handleForceSync}
      />

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 animate-in fade-in zoom-in duration-200">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Add Schedule Item</h2>
            <form onSubmit={handleAddEvent} className="space-y-3">
              <input className="w-full border p-2 rounded text-sm" placeholder="Title" required value={newEvent.title || ''} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
              <select className="w-full border p-2 rounded text-sm" value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}>
                <option value="course">Course</option>
                <option value="activity">Activity</option>
                <option value="exam">Exam</option>
                <option value="study">Study</option>
              </select>
              <input className="w-full border p-2 rounded text-sm" placeholder="Location" value={newEvent.location || ''} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
              <input className="w-full border p-2 rounded text-sm" placeholder="Textbook" value={newEvent.textbook || ''} onChange={e => setNewEvent({...newEvent, textbook: e.target.value})} />
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
              <div className="flex gap-2 mt-4"><button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded">Cancel</button><button type="submit" className="flex-1 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Add</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
