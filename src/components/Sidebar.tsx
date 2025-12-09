import React, { useState, useRef } from 'react';
import { TodoItem } from '../types';
import { Plus, Trash2, Check, AlertTriangle, Sparkles, Settings, Upload } from 'lucide-react';
import { format, isPast } from 'date-fns';

interface SidebarProps {
  todos: TodoItem[];
  onAddTodo: (content: string, deadline?: string) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onGeneratePlan: () => void;
  onOpenSettings: () => void;
  onImportScheduleFile: (file: File) => void;
  conflicts: string[];
  isLoadingAI: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  todos, 
  onAddTodo, 
  onToggleTodo, 
  onDeleteTodo, 
  onGeneratePlan,
  onOpenSettings,
  onImportScheduleFile,
  conflicts,
  isLoadingAI
}) => {
  const [newTodo, setNewTodo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'tools'>('todos');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodo.trim()) {
      onAddTodo(newTodo, deadline || undefined);
      setNewTodo('');
      setDeadline('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportScheduleFile(e.target.files[0]);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('todos')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'todos' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          To-Do List
        </button>
        <button 
          onClick={() => setActiveTab('tools')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'tools' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Assistant
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'todos' ? (
          <>
            <form onSubmit={handleAdd} className="mb-4">
               <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="Add a task..."
                className="w-full text-sm p-2 border border-gray-300 rounded mb-2 focus:border-blue-500 outline-none"
              />
              <div className="flex gap-2">
                <input 
                  type="datetime-local" 
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
                <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
                  <Plus size={16} />
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {todos.map(todo => {
                const expired = todo.deadline && isPast(new Date(todo.deadline)) && !todo.isCompleted;
                return (
                  <div key={todo.id} className={`p-3 rounded-lg border ${expired ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} flex items-start gap-2`}>
                    <button 
                      onClick={() => onToggleTodo(todo.id)}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${todo.isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-400 bg-white'}`}
                    >
                      {todo.isCompleted && <Check size={10} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm break-words ${todo.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {todo.content}
                      </p>
                      {todo.deadline && (
                        <p className={`text-xs mt-1 ${expired ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                           {expired ? 'Expired' : 'Due'}: {format(new Date(todo.deadline), 'MM/dd HH:mm')}
                        </p>
                      )}
                    </div>
                    <button onClick={() => onDeleteTodo(todo.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              {todos.length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-10">No tasks yet.</div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {conflicts.length > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                 <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
                   <AlertTriangle size={16} /> Conflicts Detected
                 </div>
                 <ul className="list-disc list-inside text-xs text-red-600 space-y-1">
                   {conflicts.map((c, i) => <li key={i}>{c}</li>)}
                 </ul>
              </div>
            ) : (
              <div className="text-sm text-green-600 flex items-center gap-2 bg-green-50 p-2 rounded border border-green-100">
                <Check size={16} /> No schedule conflicts
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Schedule Actions</h3>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*,application/pdf"
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingAI}
                className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 py-2 px-3 rounded text-sm transition"
              >
                {isLoadingAI ? <span className="animate-pulse">Processing...</span> : (
                  <>
                   <Upload size={16} /> Import from Image/PDF
                  </>
                )}
              </button>
              <p className="text-[10px] text-gray-400 mt-1">
                Upload a screenshot or PDF of your USTC schedule. AI will parse it.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Smart Assistant</h3>
              <button 
                onClick={onGeneratePlan}
                disabled={isLoadingAI}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 py-2 px-3 rounded text-sm transition shadow-sm"
              >
                {isLoadingAI ? <span className="animate-pulse">Thinking...</span> : (
                  <>
                   <Sparkles size={16} /> Generate Study Plan
                  </>
                )}
              </button>
            </div>

             <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">System</h3>
              <button 
                onClick={onOpenSettings}
                className="w-full flex items-center justify-center gap-2 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 py-2 px-3 rounded text-sm transition"
              >
                <Settings size={16} /> Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
