import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import CalendarView from './components/CalendarView';
import Sidebar from './components/Sidebar';
import SettingsDialog from './components/SettingsDialog';
import { ScheduleItem, TodoItem, UserProfile, ViewMode, AppSettings } from './types';
import * as Storage from './services/storageService';
import * as Utils from './services/utils';
import { generateStudyPlan } from './services/aiService';
import { Plus, ChevronLeft, ChevronRight, LogOut, Loader2, Settings, Cloud, CheckCircle, AlertCircle } from 'lucide-react';
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
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Status Bar State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  
  // Track if data is initialized to prevent overwriting cloud data with empty local state
  const isDataLoaded = useRef(false);

  const [newEvent, setNewEvent] = useState<Partial<ScheduleItem>>({ type: 'course', startTime: '', endTime: '' });

  // 1. Initialize User Session
  useEffect(() => {
    const savedUser = Storage.getUserSession();
    if (savedUser && savedUser.isLoggedIn) {
      setUser(savedUser);
      loadCloudData(savedUser.studentId);
    }
    
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  // 2. Load Cloud Data Helper
  const loadCloudData = async (studentId: string) => {
    setIsLoadingData(true);
    setSyncStatus('syncing');
    console.log("[App] Loading cloud data for:", studentId);
    
    const cloudData = await Storage.fetchUserData(studentId);
    
    if (cloudData) {
      setEvents(cloudData.schedule);
      setTodos(cloudData.todos);
      isDataLoaded.current = true;
      setSyncStatus('idle');
      console.log("[App] Cloud data loaded successfully.");
    } else {
      // If fetch fails (network) or returns null, we mark loaded as true but empty 
      // to allow user to start fresh. 
      // Ideally we would differentiate between "New User" (empty) and "Network Error".
      // For now, we assume if it fails, we let the user work locally and retry save later.
      isDataLoaded.current = true; 
      setSyncStatus('error');
      console.warn("[App] Cloud load failed or empty. Starting with empty state.");
    }
    setIsLoadingData(false);
  };

  // 3. Auto-Save to Cloud on Changes
  useEffect(() => {
    if (!user || !isDataLoaded.current) return;

    const saveData = async () => {
      setSyncStatus('syncing');
      const success = await Storage.saveUserData(user.studentId, events, todos);
      
      if (success) {
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } else {
        setSyncStatus('error');
      }
    };

    // Trigger save immediately on change
    saveData();
    
    // Check Conflicts locally
    const conflictList = Utils.getConflicts(events);
    setConflicts(conflictList);

  }, [events, todos, user]);

  // 4. Save User Session Changes locally (just login state)
  useEffect(() => {
    if (user) Storage.saveUserSession(user);
  }, [user]);

  // 5. Reminders & Expiration Logic
  useEffect(() => {
    const interval = setInterval(() => {
      if (!user) return;
      const now = new Date();

      // Reminders
      events.forEach(event => {
        const start = new Date(event.startTime);
        const diffMinutes = differenceInMinutes(start, now);
        
        if (diffMinutes === user.settings.reminderMinutesBefore) {
          sendNotification(`Upcoming: ${event.title}`, `Starts in ${diffMinutes} minutes at ${event.location}`);
        }

        const isEightAM = start.getHours() === 8 && start.getMinutes() === 0;
        if (user.settings.earlyEightReminder && isEightAM && diffMinutes === 30) {
           sendNotification(`🌅 早八提醒: ${event.title}`, `Get ready! Class starts at 8:00 AM.`);
        }
      });
      
      // Todo Expiration
      let hasUpdates = false;
      const updatedTodos = todos.map(todo => {
        if (!todo.isCompleted && !todo.isExpired && todo.deadline && isPast(new Date(todo.deadline))) {
          hasUpdates = true;
          return { ...todo, isExpired: true };
        }
        return todo;
      });
      
      if (hasUpdates) {
        setTodos(updatedTodos);
      }
    }, 30000); 

    return () => clearInterval(interval);
  }, [events, user, todos]);

  const sendNotification = (title: string, body: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'https://www.ustc.edu.cn/favicon.ico' });
    }
  };

  // Handlers
  const handleLogin = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    loadCloudData(loggedInUser.studentId);
  };

  const handleLogout = () => {
    setUser(null);
    Storage.clearSession();
    isDataLoaded.current = false;
    setEvents([]);
    setTodos([]);
    window.location.reload();
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    if (user) {
      setUser({ ...user, settings: newSettings });
    }
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
       if (!confirm("⚠️ Conflict detected! This overlaps with an existing event. Add anyway?")) return;
    }

    setEvents([...events, item]);
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
       alert("Could not generate a plan. Ensure API Key is set.");
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

  // Render Status Bar Helper
  const renderSyncStatus = () => {
    switch(syncStatus) {
      case 'syncing':
        return <div className="flex items-center gap-1 text-blue-600"><Loader2 className="animate-spin" size={12} /> <span className="text-xs">Syncing...</span></div>;
      case 'saved':
        return <div className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> <span className="text-xs">Cloud Saved</span></div>;
      case 'error':
        return <div className="flex items-center gap-1 text-red-600 font-bold"><AlertCircle size={12} /> <span className="text-xs">Save Failed!</span></div>;
      default: // idle
        return <div className="flex items-center gap-1 text-gray-400"><Cloud size={12} /> <span className="text-xs">Cloud Ready</span></div>;
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-slate-800">
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
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
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-sm text-gray-600">
               <span className="font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{user.studentId}</span>
               <span className="font-medium">{user.name}</span>
             </div>
             <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 shadow-sm transition">
               <Plus size={16} /> New
             </button>
             <button 
               onClick={() => setShowSettingsModal(true)} 
               className="text-gray-400 hover:text-blue-600 transition p-1 rounded-full hover:bg-gray-100"
               title="Preferences"
             >
               <Settings size={20} />
             </button>
             <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition p-1 rounded-full hover:bg-gray-100" title="Logout">
               <LogOut size={20} />
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden p-4 relative flex flex-col">
          {isLoadingData ? (
             <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
                <div className="flex flex-col items-center gap-3">
                   <Loader2 className="animate-spin text-blue-600" size={32} />
                   <p className="text-sm text-gray-500">Syncing with Cloud Database...</p>
                </div>
             </div>
          ) : (
            <div className="flex-1 overflow-hidden">
               <CalendarView 
                 mode={viewMode}
                 currentDate={currentDate}
                 events={events}
                 onDeleteEvent={handleDeleteEvent}
               />
            </div>
          )}
          
          {/* Status Bar */}
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
      />

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 animate-in fade-in zoom-in duration-200">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Add Schedule Item</h2>
            <form onSubmit={handleAddEvent} className="space-y-3">
              <input 
                className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder="Title (e.g. Calculus)" 
                required
                value={newEvent.title || ''}
                onChange={e => setNewEvent({...newEvent, title: e.target.value})}
              />
              <select 
                className="w-full border p-2 rounded text-sm outline-none"
                value={newEvent.type}
                onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}
              >
                <option value="course">First Classroom (Course)</option>
                <option value="activity">Second Classroom (Activity)</option>
                <option value="exam">Exam</option>
                <option value="study">Self Study</option>
              </select>
              <input 
                className="w-full border p-2 rounded text-sm outline-none" 
                placeholder="Location (e.g. 3A201)" 
                value={newEvent.location || ''}
                onChange={e => setNewEvent({...newEvent, location: e.target.value})}
              />
              <input 
                className="w-full border p-2 rounded text-sm outline-none" 
                placeholder="Textbook/Materials" 
                value={newEvent.textbook || ''}
                onChange={e => setNewEvent({...newEvent, textbook: e.target.value})}
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

              <div className="flex gap-2 mt-4 pt-2 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" className="flex-1 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
