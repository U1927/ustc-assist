
import React, { useState, useEffect, useRef } from 'react';
import { validateStudentId } from '../services/utils';
import { UserProfile, ScheduleItem } from '../types';
import { BookOpen, ShieldCheck, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import * as Utils from '../services/utils';
import * as Crawler from '../services/crawlerService';
import * as UstcParser from '../services/ustcParser';

interface LoginProps {
  onLogin: (user: UserProfile, initialEvents?: ScheduleItem[]) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); // To show "Connecting...", "Fetching Schedule..."

  // Captcha State
  const [captchaImg, setCaptchaImg] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loginContext, setLoginContext] = useState<any>(null);

  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Local Validation
    if (!validateStudentId(studentId)) {
      setError('Invalid ID format. Ex: PB20000001');
      return;
    }
    if (password.length < 1) {
      setError('Please enter your password.');
      return;
    }

    if (isMounted.current) {
        setIsLoading(true);
        setError('');
        setLoadingStep('Authenticating with CAS...');
    }

    try {
        const cleanId = studentId.toUpperCase().trim();
        
        // --- REAL CRAWLER LOGIN ---
        // Connects to server.js /api/jw/login to act as an embedded browser
        const result = await Crawler.autoImportFromJw(cleanId, password, captchaCode, loginContext);

        if (result.requireCaptcha) {
            setCaptchaImg(result.captchaImage);
            setLoginContext(result.context);
            setError("Security check required. Please enter code.");
            if (isMounted.current) setIsLoading(false);
            return;
        }

        if (isMounted.current) setLoadingStep('Syncing Schedule...');

        // --- SUCCESS ---
        // 1. Construct User Profile
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

        // 2. Parse Fetched Data
        let parsedEvents: ScheduleItem[] = [];
        try {
            parsedEvents = UstcParser.parseJwJson(result, semesterStart);
            console.log(`[Login] Parsed ${parsedEvents.length} events from First & Second Classroom.`);
        } catch (parseError) {
            console.error("[Login] Data parse error:", parseError);
        }

        // 3. Complete Login
        onLogin(userProfile, parsedEvents);

    } catch (err: any) {
        if (isMounted.current) {
             setError(err.message || "Login failed. Network error or wrong password.");
             // If error is not about captcha code, clear captcha state to retry fresh
             if (!err.message.includes('code') && !err.message.includes('验证码')) {
                 setCaptchaImg('');
                 setLoginContext(null);
             }
        }
    } finally {
        if (isMounted.current) setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-center flex items-center justify-center relative" 
         style={{ backgroundImage: 'url("https://www.ustc.edu.cn/images/2022/10/24/20221024103608670.jpg")' }}>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm"></div>

      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-[400px] z-10 relative border-t-4 border-blue-600 animate-in fade-in zoom-in duration-300">
        
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
              disabled={isLoading}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm disabled:opacity-50"
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
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm disabled:opacity-50"
            />
          </div>

          {/* Captcha Input (Only appears if server requests it) */}
          {captchaImg && (
             <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider text-red-600">Verification Code Required</label>
                <div className="flex gap-2">
                    <img 
                      src={captchaImg} 
                      alt="Captcha" 
                      className="h-9 rounded border bg-white cursor-pointer hover:opacity-80 transition" 
                      onClick={() => setError('Please click login again to refresh code.')} 
                      title="Captcha Image"
                    />
                    <input 
                      type="text" 
                      value={captchaCode} 
                      onChange={e => setCaptchaCode(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      placeholder="Enter code"
                      autoFocus
                    />
                </div>
             </div>
          )}

          {error && (
            <div className="text-red-600 text-xs bg-red-50 p-2.5 rounded border border-red-200 flex items-center gap-2 font-medium">
              <ShieldCheck size={14} className="flex-shrink-0" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded shadow-lg transform active:scale-95 transition duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> {loadingStep || 'Logging in...'}
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <div className="flex justify-center gap-4 text-xs text-blue-600">
             <a href="https://passport.ustc.edu.cn/findPassword" target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
               Forgot Password?
             </a>
             <span className="text-gray-300">|</span>
             <a href="https://jw.ustc.edu.cn" target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
               JW System <ExternalLink size={10} />
             </a>
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-3 leading-relaxed">
            This client connects securely to the USTC network. <br/>
            Your password is used for a single session authentication and is <strong>never saved</strong>.
          </p>
        </div>
      </div>
      
      <div className="absolute bottom-4 text-white/50 text-xs flex gap-4">
        <span>© University of Science and Technology of China</span>
        <span>Learning Assistant Client</span>
      </div>
    </div>
  );
};

export default Login;
