
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { BookOpen, LogIn, ExternalLink, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCASLogin = () => {
    setIsLoading(true);
    // Current URL (without query params) to redirect back to
    const serviceUrl = window.location.origin + window.location.pathname;
    const casLoginUrl = `https://passport.ustc.edu.cn/login?service=${encodeURIComponent(serviceUrl)}`;
    
    // Redirect to USTC
    window.location.href = casLoginUrl;
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center relative" 
         style={{ backgroundImage: 'url("https://www.ustc.edu.cn/images/2022/10/24/20221024103608670.jpg")' }}>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm"></div>

      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-[400px] z-10 relative border-t-4 border-blue-600">
        
        <div className="flex flex-col items-center mb-8">
           <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg animate-in zoom-in duration-300">
              <BookOpen className="text-white w-7 h-7" />
           </div>
           <h1 className="text-2xl font-bold text-gray-800 text-center">USTC Assistant</h1>
           <p className="text-sm text-gray-500 mt-2 text-center">Cloud Learning Management System</p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
            <p className="text-xs text-blue-800 font-medium mb-1 uppercase tracking-wide">Authentication Method</p>
            <p className="text-sm text-blue-900 font-bold flex items-center justify-center gap-1">
               <ShieldCheckIcon /> USTC Unified Identity
            </p>
          </div>

          {error && (
            <div className="text-red-500 text-xs bg-red-50 p-3 rounded border border-red-200 text-center">
               {error}
            </div>
          )}

          <button
            onClick={handleCASLogin}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg transform active:scale-95 transition duration-150 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20}/> Redirecting...
              </>
            ) : (
              <>
                <LogIn size={20} /> Login with USTC Passport
              </>
            )}
          </button>
          
          <p className="text-[10px] text-center text-gray-400">
            You will be redirected to passport.ustc.edu.cn for secure authentication.
          </p>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-4 flex justify-center">
           <a 
            href="https://www.ustc.edu.cn" 
            target="_blank" 
            rel="noreferrer"
            className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition"
          >
            University of Science and Technology of China <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
};

const ShieldCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <path d="m9 12 2 2 4-4"></path>
  </svg>
);

export default Login;
