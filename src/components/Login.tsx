
import React, { useState, useEffect, useRef } from 'react';
import { validateStudentId } from '../services/utils';
import { UserProfile } from '../types';
import { BookOpen, ShieldCheck, Loader2, Database, Server, UserPlus, LogIn } from 'lucide-react';
import * as Storage from '../services/storageService';
import * as Crawler from '../services/crawlerService';
import * as Utils from '../services/utils';

interface LoginProps {
  onLogin: (user: UserProfile, rawSyncData?: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');

  // Captcha State for Crawler verification
  const [captchaImg, setCaptchaImg] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loginContext, setLoginContext] = useState<any>(null);

  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  // Clear error when switching modes
  useEffect(() => {
    setError('');
    setCaptchaImg('');
    setCaptchaCode('');
  }, [mode]);

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
    setCaptchaImg('');
    
    const cleanId = studentId.toUpperCase().trim();

    try {
      if (mode === 'login') {
        await processLogin(cleanId);
      } else {
        await processRegister(cleanId);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(err.message || "Operation failed.");
      if (!err.message.includes('code') && !err.message.includes('Security')) {
        setCaptchaImg('');
        setLoginContext(null);
      }
    } finally {
      if (isMounted.current && !captchaImg) setIsLoading(false);
    }
  };

  const processLogin = async (cleanId: string) => {
    setStatusText('Authenticating...');
    const dbResult = await Storage.loginUser(cleanId, password);

    if (dbResult.success) {
      console.log("[Login] Database login successful.");
      completeLogin(cleanId);
    } else {
      if (dbResult.error && (dbResult.error.includes("not found") || dbResult.error.includes("register"))) {
        setError("Account not found.");
        throw new Error("Account not found. Please register.");
      } else {
        throw new Error(dbResult.error || "Login Failed");
      }
    }
  };

  const processRegister = async (cleanId: string) => {
    // 1. Verify credentials via USTC Proxy (Authentication Only)
    setStatusText('Verifying Identity...');
    // We still call the crawler to verify the password against CAS
    const crawlResult = await Crawler.autoImportFromJw(cleanId, password, captchaCode, loginContext);

    if (crawlResult.requireCaptcha) {
      setCaptchaImg(crawlResult.captchaImage);
      setLoginContext(crawlResult.context);
      setStatusText('Security Check');
      setIsLoading(false); 
      return; 
    }

    // 2. Create DB Account
    setStatusText('Creating Profile...');
    const regResult = await Storage.registerUser(cleanId, password);
    if (!regResult.success) {
      if (regResult.error?.includes("already exists")) {
         await processLogin(cleanId); 
         return;
      }
      throw new Error("Registration Failed: " + regResult.error);
    }

    // 3. Complete - Pass the raw crawl result to App for background processing
    // Login UI does NOT parse it.
    completeLogin(cleanId, crawlResult);
  };

  const completeLogin = (id: string, rawData?: any) => {
      onLogin({
        studentId: id,
        name: `Student ${id}`,
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
      }, rawData);
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
           <h1 className="text-xl font-bold text-gray-800">Unified Identity Authentication</h1>
           <p className="text-xs text-gray-500 mt-1">CAS - Central Authentication Service</p>
        </div>

        {/* Mode Toggle Tabs */}
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
              disabled={isLoading && !captchaImg}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition text-sm disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="USTC Password"
              disabled={isLoading && !captchaImg}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition text-sm disabled:opacity-50"
            />
          </div>

          {/* Captcha Section */}
          {captchaImg && (
             <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider text-red-600">Verification Code</label>
                <div className="flex gap-2">
                    <img 
                      src={captchaImg} 
                      alt="Captcha" 
                      className="h-9 rounded border bg-white cursor-pointer" 
                      onClick={() => setError('Please click button to refresh.')}
                    />
                    <input 
                      type="text" 
                      value={captchaCode} 
                      onChange={e => setCaptchaCode(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      placeholder="Code"
                      autoFocus
                    />
                </div>
             </div>
          )}

          {error && (
            <div className="text-red-500 text-xs bg-red-50 p-3 rounded border border-red-200 flex flex-col gap-1">
              <div className="flex items-center gap-2 font-bold">
                 <ShieldCheck size={14} /> 
                 <span>{error}</span>
              </div>
              {error.toLowerCase().includes("not found") && mode === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => setMode('register')}
                    className="text-left text-blue-600 underline hover:text-blue-800 mt-1"
                  >
                    Click here to Register →
                  </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading && !captchaImg} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded shadow-lg transform active:scale-95 transition duration-150 flex items-center justify-center gap-2"
          >
            {isLoading && !captchaImg ? (
                <>
                 <Loader2 size={16} className="animate-spin" /> {statusText}
                </>
            ) : (
                <>
                  {mode === 'login' ? <LogIn size={16}/> : <UserPlus size={16}/>}
                  {mode === 'login' ? 'Login' : 'Verify & Create'}
                </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="text-[10px] text-center text-gray-400 leading-tight">
             {mode === 'register' 
               ? "Verifies identity with CAS. Schedule data will be synced in the background." 
               : "Secure local login."}
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
