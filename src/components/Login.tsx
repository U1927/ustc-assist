
import React, { useState } from 'react';
import { validateStudentId } from '../services/utils';
import { UserProfile } from '../types';
import { BookOpen, ShieldCheck, ExternalLink, UserPlus, LogIn } from 'lucide-react';
import * as Utils from '../services/utils';
import * as Storage from '../services/storageService';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Local Validation
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

    try {
      const cleanId = studentId.toUpperCase().trim();

      if (isRegistering) {
        // --- REGISTER ---
        const res = await Storage.registerUser(cleanId, password);
        if (res.success) {
          alert("Registration successful! Please log in.");
          setIsRegistering(false); // Switch to login mode
          setPassword(''); // Clear password for security
        } else {
          setError(res.error || "Registration failed");
        }
      } else {
        // --- LOGIN ---
        const res = await Storage.loginUser(cleanId, password);
        if (res.success) {
          // Initialize default settings (Settings are currently local-first or merged later)
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
          setError(res.error || "Login failed. Please check credentials.");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected network error occurred.");
    } finally {
      setIsLoading(false);
    }
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
           <p className="text-xs text-gray-500 mt-1">USTC Learning Assistant Cloud</p>
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
              placeholder="Choose a secure password"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
            />
          </div>

          {error && (
            <div className="text-red-500 text-xs bg-red-50 p-2 rounded border border-red-200 flex items-center gap-1 animate-pulse">
              <ShieldCheck size={12} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded shadow-lg transform active:scale-95 transition duration-150 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              'Processing...'
            ) : isRegistering ? (
              <><UserPlus size={18} /> Register</>
            ) : (
              <><LogIn size={18} /> Login</>
            )}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col items-center gap-2">
           <button 
             onClick={() => {
               setIsRegistering(!isRegistering);
               setError('');
               setPassword('');
             }}
             className="text-sm text-blue-600 hover:text-blue-800 font-medium transition"
           >
             {isRegistering ? 'Already have an account? Login' : 'New here? Create an account'}
           </button>

           {!isRegistering && (
            <a 
                href="https://passport.ustc.edu.cn/login" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline flex items-center gap-1 mt-2"
            >
                Forgot Password? (Use Official Passport) <ExternalLink size={10} />
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
