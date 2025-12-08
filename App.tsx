import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import CalendarView from './components/CalendarView';
import Sidebar from './components/Sidebar';
import { ScheduleItem, TodoItem, UserProfile, ViewMode } from './types';
import * as Storage from './services/storageService';
import * as Utils from './services/utils';
import * as Crawler from './services/crawlerService';
import { generateStudyPlan } from './services/aiService';
import { Plus, ChevronLeft, ChevronRight, LogOut, Loader2 } from 'lucide-react';
import { addWeeks, addMonths, format, differenceInMinutes, isPast } from 'date-fns';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<ScheduleItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.WEEK);
  const [showAddModal, setShowAddModal] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Temporary state for the simplistic add modal
  const [newEvent, setNewEvent] = useState<Partial<ScheduleItem>>({ type: 'course', startTime: '', endTime: '' });

  // 1. Initialization
  useEffect(() => {
    const savedUser = Storage.getUser();
    if (savedUser && savedUser.isLoggedIn) {
      setUser(savedUser);
    }
    setEvents(Storage.getSchedule());
    setTodos(Storage.getTodos());

    // Request Notification permission
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  // 2. Persistence & Logic Updates
  useEffect(() => {
    Storage.saveSchedule(events);
    const conflictList = Utils.getConflicts(events);
    setConflicts(conflictList);
  }, [events]);

  useEffect(() => {
    Storage.saveTodos(todos);
  }, [todos]);

  useEffect(() => {
    if (user) Storage.saveUser(user);
  }, [user]);

  // 3. Reminders & Expiration Logic (Runs every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!user) return;
      
      const now = new Date();

      // A. Event Reminders
      events.forEach(event => {
        const start = new Date(event.startTime);
        const diffMinutes = differenceInMinutes(start, now);
        
        // Custom Reminder (e.g., 15 mins before)
        if (diffMinutes === user.settings.reminderMinutesBefore) {
          sendNotification(`Upcoming: ${event.title}`, `Starts in ${diffMinutes} minutes at ${event.location}`);
        }

        // "Early Eight" Reminder (Course at 8:00 AM)
        // Check if it's 8:00 AM
        const isEightAM = start.getHours() === 8 && start.getMinutes() === 0;
        if (user.settings.earlyEightReminder && isEightAM) {
          // Alert the night before at 10:00 PM (assuming this check runs constantly)
          // For demo purposes, we alert 30 mins before if the user is awake
          if (diffMinutes === 30) {
             sendNotification(`🌅 早八提醒: ${event.title}`, `Get ready! Class starts at 8:00 AM.`);
          }
        }
      });
      
      // B. Todo Auto-Expiration
      // Check if any active todo has passed its deadline
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

    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [events, user, todos]);

  const sendNotification = (title: string, body: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'https://www.ustc.edu.cn/favicon.ico' });
    } else {
      console.log("Notification:", title, body);
    }
  };

  // Handlers
  const handleLogin = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    // Auto sync on first login if empty
    if (events.length === 0) {
      handleImportData(loggedInUser.studentId);
    }
  };

  const handleLogout = () => {
    setUser(null);
    Storage.clearData();
    window.location.reload();
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

  const handleImportData = async (studentId?: string) => {
    if (!user && !studentId) return;
    const id = studentId || user!.studentId;
    
    setIsSyncing(true);
    try {
      const fetchedItems = await Crawler.fetchAllData(id);
      
      // Merge unique items based on time and title
      const currentIds = new Set(events.map(e => e.id));
      const newItems = fetchedItems.filter(item => !currentIds.has(item.id));
      
      setEvents(prev => [...prev, ...newItems]);
      
      if (newItems.length > 0) {
        alert(`Successfully synced ${newItems.length} items from JW & Young System.`);
      } else {
        alert("Sync complete. No new items found.");
      }
    } catch (e) {
      alert("Sync failed. Please check network.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGeneratePlan = async () => {
    setIsLoadingAI(true);
    // Example: Find topics from incomplete todos or hardcoded for demo
    const topics = todos.filter(t => !t.isCompleted).map(t => t.content).join(", ") || "General Revision";
    
    const newPlan = await generateStudyPlan(events, topics);
    if (newPlan.length > 0) {
       setEvents(prev => [...prev, ...newPlan]);
    } else {
       alert("Could not generate a plan. Ensure API Key is set or try again.");
    }
    setIsLoadingAI(false);
  };

  // Todo Handlers
  const handleAddTodo = (content: string, deadline?: string) => {
    const todo: TodoItem = {
      id: crypto.randomUUID(),
      content,
      deadline,
      isCompleted: false,
      isExpired: false, // Initial state
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

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-slate-800">
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
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
             <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 shadow-sm transition">
               <Plus size={16} /> New
             </button>
             <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition">
               <LogOut size={20} />
             </button>
          </div>
        </header>

        {/* Calendar Grid */}
        <main className="flex-1 overflow-hidden p-4">
          <CalendarView 
            mode={viewMode}
            currentDate={currentDate}
            events={events}
            onDeleteEvent={handleDeleteEvent}
          />
        </main>
      </div>

      {/* Right Sidebar */}
      <Sidebar 
        todos={todos}
        onAddTodo={handleAddTodo}
        onToggleTodo={handleToggleTodo}
        onDeleteTodo={handleDeleteTodo}
        onImportData={() => handleImportData()}
        onGeneratePlan={handleGeneratePlan}
        conflicts={conflicts}
        isLoadingAI={isLoadingAI}
      />

      {/* Loading Overlay */}
      {isSyncing && (
        <div className="fixed bottom-4 right-80 z-50 bg-blue-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
          <Loader2 className="animate-spin" size={16} /> Syncing from JW & Young...
        </div>
      )}

      {/* Add Modal */}
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