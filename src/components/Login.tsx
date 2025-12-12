
import React, { useState, useEffect, useRef } from 'react';
import { validateStudentId } from '../services/utils';
import { UserProfile, ScheduleItem } from '../types';
import { BookOpen, ShieldCheck, ExternalLink, Loader2, Database, Server } from 'lucide-react';
import * as Storage from '../services/storageService';
import * as Crawler from '../services/crawlerService';
import * as UstcParser from '../services/ustcParser';
import * as Utils from '../services/utils';

interface LoginProps {
  onLogin: (user: UserProfile, initialEvents?: ScheduleItem[]) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('Login');

  // Captcha State for Crawler
  const [captchaImg, setCaptchaImg] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loginContext, setLoginContext] = useState<any>(null);

  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
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
    setStatusText('Checking Database...');
    setCaptchaImg(''); // Clear previous captcha

    try {
        const cleanId = studentId.toUpperCase().trim();

        // 1. First, attempt to login to Cloud Database (Supabase)
        // This preserves the "Original Login Method" preference
        const dbResult = await Storage.loginUser(cleanId, password);

        if (dbResult.success) {
            // --- SCENARIO A: User exists in DB ---
            console.log("[Login] Database login successful.");
            setStatusText('Syncing Data...');
            
            // Fetch User Data from DB
            const cloudData = await Storage.fetchUserData(cleanId);
            
            completeLogin(cleanId, cloudData?.schedule || []);
            return;
        } 
        
        // 2. If user NOT found in DB, we try to "Auto-Register" via USTC Login
        if (dbResult.error && dbResult.error.includes("not found")) {
            console.log("[Login] User not in DB. Attempting USTC Proxy Login...");
            setStatusText('Verifying with USTC...');

            // Call Crawler to verify credentials against real JW system
            const crawlResult = await Crawler.autoImportFromJw(cleanId, password, captchaCode, loginContext);

            // Handle Captcha Case
            if (crawlResult.requireCaptcha) {
                setCaptchaImg(crawlResult.captchaImage);
                setLoginContext(crawlResult.context);
                setError("Security Check Required from USTC");
                setIsLoading(false);
                setStatusText('Login');
                return;
            }

            // --- SCENARIO B: USTC Login Success (First Time User) ---
            setStatusText('Registering...');
            
            // Parse initial data
            const semesterStart = Utils.getSemesterDefaultStartDate();
            const initialEvents = UstcParser.parseJwJson(crawlResult, semesterStart);

            // Register in Database
            const regResult = await Storage.registerUser(cleanId, password);
            if (!regResult.success) {
                throw new Error("Registration Failed: " + regResult.error);
            }

            // Save initial fetched data to Database
            await Storage.saveUserData(cleanId, initialEvents, []);

            completeLogin(cleanId, initialEvents);
            return;
        }

        // 3. If password was wrong for DB
        throw new Error(dbResult.error || "Login Failed");

    } catch (err: any) {
        console.error("Login Error", err);
        setError(err.message || "Connection Error");
        // Don't clear captcha context if it's a captcha error, otherwise clear it
        if (!err.message.includes('code') && !err.message.includes('Security')) {
             setCaptchaImg('');
             setLoginContext(null);
        }
    } finally {
        if (isMounted.current && !captchaImg) setIsLoading(false);
    }
  };

  const completeLogin = (id: string, events: ScheduleItem[]) => {
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
      }, events);
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

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Student ID</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => { setStudentId(e.target.value); setError(''); }}
              placeholder="e.g., PB20000001"
              disabled={isLoading}
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
              disabled={isLoading}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition text-sm disabled:opacity-50"
            />
          </div>

          {/* Captcha Section (Dynamic) */}
          {captchaImg && (
             <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider text-red-600">Verification Code</label>
                <div className="flex gap-2">
                    <img 
                      src={captchaImg} 
                      alt="Captcha" 
                      className="h-9 rounded border bg-white cursor-pointer" 
                      onClick={() => setError('Please click login to refresh.')}
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
            <div className="text-red-500 text-xs bg-red-50 p-2.5 rounded border border-red-200 flex items-center gap-2">
              <ShieldCheck size={14} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading && !captchaImg} // Allow clicking if captcha needs refresh/submit
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded shadow-lg transform active:scale-95 transition duration-150 flex items-center justify-center gap-2"
          >
            {isLoading && !captchaImg ? (
                <>
                 <Loader2 size={16} className="animate-spin" /> {statusText}
                </>
            ) : (
                'Login'
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <div className="flex justify-center gap-4 text-xs text-gray-400">
             <span className="flex items-center gap-1"><Database size={10}/> Database Connected</span>
             <span>|</span>
             <span className="flex items-center gap-1"><Server size={10}/> Proxy Active</span>
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-2 leading-tight">
            Use your USTC account. First time login will automatically sync your schedule from JW system.
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
