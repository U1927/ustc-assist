
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
import { Plus, ChevronLeft, ChevronRight, LogOut, Loader2, Clock, MapPin, AlignLeft, Trash2, X, AlertTriangle } from 'lucide-react';
import { addWeeks, addMonths, format, parseISO } from 'date-fns';

type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<ScheduleItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.WEEK);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [selectedEvents, setSelectedEvents] = useState<ScheduleItem[] | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  useEffect(() => {
    const savedUser = Storage.getUserSession();
    if (savedUser && savedUser.isLoggedIn) {
      setUser(savedUser);
      loadData(savedUser.studentId);
    }
  }, []);

  const loadData = async (studentId: string) => {
    const localEvents = Storage.getSchedule();
    const localTodos = Storage.getTodos();
    setEvents(localEvents);
    setTodos(localTodos);
    setIsDataLoaded(true);

    setSyncStatus('syncing');
    try {
      const cloudData = await Storage.fetchUserData(studentId);
      if (cloudData) {
        if (cloudData.schedule?.length > 0) setEvents(cloudData.schedule);
        if (cloudData.todos?.length > 0) setTodos(cloudData.todos);
      }
      setSyncStatus('idle');
    } catch (e) {
      setSyncStatus('error');
    }
  };

  useEffect(() => {
    if (!user || !isDataLoaded) return;
    Storage.saveSchedule(events);
    Storage.saveTodos(todos);
    Storage.saveUserSession(user);

    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      const res = await Storage.saveUserData(user.studentId, events, todos);
      setSyncStatus(res.success ? 'saved' : 'error');
      if (res.success) setTimeout(() => setSyncStatus('idle'), 2000);
    }, 2000);

    return () => clearTimeout(timer);
  }, [events, todos, user, isDataLoaded]);

  const handleLogout = () => {
    setUser(null);
    Storage.clearSession();
    window.location.reload();
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (selectedEvents) {
      const remaining = selectedEvents.filter(e => e.id !== id);
      setSelectedEvents(remaining.length > 0 ? remaining : null);
    }
  };

  const handleUpdateSettings = (s: AppSettings) => {
    if (!user) return;
    const u = {...user, settings: s};
    setUser(u);
    Storage.saveUserSession(u);
  };

  const handleToggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
  };

  const handleDeleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const handleAddTodo = (c: string, d?: string, p?: Priority) => {
    setTodos(prev => [...prev, { 
      id: crypto.randomUUID(), 
      content: c, 
      deadline: d, 
      isCompleted: false, 
      isExpired: false, 
      tags: [], 
      priority: p || 'medium' 
    }]);
  };

  const handleGeneratePlan = async () => {
    setIsLoadingAI(true);
    const plan = await generateStudyPlan(events, "中科大课程复习");
    if (plan.length > 0) setEvents(prev => [...prev, ...plan]);
    setIsLoadingAI(false);
  };

  if (!user) return <Login onLogin={(u) => { setUser(u); loadData(u.studentId); }} />;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <aside className="w-16 bg-[#00418b] flex flex-col items-center py-6 gap-8 shadow-xl z-30">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-[#00418b] text-xs">USTC</div>
        <nav className="flex flex-col gap-6 text-white/40 flex-1">
          <button onClick={() => setViewMode(ViewMode.WEEK)} className={`p-2 rounded-xl transition ${viewMode === ViewMode.WEEK ? 'bg-white/20 text-white shadow-inner' : 'hover:text-white'}`}><Clock size={24}/></button>
          <button onClick={() => setShowSettingsModal(true)} className="p-2 hover:text-white transition"><AlignLeft size={24}/></button>
        </nav>
        <button onClick={handleLogout} className="p-2 text-white/20 hover:text-red-400 transition-colors"><LogOut size={24}/></button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-black text-[#00418b]">中科大学习助手</h2>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setViewMode(ViewMode.WEEK)} className={`px-4 py-1.5 text-xs font-black rounded-lg transition ${viewMode === ViewMode.WEEK ? 'bg-white shadow text-[#00418b]' : 'text-slate-500'}`}>周视图</button>
              <button onClick={() => setViewMode(ViewMode.MONTH)} className={`px-4 py-1.5 text-xs font-black rounded-lg transition ${viewMode === ViewMode.MONTH ? 'bg-white shadow text-[#00418b]' : 'text-slate-500'}`}>月视图</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentDate(d => viewMode === ViewMode.WEEK ? addWeeks(d, -1) : addMonths(d, -1))} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={18}/></button>
              <span className="text-xs font-black min-w-[120px] text-center">{format(currentDate, 'yyyy年 MM月')}</span>
              <button onClick={() => setCurrentDate(d => viewMode === ViewMode.WEEK ? addWeeks(d, 1) : addMonths(d, 1))} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight size={18}/></button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-black px-2 py-1 bg-slate-50 rounded-full border border-slate-100">
               {syncStatus === 'syncing' && <Loader2 size={12} className="animate-spin text-[#00418b]"/>}
               <span className="text-slate-500 uppercase tracking-tighter">{syncStatus === 'idle' ? '云端已同步' : '同步中'}</span>
            </div>
            <button onClick={() => setShowImportModal(true)} className="bg-[#00418b] text-white px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all">
              <Plus size={16}/> 导入课表
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-hidden">
          <CalendarView 
            mode={viewMode}
            currentDate={currentDate}
            events={events}
            todos={todos}
            onDeleteEvent={handleDeleteEvent}
            onSelectEvents={setSelectedEvents}
          />
        </main>
      </div>

      <Sidebar 
        todos={todos}
        events={events}
        onAddTodo={handleAddTodo}
        onToggleTodo={handleToggleTodo}
        onDeleteTodo={handleDeleteTodo}
        onGeneratePlan={handleGeneratePlan}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenImport={() => setShowImportModal(true)}
        conflicts={Utils.getConflicts(events)}
        isLoadingAI={isLoadingAI}
      />

      {/* 日程详情与冲突展示 */}
      {selectedEvents && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center backdrop-blur-sm p-4" onClick={() => setSelectedEvents(null)}>
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
              <div className="bg-slate-50 px-6 py-5 border-b border-slate-200 flex justify-between items-center">
                 <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    {selectedEvents.length > 1 ? <><AlertTriangle size={20} className="text-amber-500"/> 发现日程冲突</> : "日程详情"}
                 </h3>
                 <button onClick={() => setSelectedEvents(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6 custom-scrollbar">
                 {selectedEvents.map((event, idx) => (
                    <div key={event.id} className={`${idx !== 0 ? 'pt-6 border-t border-slate-100' : ''} group relative`}>
                       <div className="flex justify-between items-start mb-2">
                          <h4 className="text-md font-black text-[#00418b] leading-tight pr-8">{event.title}</h4>
                          <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase ${event.category === 'first' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                             {event.category === 'first' ? '第一课堂' : '第二课堂'}
                          </span>
                       </div>
                       <div className="space-y-2 text-sm text-slate-500 font-medium">
                          <div className="flex items-center gap-2"><Clock size={16} className="text-slate-300"/><span>{format(parseISO(event.startTime), 'HH:mm')} - {format(parseISO(event.endTime), 'HH:mm')}</span></div>
                          <div className="flex items-center gap-2"><MapPin size={16} className="text-red-300"/><span>{event.location}</span></div>
                          {event.description && <div className="text-[11px] bg-slate-50 p-2 rounded-lg italic border border-slate-100 text-slate-400">{event.description}</div>}
                       </div>
                       <div className="mt-3 flex justify-end">
                          <button onClick={() => handleDeleteEvent(event.id)} className="text-red-500 text-[10px] font-black flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"><Trash2 size={12}/> 移除日程</button>
                       </div>
                    </div>
                 ))}
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                 <button onClick={() => setSelectedEvents(null)} className="px-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-100 transition shadow-sm">确定</button>
              </div>
           </div>
        </div>
      )}

      <SettingsDialog 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
        settings={user.settings} 
        onSave={handleUpdateSettings} 
        onForceSync={() => Storage.saveUserData(user.studentId, events, todos)}
        onChangePassword={(o, n) => Storage.changePassword(user.studentId, o, n)}
      />

      <ImportDialog 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
        onImport={(data) => { 
          const parsed = UstcParser.parseJwJson(data, user.settings.semester.startDate); 
          setEvents(prev => [...prev, ...parsed]); 
        }} 
      />
    </div>
  );
};

export default App;
