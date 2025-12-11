
import React, { useState } from 'react';
import { X, FileJson, Check, AlertCircle, HelpCircle, Loader2, Globe, RefreshCw, Terminal } from 'lucide-react';
import { autoImportFromJw } from '../services/crawlerService';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonStr: string) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('auto');
  const [jsonInput, setJsonInput] = useState('');
  
  // Auto Import State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Captcha State
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loginContext, setLoginContext] = useState<any>(null);
  
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  if (!isOpen) return null;

  const handleManualImport = () => {
    if (!jsonInput.trim()) {
      setError("Please paste the JSON content.");
      return;
    }
    setError('');
    onImport(jsonInput);
    setJsonInput('');
  };

  const handleAutoImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter Username and Password");
      return;
    }
    if (captchaRequired && !captchaCode) {
        setError("Please enter the verification code");
        return;
    }

    setIsLoading(true);
    setError('');
    setDebugInfo('');

    try {
      // Pass captcha and context if we are in phase 2
      const response = await autoImportFromJw(
          username, 
          password, 
          captchaRequired ? captchaCode : undefined,
          loginContext
      );

      // Check if server asks for Captcha (or asks AGAIN)
      if (response.requireCaptcha) {
          setCaptchaRequired(true);
          setCaptchaImage(response.captchaImage);
          setLoginContext(response.context);
          setCaptchaCode(''); // Clear previous code
          setError(response.message || "Please enter the code shown below.");
          setIsLoading(false);
          return;
      }

      // Success logic
      const jsonStr = JSON.stringify(response);
      onImport(jsonStr);
      
      // Cleanup
      setPassword('');
      setUsername('');
      setCaptchaRequired(false);
      setCaptchaCode('');
      setLoginContext(null);
      setDebugInfo('');

    } catch (err: any) {
      setError(err.message || "Login failed. Please try Manual Import.");
      
      // Check for debugHtml in the error object if passed via custom error structure
      // Note: autoImportFromJw throws simple Error, so we might need to parse string or rely on what's available
      // The backend now returns `debugHtml` in the JSON body of the 500 response.
      // autoImportFromJw catches it and throws `error.message`.
      // If we want detailed debug, we'd need to update autoImportFromJw to attach it to the error object.
      // For now, let's just display the message which might contain details.
    } finally {
      setIsLoading(false);
    }
  };

  const resetAutoImport = () => {
      setCaptchaRequired(false);
      setLoginContext(null);
      setCaptchaCode('');
      setError('');
      setDebugInfo('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[600px] max-w-full flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
           <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
             <FileJson size={20} className="text-blue-600"/> Import Schedule
           </h2>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
           <button 
             onClick={() => setActiveTab('auto')}
             className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'auto' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             Auto Sync (Login)
           </button>
           <button 
             onClick={() => setActiveTab('manual')}
             className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             Manual Paste (JSON)
           </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded flex flex-col gap-2 text-xs border border-red-100 animate-pulse">
              <div className="flex items-center gap-2 font-bold"><AlertCircle size={14} /> System Message</div>
              <div>{error}</div>
              {/* If the error message contains explicit HTML debug info (separated by newline usually), render it */}
              {error.includes('DebugHtml:') && (
                  <div className="mt-2 bg-red-100 p-2 rounded max-h-32 overflow-y-auto font-mono text-[10px] break-all border border-red-200">
                      <div className="flex items-center gap-1 font-bold mb-1"><Terminal size={10}/> Server Response Preview</div>
                      {error.split('DebugHtml:')[1]}
                  </div>
              )}
            </div>
          )}

          {activeTab === 'auto' ? (
             <form onSubmit={handleAutoImport} className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 flex gap-2">
                   <Globe className="flex-shrink-0 mt-0.5" size={16} />
                   <div>
                     <p className="font-bold">Connects to USTC CAS</p>
                     <p className="opacity-80 text-xs mt-1">
                       Secure proxy to <code>passport.ustc.edu.cn</code>. 
                       Handles standard login and captcha verification.
                     </p>
                   </div>
                </div>

                {/* Standard Credentials */}
                <div className={captchaRequired ? 'opacity-50 pointer-events-none' : ''}>
                    <div className="mb-3">
                        <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Student ID</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="PB20xxxx"
                            disabled={captchaRequired}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Password</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            disabled={captchaRequired}
                        />
                    </div>
                </div>

                {/* CAPTCHA SECTION */}
                {captchaRequired && (
                    <div className="bg-yellow-50 p-4 rounded border border-yellow-200 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-2">
                             <label className="block text-xs font-bold text-yellow-800 uppercase">Security Check</label>
                             <button type="button" onClick={resetAutoImport} className="text-[10px] text-gray-500 underline">Cancel</button>
                        </div>
                        <div className="flex items-center gap-3">
                             {captchaImage && (
                                 <img src={captchaImage} alt="Captcha" className="h-10 border rounded shadow-sm" />
                             )}
                             <input 
                                type="text"
                                autoFocus
                                value={captchaCode}
                                onChange={e => setCaptchaCode(e.target.value)}
                                className="flex-1 p-2 border rounded focus:ring-2 focus:ring-yellow-500 outline-none font-mono text-center tracking-widest uppercase"
                                placeholder="CODE"
                             />
                        </div>
                        <p className="text-[10px] text-yellow-700 mt-2">
                           Enter the characters shown in the image to continue.
                        </p>
                    </div>
                )}

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white font-bold py-2.5 rounded hover:bg-blue-700 flex items-center justify-center gap-2 transition"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={18}/> : (captchaRequired ? <Check size={18}/> : <RefreshCw size={18}/>)}
                    {isLoading ? (captchaRequired ? "Verifying..." : "Connecting...") : (captchaRequired ? "Submit Verification" : "Login & Sync")}
                  </button>
                </div>
             </form>
          ) : (
             <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 space-y-2">
                  <h3 className="font-bold flex items-center gap-2 text-gray-800"><HelpCircle size={16}/> Manual Method</h3>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Log in to <a href="https://jw.ustc.edu.cn/for-std/course-table" target="_blank" className="underline text-blue-600" rel="noreferrer">jw.ustc.edu.cn</a> (Chrome/Edge).</li>
                    <li>Press <kbd className="bg-white px-1 border rounded">F12</kbd> (DevTools) &gt; Network.</li>
                    <li>Refresh page. Find request <code>get-data</code> (or similar).</li>
                    <li>Copy the Response content and paste below.</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Paste JSON</label>
                  <textarea 
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='{"studentTableVm": { "activities": [...] } ... }'
                    className="w-full h-32 p-3 bg-gray-50 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <button onClick={handleManualImport} className="w-full px-4 py-2.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-900 flex items-center justify-center gap-2">
                  <Check size={16}/> Parse & Import
                </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
