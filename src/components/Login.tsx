
import React, { useState, useEffect, useRef } from 'react';
import { validateStudentId } from '../services/utils';
import { UserProfile } from '../types';
import { BookOpen, ShieldCheck, Loader2, LogIn } from 'lucide-react';
import * as Crawler from '../services/crawlerService';
import * as Utils from '../services/utils';

interface LoginProps {
  onLogin: (user: UserProfile, initialData?: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  // Captcha State
  const [captchaImg, setCaptchaImg] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loginContext, setLoginContext] = useState<any>(null);

  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStudentId(studentId)) {
      setError('学号格式错误 (Example: PB20000001)');
      return;
    }
    if (password.length < 1) {
      setError('请输入密码');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatusText('连接中科大教务系统...');
    
    const cleanId = studentId.toUpperCase().trim();

    try {
      // Direct Data Fetch (Functions as Login Verification + Data Sync)
      const result = await Crawler.autoImportFromJw(cleanId, password, captchaCode, loginContext);

      if (result.requireCaptcha) {
        setCaptchaImg(result.captchaImage);
        setLoginContext(result.context);
        setError("请输入验证码以继续");
        setStatusText('');
        setIsLoading(false);
        return;
      }

      setStatusText('登录成功，正在解析课表...');
      
      const userProfile: UserProfile = {
        studentId: cleanId,
        name: `Student ${cleanId}`,
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

      // Pass the fetched data directly to App to avoid secondary fetch
      onLogin(userProfile, result);

    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(err.message || "登录失败，请检查账号密码");
      // Reset captcha if failed
      if (!err.message.includes('验证码')) {
         setCaptchaImg('');
         setLoginContext(null);
         setCaptchaCode('');
      }
    } finally {
      if (isMounted.current && !captchaImg) setIsLoading(false);
    }
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
           <p className="text-xs text-gray-500 mt-1">USTC Course Schedule Manager</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">学号 (Student ID)</label>
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
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">密码 (Password)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="USTC Passport Password"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition text-sm disabled:opacity-50"
            />
          </div>

          {captchaImg && (
            <div className="animate-in fade-in slide-in-from-top-2">
               <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">验证码 (Captcha)</label>
               <div className="flex gap-2 items-center">
                 <div className="relative">
                    <img src={captchaImg} alt="Captcha" className="h-10 rounded border border-gray-300" />
                 </div>
                 <input 
                   type="text" 
                   value={captchaCode}
                   onChange={e => setCaptchaCode(e.target.value)}
                   className="flex-1 px-4 py-2 bg-white border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                   placeholder="Enter code"
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
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading && !captchaImg} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded shadow-lg transform active:scale-95 transition duration-150 flex items-center justify-center gap-2"
          >
            {isLoading ? (
                <>
                 <Loader2 size={16} className="animate-spin" /> {statusText || 'Processing...'}
                </>
            ) : (
                <>
                  <LogIn size={16}/> 登录并同步课表
                </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="text-[10px] text-center text-gray-400 leading-tight">
             Uses official USTC CAS for authentication. <br/>
             Syncs only first classroom (JW) data via secure proxy.
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

