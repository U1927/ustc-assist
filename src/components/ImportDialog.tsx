
import React, { useState, useEffect, useRef } from 'react';
import { X, FileJson, Check, Terminal, Copy, AlertCircle, Loader2, RefreshCw, Shield, Lock, AlertTriangle, Globe } from 'lucide-react';
import * as Crawler from '../services/crawlerService';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonData: any) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState<'auto' | 'manual'>('auto'); 
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  
  // Auto Import State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaImg, setCaptchaImg] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loginContext, setLoginContext] = useState<any>(null);

  // Manual JSON State
  const [jsonInput, setJsonInput] = useState('');

  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const handleManualImport = () => {
    if (!jsonInput.trim()) return;
    try {
        const data = JSON.parse(jsonInput);
        onImport(data);
        setStatus('success');
    } catch (e) {
        alert("JSON Format Error. Please paste valid JSON.");
    }
  };

  const handleAutoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setIsLoading(true);
    setError('');

    try {
        // This calls the backend which acts as the 'Embedded Browser'
        const result = await Crawler.autoImportFromJw(username, password, captchaCode, loginContext);

        if (result.requireCaptcha) {
            setCaptchaImg(result.captchaImage);
            setLoginContext(result.context);
            setError("Security check required. Please enter code.");
            setIsLoading(false);
            return;
        }

        onImport(result);
        setStatus('success');
    } catch (err: any) {
        setError(err.message || "Login failed. Please check credentials.");
        if (!err.message.includes('code')) {
             setCaptchaImg('');
             setLoginContext(null);
        }
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-full flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 flex items-center justify-between text-white">
           <div>
             <h2 className="text-xl font-bold flex items-center gap-2">
               <Globe size={24} className="text-blue-200"/> 
               USTC Unified Import
             </h2>
             <p className="text-xs text-blue-100 mt-1 opacity-90">Sync First & Second Classroom Data</p>
           </div>
           <button onClick={onClose} className="text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50/50">
           <button 
             onClick={() => setActiveTab('auto')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'auto' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-white/50'}`}
           >
             <RefreshCw size={14}/> Automatic Login
           </button>
           <button 
             onClick={() => setActiveTab('manual')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-white/50'}`}
           >
             <Terminal size={14}/> Advanced / Manual
           </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {status === 'success' ? (
             <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in slide-in-from-bottom-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4"><Check size={32} className="text-green-600"/></div>
                <h3 className="text-lg font-bold text-gray-800">Sync Successful!</h3>
                <p className="text-sm text-gray-500 mt-1">First & Second Classroom data updated.</p>
                <button onClick={onClose} className="mt-6 bg-gray-100 hover:bg-gray-200 text-gray-700 px-8 py-2 rounded-full text-sm font-bold transition">Done</button>
             </div>
          ) : (
            <>
              {/* --- AUTO TAB --- */}
              {activeTab === 'auto' && (
                <div className="space-y-5">
                   <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex gap-3 items-start">
                      <Shield size={18} className="text-blue-600 flex-shrink-0 mt-0.5"/>
                      <div className="text-xs text-blue-800 leading-relaxed">
                        This feature securely connects to the <strong>Unified Identity Authentication (CAS)</strong> system to retrieve your schedule from both JW and Young portals simultaneously.
                      </div>
                   </div>
                   
                   <form onSubmit={handleAutoLogin} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Student ID</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" placeholder="PBxxxxxxxx"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" placeholder="CAS Password"/>
                      </div>

                      {captchaImg && (
                          <div className="flex gap-2 items-end bg-gray-50 p-2 rounded-lg border">
                             <img src={captchaImg} alt="Captcha" className="h-10 rounded border bg-white shadow-sm" />
                             <input type="text" value={captchaCode} onChange={e => setCaptchaCode(e.target.value)} className="flex-1 border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter Code" autoFocus />
                          </div>
                      )}

                      {error && <div className="text-red-600 text-xs flex items-center gap-1 bg-red-50 p-2 rounded"><AlertCircle size={12}/> {error}</div>}

                      <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
                         {isLoading ? <Loader2 size={18} className="animate-spin"/> : <RefreshCw size={18}/>}
                         {isLoading ? "Connecting to USTC..." : "Login & Sync Schedule"}
                      </button>
                      
                      <p className="text-[10px] text-center text-gray-400">
                         Your password is only used for this session and is never stored.
                      </p>
                   </form>
                </div>
              )}

              {/* --- MANUAL TAB --- */}
              {activeTab === 'manual' && (
                <div className="space-y-4">
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 text-xs text-orange-800">
                     <p className="font-bold flex items-center gap-1 mb-1"><Terminal size={12}/> For Advanced Users</p>
                     Use this if the automatic login fails. Paste the raw JSON data extracted from the browser console.
                  </div>
                  <textarea 
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='Paste JSON content here...'
                    className="w-full h-40 border p-3 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button onClick={handleManualImport} disabled={!jsonInput.trim()} className="w-full bg-gray-800 text-white font-bold py-2.5 rounded-lg hover:bg-gray-900 disabled:opacity-50 transition">
                    Parse & Import
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
