
import React, { useState, useEffect } from 'react';
import { validateStudentId } from '../services/utils';
import { UserProfile } from '../types';
import { BookOpen, ShieldCheck, Loader2, LogIn, UserPlus } from 'lucide-react';
import * as Storage from '../services/storageService';
import * as Utils from '../services/utils';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => setError(''), [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStudentId(studentId)) {
      setError('Invalid ID format. Ex: PB20000001');
      return;
    }
    if (password.length < 1) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    const cleanId = studentId.toUpperCase().trim();

    try {
      if (mode === 'login') {
        const res = await Storage.loginUser(cleanId, password);
        if (res.success) {
          onLogin({
            studentId: cleanId,
            name: `Student ${cleanId}`,
            isLoggedIn: true,
            settings: {
              earlyEightReminder: true,
              reminderMinutesBefore: 15,
              semester: {
                 name: 'Current Semester',
                 startDate: Utils.getSemesterDefaultStartDate(),
                 totalWeeks: 18
              }
            }
          });
        } else {
          setError(res.error || "Login failed");
        }
      } else {
        const res = await Storage.registerUser(cleanId, password);
        if (res.success) {
           onLogin({
            studentId: cleanId,
            name: `Student ${cleanId}`,
            isLoggedIn: true,
            settings: {
              earlyEightReminder: true,
              reminderMinutesBefore: 15,
              semester: {
                 name: 'Current Semester',
                 startDate: Utils.getSemesterDefaultStartDate(),
                 totalWeeks: 18
              }
            }
          });
        } else {
          setError(res.error || "Registration failed");
        }
      }
    } catch (err: any) {
      setError(err.message || "System error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center relative" 
         style={{ backgroundImage: 'url("https://www.ustc.edu.cn/images/2022/10/24/20221024103608670.jpg")' }}>
      
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm"></div>

      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-[400px] z-10 relative border-t-4 border-blue-600 animate-in fade-in zoom-in duration-300">
        
        <div className="flex flex-col items-center mb-6">
           <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-2 shadow-lg">
              <BookOpen className="text-white w-6 h-6" />
           </div>
           <h1 className="text-xl font-bold text-gray-800">Learning Assistant</h1>
           <p className="text-xs text-gray-500 mt-1">USTC Student Schedule Manager</p>
        </div>

        <div className="flex border-b border-gray-200 mb-6">
           <button 
             onClick={() => setMode('login')}
             className={`flex-1 pb-2 text-sm font-bold transition ${mode === 'login' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
           >
             Login
           </button>
           <button 
             onClick={() => setMode('register')}
             className={`flex-1 pb-2 text-sm font-bold transition ${mode === 'register' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
           >
             Register
           </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Student ID</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => { setStudentId(e.target.value); setError(''); }}
              placeholder="e.g., PB20000001"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition text-sm disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">App Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Not your CAS password"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition text-sm disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="text-red-500 text-xs bg-red-50 p-3 rounded border border-red-200 flex flex-col gap-1">
              <div className="flex items-center gap-2 font-bold">
                 <ShieldCheck size={14} /> 
                 <span>{error}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded shadow-lg transform active:scale-95 transition duration-150 flex items-center justify-center gap-2"
          >
            {isLoading ? (
                <>
                 <Loader2 size={16} className="animate-spin" /> Processing...
                </>
            ) : (
                <>
                  {mode === 'login' ? <LogIn size={16}/> : <UserPlus size={16}/>}
                  {mode === 'login' ? 'Login' : 'Create Account'}
                </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="text-[10px] text-center text-gray-400 leading-tight">
             This is the local app account. <br/>
             To sync schedule, use the "Import" feature inside the app.
          </p>
        </div>
      </div>
      
      <div className="absolute bottom-4 text-white/50 text-xs">
        © University of Science and Technology of China Learning Assistant
      </div>
    </div>
  );
};

export default Login;

