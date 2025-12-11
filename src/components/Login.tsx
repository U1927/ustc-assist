
import React from 'react';
import { UserProfile } from '../types';
import { BookOpen, LogIn, ExternalLink } from 'lucide-react';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  
  const handleCasLogin = () => {
    // Construct the service URL (the current page)
    // We strip existing query params to avoid nesting tickets
    const currentUrl = window.location.origin + window.location.pathname;
    const service = encodeURIComponent(currentUrl);
    
    // Redirect to USTC Passport
    window.location.href = `https://passport.ustc.edu.cn/login?service=${service}`;
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center relative" 
         style={{ backgroundImage: 'url("https://www.ustc.edu.cn/images/2022/10/24/20221024103608670.jpg")' }}>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm"></div>

      <div className="bg-white rounded-xl shadow-2xl p-10 w-full max-w-[400px] z-10 relative border-t-4 border-blue-600 flex flex-col items-center text-center">
        
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-6 shadow-lg transform hover:scale-105 transition duration-300">
           <BookOpen className="text-white w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800">USTC Assistant</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-[260px]">
          Seamlessly manage your academic schedule with Unified Identity.
        </p>

        <div className="mt-8 w-full space-y-4">
          <button
            onClick={handleCasLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-lg shadow-lg flex items-center justify-center gap-3 transition transform active:scale-95 group"
          >
            <LogIn size={20} className="group-hover:translate-x-0.5 transition" />
            <span>Login with Unified Identity</span>
          </button>
          
          <div className="text-xs text-gray-400 pt-2">
            Securely authenticated via passport.ustc.edu.cn
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 w-full">
           <a 
             href="https://jw.ustc.edu.cn" 
             target="_blank" 
             rel="noreferrer"
             className="text-xs text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 font-medium"
           >
             Go to Academic Affairs (JW) <ExternalLink size={10} />
           </a>
        </div>
      </div>

      <div className="absolute bottom-6 text-white/40 text-xs">
        © University of Science and Technology of China
      </div>
    </div>
  );
};

export default Login;
