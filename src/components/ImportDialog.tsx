
import React, { useState } from 'react';
import { X, RefreshCw, AlertCircle, Loader2, BookOpen, Coffee, GraduationCap, Eye, EyeOff } from 'lucide-react';
import * as Crawler from '../services/crawlerService';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonData: any) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [source, setSource] = useState<'jw' | 'yjs' | 'young'>('jw');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaImg, setCaptchaImg] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loginContext, setLoginContext] = useState<any>(null);

  if (!isOpen) return null;

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let result;
      if (source === 'jw') {
        result = await Crawler.syncFromJW(username, password, captchaCode, loginContext);
      } else if (source === 'yjs') {
        result = await Crawler.syncFromYJS(username, password, captchaCode, loginContext);
      } else {
        result = await Crawler.syncFromYoung(username, password, captchaCode, loginContext);
      }

      if (result.requireCaptcha) {
        setCaptchaImg(result.captchaImage);
        setLoginContext(result.context);
        setIsLoading(false);
        return;
      }

      onImport(result);
      onClose();
      alert(`Successfully synced data from ${source.toUpperCase()}!`);
    } catch (err: any) {
      setError(err.message);
      if (!err.message.includes('code')) {
        setCaptchaImg('');
        setLoginContext(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceConfig = () => {
      switch(source) {
          case 'jw': return { url: 'jw.ustc.edu.cn', label: 'First Classroom' };
          case 'yjs': return { url: 'yjs1.ustc.edu.cn', label: 'Graduate System' };
          case 'young': return { url: 'young.ustc.edu.cn', label: 'Second Classroom' };
      }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[450px] overflow-hidden animate-in zoom-in-95">
        <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2"><RefreshCw size={18}/> Sync Schedule</h2>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        
        <div className="flex border-b">
          <button 
            onClick={() => { setSource('jw'); setError(''); }}
            className={`flex-1 py-3 text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${source === 'jw' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <BookOpen size={16}/> Undergrad (JW)
          </button>
          <button 
            onClick={() => { setSource('yjs'); setError(''); }}
            className={`flex-1 py-3 text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${source === 'yjs' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <GraduationCap size={16}/> Graduate (YJS)
          </button>
          <button 
             onClick={() => { setSource('young'); setError(''); }}
             className={`flex-1 py-3 text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${source === 'young' ? 'text-pink-600 border-b-2 border-pink-600 bg-pink-50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Coffee size={16}/> Second (Young)
          </button>
        </div>

        <form onSubmit={handleSync} className="p-6 space-y-4">
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border flex items-center gap-2">
            <AlertCircle size={14} />
            <span>Connects to <strong>{getSourceConfig().url}</strong> via CAS.</span>
          </div>

          <div className="space-y-3">
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border p-2.5 rounded text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" placeholder="Student ID (e.g. SA23...)" />
              
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full border p-2.5 rounded text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-10 transition" 
                  placeholder="CAS Password" 
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                    tabIndex={-1}
                >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
          </div>
          
          {captchaImg && (
             <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
               <img src={captchaImg} className="h-10 border rounded"/>
               <input type="text" value={captchaCode} onChange={e => setCaptchaCode(e.target.value)} className="flex-1 border p-2 rounded text-sm outline-none focus:border-blue-500" placeholder="Enter Captcha" autoFocus/>
             </div>
          )}

          {error && <div className="text-red-600 text-xs flex items-center gap-1 bg-red-50 p-2 rounded border border-red-100"><AlertCircle size={12}/> {error}</div>}

          <button type="submit" disabled={isLoading} className="w-full bg-slate-800 text-white font-bold py-2.5 rounded hover:bg-slate-900 disabled:opacity-50 flex justify-center gap-2 transition shadow-lg mt-2">
            {isLoading && <Loader2 size={16} className="animate-spin"/>} 
            {isLoading ? 'Syncing...' : `Sync ${getSourceConfig().label}`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImportDialog;

