
import React, { useState } from 'react';
import { validateStudentId } from '../services/utils';
import { UserProfile } from '../types';
import { BookOpen, ShieldCheck, ExternalLink, UserPlus, LogIn, Database } from 'lucide-react';
import * as Utils from '../services/utils';
import * as Storage from '../services/storageService';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Basic Validation
    if (!validateStudentId(studentId)) {
      setError('Invalid ID format. (e.g. PB20000001)');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const cleanId = studentId.toUpperCase().trim();

      if (isRegistering) {
        // --- REAL REGISTER ---
        const res = await Storage.registerUser(cleanId, password);
        
        if (res.success) {
          setSuccessMsg("Registration successful! Please log in.");
          setIsRegistering(false); // Switch back to login view
          setPassword(''); // Clear password for security
        } else {
          // Handle specific errors (e.g., "User already exists", "Database not connected")
          setError(res.error || "Registration failed.");
        }
      } else {
        // --- REAL LOGIN ---
        const res = await Storage.loginUser(cleanId, password);
        
        if (res.success) {
          // Initialize default profile structure
          // Note: Actual schedule data is fetched in App.tsx after login
          const semesterStart = Utils.getSemesterDefaultStartDate();
          
          const userProfile: UserProfile = {
            studentId: cleanId,
            name: `Student ${cleanId}`, 
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
          };
          
          onLogin(userProfile);
        } else {
          // Handle specific errors (e.g., "Incorrect password", "User not found")
          setError(res.error || "Login failed.");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setSuccessMsg('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center relative" 
         style={{ backgroundImage: 'url("https://www.ustc.edu.cn/images/2022/10/24/20221024103608670.jpg")' }}>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm"></div>

      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-[400px] z-10 relative border-t-4 border-blue-600 animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
           <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-2 shadow-lg">
              <BookOpen className="text-white w-6 h-6" />
           </div>
           <h1 className="text-xl font-bold text-gray-800">
             {isRegistering ? 'Create Account' : 'Welcome Back'}
           </h1>
           <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
             <Database size={10} /> USTC Assistant Cloud
           </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
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
              placeholder={isRegistering ? "Set a strong password" : "Enter your password"}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
            />
          </div>

          {/* Success Message */}
          {successMsg && (
            <div className="text-green-600 text-xs bg-green-50 p-2 rounded border border-green-200 flex items-center gap-1 text-center justify-center font-bold">
               {successMsg}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-red-500 text-xs bg-red-50 p-2 rounded border border-red-200 flex items-center gap-1 animate-pulse">
              <ShieldCheck size={12} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-bold py-2.5 rounded shadow-lg transform active:scale-95 transition duration-150 flex items-center justify-center gap-2 ${
              isRegistering ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              'Connecting...'
            ) : isRegistering ? (
              <><UserPlus size={18} /> Register Account</>
            ) : (
              <><LogIn size={18} /> Login</>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col items-center gap-3">
           {/* Toggle Register/Login */}
           <div className="text-sm text-gray-600">
             {isRegistering ? "Already have an account?" : "No account yet?"}{' '}
             <button 
               onClick={toggleMode}
               className="text-blue-600 hover:text-blue-800 font-bold hover:underline transition"
             >
               {isRegistering ? 'Login here' : 'Register now'}
             </button>
           </div>

           {!isRegistering && (
            <a 
                href="https://passport.ustc.edu.cn/login" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline flex items-center gap-1"
            >
                Forgot Password? (Manual Reset Required) <ExternalLink size={10} />
            </a>
           )}
        </div>
      </div>
      
      <div className="absolute bottom-4 text-white/50 text-xs">
        © University of Science and Technology of China Learning Assistant
      </div>
    </div>
  );
};

export default Login;
