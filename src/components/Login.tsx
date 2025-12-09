import React, { useState } from 'react';
import { validateStudentId } from '../services/utils';
import { UserProfile } from '../types';
import * as Storage from '../services/storageService';
import { BookOpen, ShieldCheck, ExternalLink, Loader2, Lock } from 'lucide-react';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!validateStudentId(studentId)) {
      setError('Invalid ID format. Ex: PB20000001');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatusMsg('Verifying credentials...');

    try {
      const result = await Storage.authenticateUser(studentId.toUpperCase(), password);

      if (result.success) {
        setStatusMsg(result.isNewUser ? 'Account created! Logging in...' : 'Login successful...');
        
        // Small delay for UX
        setTimeout(() => {
          onLogin({
            studentId: studentId.toUpperCase(),
            name: `Student ${studentId}`, 
            isLoggedIn: true,
            settings: {
              earlyEightReminder: true,
              reminderMinutesBefore: 15
            }
          });
        }, 800);
      } else {
        setError(result.error || "Authentication failed");
        setIsLoading(false);
        setStatusMsg('');
      }
    } catch (err) {
      setError("An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center relative" 
         style={{ backgroundImage: 'url("https://www.ustc.edu.cn/images/2022/10/24/20221024103608670.jpg")' }}>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm"></div>

      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-[400px] z-10 relative border-t-4 border-blue-600">
        
        <div className="flex flex-col items-center mb-6">
           <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-2 shadow-lg">
              <BookOpen className="text-white w-6 h-6" />
           </div>
           <h1 className="text-xl font-bold text-gray-800">Unified Identity Authentication</h1>
           <p className="text-xs text-gray-500 mt-1">First-time login will automatically register</p>
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
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set or Enter Password"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm pr-10"
              />
              <Lock className="absolute right-3 top-2.5 text-gray-400" size={14} />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-xs bg-red-50 p-2 rounded border border-red-200 flex items-center gap-1">
              <ShieldCheck size={12} /> {error}
            </div>
          )}
          
          {statusMsg && !error && (
             <div className="text-blue-600 text-xs bg-blue-50 p-2 rounded border border-blue-200 text-center animate-pulse">
               {statusMsg}
             </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded shadow-lg transform active:scale-95 transition duration-150 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18}/> : 'Login / Register'}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <div className="text-[10px] text-center text-gray-400 mt-2">
            Secure Cloud Sync Enabled via Supabase
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 text-white/50 text-xs">
        © University of Science and Technology of China Learning Assistant
      </div>
    </div>
  );
};

export default Login;
