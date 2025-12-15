
import React, { useState } from 'react';
import { validateStudentId } from '../services/utils';
import * as Storage from '../services/storageService';
import { UserProfile } from '../types';
import { BookOpen, ShieldCheck, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import * as Utils from '../services/utils';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'offline'>('connected');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Validation
    if (!validateStudentId(studentId)) {
      setError('Invalid ID format. (e.g., PB20000001)');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (isRegistering && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      if (isRegistering) {
        // --- REGISTER ---
        const res = await Storage.registerUser(studentId.toUpperCase(), password);
        if (res.success) {
          setIsRegistering(false);
          setConfirmPassword('');
          setError('');
          alert('Registration successful! Please login.');
        } else {
          // If DB is missing, we simulate registration success locally
          if (res.error?.includes('Database not connected')) {
              setDbStatus('offline');
              handleLocalLogin(); // Auto login locally
          } else {
              setError(res.error || 'Registration failed');
          }
        }
      } else {
        // --- LOGIN ---
        const res = await Storage.loginUser(studentId.toUpperCase(), password);
        if (res.success && res.user) {
          // Success from DB
          const userProfile: UserProfile = {
            studentId: res.user.student_id,
            name: `Student ${res.user.student_id}`,
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
        } else {
          // Handle Failures
          if (res.error?.includes('Database not connected')) {
             setDbStatus('offline');
             // Fallback to local "mock" login if DB is not configured
             handleLocalLogin();
          } else {
             setError(res.error || 'Login failed');
          }
        }
      }
    } catch (err: any) {
       setError(err.message);
    } finally {
       setIsLoading(false);
    }
  };

  // Fallback for demo/local-only mode
  const handleLocalLogin = () => {
     setTimeout(() => {
        const userProfile: UserProfile = {
            studentId: studentId.toUpperCase(),
            name: `Student ${studentId.toUpperCase()}`,
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
     }, 800);
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center relative" 
         style={{ backgroundImage: 'url("https://www.ustc.edu.cn/images/2022/10/24/20221024103608670.jpg")' }}>
      
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"></div>

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[420px] z-10 relative overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-blue-600 p-6 text-center text-white relative">
           <div className="mx-auto w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-md shadow-inner">
              <BookOpen className="text-white w-8 h-8" />
           </div>
           <h1 className="text-2xl font-bold tracking-tight">USTC Assistant</h1>
           <p className="text-blue-100 text-sm mt-1">
             {isRegistering ? 'Create Student Profile' : 'Student Authentication'}
           </p>
           
           {/* Decorative circles */}
           <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
           <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Student ID */}
            <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Student ID</label>
                <div className="relative">
                    <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={studentId}
                        onChange={(e) => { setStudentId(e.target.value); setError(''); }}
                        placeholder="e.g. PB23000001"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm font-medium text-gray-700 placeholder:text-gray-400"
                    />
                </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Password</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm font-medium"
                    />
                </div>
            </div>

            {/* Confirm Password (Register Only) */}
            {isRegistering && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Confirm Password</label>
                    <div className="relative">
                        <ShieldCheck className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm font-medium"
                        />
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="text-red-600 text-xs bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 animate-in shake">
                    <AlertCircle size={14} className="shrink-0" /> 
                    <span>{error}</span>
                </div>
            )}
            
            {/* Local/Offline Warning */}
            {dbStatus === 'offline' && !error && (
                 <div className="text-amber-600 text-xs bg-amber-50 p-2 rounded border border-amber-100 flex items-center gap-2">
                    <AlertCircle size={12} />
                    Using Local Storage (No Cloud DB detected)
                 </div>
            )}

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow-lg transform active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 mt-2"
            >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : (isRegistering ? 'Create Account' : 'Sign In')}
            </button>
            </form>

            {/* Toggle */}
            <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                    {isRegistering ? "Already have an account?" : "New to USTC Assistant?"}
                    <button 
                        onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                        className="ml-2 text-blue-600 font-bold hover:underline focus:outline-none"
                    >
                        {isRegistering ? 'Sign In' : 'Register Now'}
                    </button>
                </p>
            </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 text-white/40 text-xs font-light">
        © University of Science and Technology of China
      </div>
    </div>
  );
};

export default Login;

