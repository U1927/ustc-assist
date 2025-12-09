
import React, { useState } from 'react';
import { UserProfile } from '../types';
import * as Storage from '../services/storageService';
import { BookOpen, LogIn, UserPlus, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !password) {
      setError("Please fill in all fields.");
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      if (isRegistering) {
        // Register
        const res = await Storage.registerUser(studentId, password);
        if (res.success) {
          alert("Registration successful! Please login.");
          setIsRegistering(false);
        } else {
          setError(res.error || "Registration failed");
        }
      } else {
        // Login
        const res = await Storage.loginUser(studentId, password);
        if (res.success) {
           const userProfile: UserProfile = {
             studentId: studentId,
             name: `Student ${studentId}`,
             isLoggedIn: true,
             settings: { earlyEightReminder: true, reminderMinutesBefore: 15 }
           };
           onLogin(userProfile);
        } else {
          setError(res.error || "Login failed");
        }
      }
    } catch (err) {
      setError("Network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center relative" 
         style={{ backgroundImage: 'url("https://www.ustc.edu.cn/images/2022/10/24/20221024103608670.jpg")' }}>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm"></div>

      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-[400px] z-10 relative border-t-4 border-blue-600">
        
        <div className="flex flex-col items-center mb-8">
           <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <BookOpen className="text-white w-7 h-7" />
           </div>
           <h1 className="text-2xl font-bold text-gray-800 text-center">USTC Assistant</h1>
           <p className="text-sm text-gray-500 mt-2 text-center">
             {isRegistering ? "Create your account" : "Welcome back"}
           </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Student ID (学号)</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. PB20000001"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          {error && (
            <div className="text-red-500 text-xs bg-red-50 p-3 rounded border border-red-200 text-center">
               {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20}/> : (isRegistering ? <UserPlus size={20}/> : <LogIn size={20}/>)}
            {isLoading ? "Processing..." : (isRegistering ? "Register" : "Login")}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-600">
            {isRegistering ? "Already have an account?" : "New to USTC Assistant?"}
          </p>
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setStudentId('');
              setPassword('');
            }}
            className="text-blue-600 font-semibold hover:underline mt-1 text-sm"
          >
            {isRegistering ? "Login here" : "Create an account"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
