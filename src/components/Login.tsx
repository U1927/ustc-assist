
import React, { useState } from 'react';
import { validateStudentId } from '../services/utils';
import { UserProfile } from '../types';
import { BookOpen, ShieldCheck, ExternalLink } from 'lucide-react';
import * as Utils from '../services/utils';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Local Validation
    if (!validateStudentId(studentId)) {
      setError('Invalid ID format. Ex: PB20000001');
      return;
    }
    if (password.length < 6) {
      setError('Password is too short');
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulate CAS Authentication Delay
    setTimeout(() => {
      const semesterStart = Utils.getSemesterDefaultStartDate();

      // Mock successful login
      onLogin({
        studentId: studentId.toUpperCase(),
        name: `Student ${studentId}`, 
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
      });
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center relative" 
         style={{ backgroundImage: 'url("https://www.ustc.edu.cn/images/2022/10/24/20221024103608670.jpg")' }}>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm"></div>

      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-[400px] z-10 relative border-t-4 border-blue-600">
        
        {/* Header mimicking USTC Passport */}
        <div className="flex flex-col items-center mb-6">
           <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-2 shadow-lg">
              <BookOpen className="text-white w-6 h-6" />
           </div>
           <h1 className="text-xl font-bold text-gray-800">Unified Identity Authentication</h1>
           <p className="text-xs text-gray-500 mt-1">CAS - Central Authentication Service</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Student ID (学号)</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => {
                setStudentId(e.target.value);
                setError('');
              }}
              placeholder="e.g., PB21000001"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="USTC Password"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
            />
          </div>

          {error && (
            <div className="text-red-500 text-xs bg-red-50 p-2 rounded border border-red-200 flex items-center gap-1">
              <ShieldCheck size={12} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded shadow-lg transform active:scale-95 transition duration-150 flex items-center justify-center gap-2"
          >
            {isLoading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <a 
            href="https://passport.ustc.edu.cn/login" 
            target="_blank" 
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1"
          >
            Go to Official Passport Page <ExternalLink size={10} />
          </a>
          <p className="text-[10px] text-center text-gray-400 mt-2">
            This app simulates the login process. Your password is not sent to any server.
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
