
import React, { useState } from 'react';
import { validateStudentId } from '../services/utils';
import { UserProfile } from '../types';
import { BookOpen, User, ArrowRight } from 'lucide-react';
import * as Utils from '../services/utils';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStudentId(studentId)) {
      setError('Invalid ID format. Ex: PB20000001 or SA23...');
      return;
    }

    // Local "Login" - Create Session
    const userProfile: UserProfile = {
        studentId: studentId.toUpperCase(),
        name: name || `Student ${studentId.toUpperCase()}`,
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
    };
    
    onLogin(userProfile);
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center relative" 
         style={{ backgroundImage: 'url("https://www.ustc.edu.cn/images/2022/10/24/20221024103608670.jpg")' }}>
      
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm"></div>

      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-[400px] z-10 relative border-t-4 border-blue-600 animate-in fade-in zoom-in duration-300">
        
        <div className="flex flex-col items-center mb-8">
           <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg ring-4 ring-blue-100">
              <BookOpen className="text-white w-8 h-8" />
           </div>
           <h1 className="text-2xl font-bold text-gray-800">Learning Assistant</h1>
           <p className="text-sm text-gray-500 mt-1">Offline Mode</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">Student ID</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => { setStudentId(e.target.value); setError(''); }}
              placeholder="e.g., PB20000001"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">Display Name (Optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
            />
          </div>

          {error && (
            <div className="text-red-600 text-xs bg-red-50 p-3 rounded-lg border border-red-200 flex items-center gap-2">
               <User size={14} /> {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow-lg transform active:scale-[0.98] transition duration-150 flex items-center justify-center gap-2"
          >
            Start Assistant <ArrowRight size={16}/>
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400">
             Serverless Edition. Data is stored locally in your browser.
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

