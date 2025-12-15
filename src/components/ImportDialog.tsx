
import React, { useState } from 'react';
import { X, RefreshCw, AlertCircle, Loader2, BookOpen, Coffee, Eye, EyeOff } from 'lucide-react';
import * as Crawler from '../services/crawlerService';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonData: any) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [source, setSource] = useState<'jw' | 'young'>('jw');
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
      } else {
        result = await Crawler.syncFromYoung(username, password, captchaCode, loginContext);
      }

      if (result.requireCaptcha) {
        setCaptchaImg(result.captchaImage);
        setLoginContext(result.context);
        setIsLoading(false);
        return;
      }

      onImport(source === 'jw' ? { firstClassroom: result } : { secondClassroom: result });
      onClose();
      alert(`Successfully synced ${source === 'jw' ? 'First' : 'Second'} Classroom data!`);
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden animate-in zoom-in-95">
        <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2"><RefreshCw size={18}/> Sync Schedule</h2>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        
        <div className="flex border-b">
          <button 
            onClick={() => { setSource('jw'); setError(''); }}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${source === 'jw' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500'}`}
          >
            <BookOpen size={16}/> First Classroom (JW)
          </button>
          <button 
             onClick={() => { setSource('young'); setError(''); }}
             className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${source === 'young' ? 'text-pink-600 border-b-2 border-pink-600 bg-pink-50' : 'text-gray-500'}`}
          >
            <Coffee size={16}/> Second (Young)
          </button>
        </div>

        <form onSubmit={handleSync} className="p-6 space-y-4">
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border">
            Connects to <strong>{source === 'jw' ? 'jw.ustc.edu.cn' : 'young.ustc.edu.cn'}</strong>.
          </div>

          <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500" placeholder="Student ID (PB...)" />
          
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500 pr-10" 
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
          
          {captchaImg && (
             <div className="flex gap-2">
               <img src={captchaImg} className="h-9 border rounded"/>
               <input type="text" value={captchaCode} onChange={e => setCaptchaCode(e.target.value)} className="flex-1 border p-2 rounded text-sm" placeholder="Captcha" autoFocus/>
             </div>
          )}

          {error && <div className="text-red-600 text-xs flex items-center gap-1"><AlertCircle size={12}/> {error}</div>}

          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex justify-center gap-2">
            {isLoading && <Loader2 size={16} className="animate-spin"/>} Sync
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImportDialog;

