import React, { useState, useEffect, useRef } from 'react';
import { X, FileJson, Check, Terminal, ExternalLink, Copy, PlayCircle, AlertCircle, Loader2, RefreshCw, Shield, Lock, User, Eye, EyeOff } from 'lucide-react';
import * as Crawler from '../services/crawlerService';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonData: any) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState<'auto' | 'script' | 'manual'>('auto');
  const [status, setStatus] = useState<'idle' | 'waiting' | 'success'>('idle');
  
  // Auto Import State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaImg, setCaptchaImg] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loginContext, setLoginContext] = useState<any>(null); // To store session cookies/tokens between steps

  // Manual JSON State
  const [jsonInput, setJsonInput] = useState('');

  // Ref for mounted state
  const isMounted = useRef(true);
  useEffect(() => {
     return () => { isMounted.current = false; };
  }, []);

  // Script State
  const CRAWLER_SCRIPT = `
(async () => {
  try {
    console.log("USTC Assistant: Starting crawler...");
    const html = document.body.innerHTML;
    let json = null;
    
    // 1. Find IDs
    const idMatch = html.match(/studentId[:\\s"']+(\\d+)/);
    const bizMatch = html.match(/bizTypeId[:\\s"']+(\\d+)/);
    const semMatch = html.match(/semesterId[:\\s"']+(\\d+)/);
    
    if(!idMatch) {
        alert("❌ Cannot find Student ID.\\nPlease ensure you are logged in and on the [Student Course Table Query] page.");
        return;
    }
    
    const stdId = idMatch[1];
    const bizId = bizMatch ? bizMatch[1] : 2;
    console.log("Found ID:", stdId);

    // 2. Attempt API Fetch (Primary Method)
    try {
        let url = \`https://jw.ustc.edu.cn/for-std/course-table/get-data?bizTypeId=\${bizId}&studentId=\${stdId}\`;
        if (semMatch) {
            url += \`&semesterId=\${semMatch[1]}\`;
            console.log("Found Semester:", semMatch[1]);
        }
        
        console.log("Fetching URL:", url);
        const res = await fetch(url);
        if (res.ok) {
            json = await res.json();
            console.log("API Fetch Success");
        } else {
            console.warn("API Fetch returned status:", res.status);
        }
    } catch (err) {
        console.warn("API Fetch Failed:", err);
    }

    // 3. Fallback: Extract from Source Code (Secondary Method)
    if (!json) {
        console.log("Attempting to extract from page source...");
        const scriptMatch = html.match(/lessonList\\s*:\\s*(\\[.*?\\])(?:,\\s*[a-zA-Z]+:|$)/s) || 
                            html.match(/activities\\s*:\\s*(\\[.*?\\])(?:,\\s*[a-zA-Z]+:|$)/s) ||
                            html.match(/var\\s+activities\\s*=\s*(\\[.*?\\]);/s);
                            
        if (scriptMatch) {
            try {
                json = JSON.parse(scriptMatch[1]);
                console.log("Source Extraction Success");
            } catch (e) {
                console.error("JSON Parse Error on source extraction", e);
            }
        }
    }

    if (!json) {
        throw new Error("Unable to retrieve data (API request failed and unable to extract from source). Please try the [Manual JSON Paste] method.");
    }
    
    // 4. Send back to App
    if (window.opener) {
        window.opener.postMessage({ type: 'USTC_DATA_IMPORT', payload: json }, '*');
        alert("✅ Schedule data sent to USTC Assistant!\\nYou can close this window now.");
    } else {
        const str = JSON.stringify(json);
        const input = document.createElement('textarea');
        input.value = str;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        alert("✅ Unable to send data automatically, but it has been copied to your clipboard!\\nPlease return to the app, switch to the [Manual JSON Paste] tab, and paste it.");
    }
  } catch (e) {
    alert("❌ Crawl failed: " + e.message);
  }
})();
`.trim();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'USTC_DATA_IMPORT') {
        console.log("[Import] Received data via postMessage");
        onImport(event.data.payload);
        if(isMounted.current) setStatus('success');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onImport]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(CRAWLER_SCRIPT);
    alert("Script copied! Please paste it in the JW System console.");
  };

  const handleOpenJw = () => {
    window.open('https://jw.ustc.edu.cn/for-std/course-table', 'ustc_jw_window');
    setStatus('waiting');
  };

  const handleManualImport = () => {
    if (!jsonInput.trim()) return;
    onImport(jsonInput);
    setJsonInput('');
    setStatus('success');
  };

  // --- AUTO IMPORT LOGIC ---

  const handleAutoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    if (captchaImg && !captchaCode) {
        setError("Please enter the verification code");
        return;
    }

    if (isMounted.current) {
        setIsLoading(true);
        setError('');
    }

    try {
        const result = await Crawler.autoImportFromJw(
            username, 
            password, 
            captchaCode, 
            loginContext
        );

        // Check if Captcha is required (Intermediate Step)
        if (result.requireCaptcha) {
            if (isMounted.current) {
                setCaptchaImg(result.captchaImage);
                setLoginContext(result.context); // Save session state
                setError(result.message || "Please enter the verification code.");
                setCaptchaCode(''); // Clear previous code if any
                setIsLoading(false);
            }
            return;
        }

        // Success!
        if (isMounted.current) {
            onImport(result);
            setStatus('success');
        }
        
    } catch (err: any) {
        if (isMounted.current) {
            setError(err.message || "Import failed");
            // Reset captcha state on error to force retry or re-login
            if (err.message.includes('Verification') || err.message.includes('验证')) {
                 // Keep context, just clear code
                 setCaptchaCode('');
            } else {
                 // Fatal error, reset flow
                 setCaptchaImg('');
                 setLoginContext(null);
            }
        }
    } finally {
        if (isMounted.current) setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[650px] max-w-full flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
           <div>
             <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               <FileJson size={24} className="text-blue-600"/> Import Schedule
             </h2>
             <p className="text-xs text-gray-500 mt-1">Sync from USTC Academic Affairs (JW)</p>
           </div>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-50 p-1 rounded-full"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50/50">
           <button 
             onClick={() => setActiveTab('auto')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'auto' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-white/50'}`}
           >
             <RefreshCw size={14}/> Auto Sync (CAS)
           </button>
           <button 
             onClick={() => setActiveTab('script')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'script' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-white/50'}`}
           >
             <Terminal size={14}/> Console Script
           </button>
           <button 
             onClick={() => setActiveTab('manual')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-white/50'}`}
           >
             <Copy size={14}/> JSON Paste
           </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {status === 'success' ? (
             <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Check size={32} className="text-green-600"/>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Import Successful!</h3>
                <p className="text-gray-500 text-sm mt-2 max-w-xs">Your schedule has been synchronized. You can close this window now.</p>
                <button onClick={onClose} className="mt-6 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-full text-sm font-bold transition">
                   Close
                </button>
             </div>
          ) : (
            <>
              {activeTab === 'auto' && (
                <div className="space-y-4">
                   <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex gap-3">
                      <Shield size={20} className="text-blue-600 flex-shrink-0 mt-0.5"/>
                      <div className="text-xs text-blue-800">
                        <p className="font-bold mb-1">Privacy Notice</p>
                        <p>Your credentials are sent directly to USTC CAS via a local proxy. We do not store your password.</p>
                      </div>
                   </div>
                   
                   <form onSubmit={handleAutoLogin} className="space-y-4 pt-2">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1"><User size={12}/> Student ID</label>
                        <input 
                           type="text" 
                           value={username}
                           onChange={e => setUsername(e.target.value)}
                           className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="PBxxxxxxxx"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1"><Lock size={12}/> Password</label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                                placeholder="USTC Passport Password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                      </div>

                      {/* Captcha Input */}
                      {captchaImg && (
                          <div className="bg-orange-50 p-3 rounded border border-orange-100 animate-in fade-in slide-in-from-top-2">
                             <p className="text-xs font-bold text-orange-800 mb-2">Security Verification Required</p>
                             <div className="flex gap-3">
                                 <img src={captchaImg} alt="Captcha" className="h-10 rounded border" />
                                 <input 
                                    type="text"
                                    value={captchaCode}
                                    onChange={e => setCaptchaCode(e.target.value)} 
                                    className="flex-1 border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="Enter Code"
                                    autoFocus
                                 />
                             </div>
                          </div>
                      )}

                      {error && (
                        <div className="text-red-500 text-xs bg-red-50 p-2 rounded border border-red-200 flex items-center gap-2">
                            <AlertCircle size={14}/> {error}
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-blue-600 text-white font-bold py-2.5 rounded hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                         {isLoading ? <Loader2 size={18} className="animate-spin"/> : <RefreshCw size={18}/>}
                         {isLoading ? "Connecting to CAS..." : (captchaImg ? "Verify & Login" : "Start Sync")}
                      </button>
                   </form>
                </div>
              )}

              {activeTab === 'script' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      1. Open <a href="https://jw.ustc.edu.cn/for-std/course-table" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">USTC JW Course Table <ExternalLink size={10}/></a>
                    </p>
                    <p className="text-sm text-gray-600">
                      2. Press <kbd className="bg-gray-100 px-1 rounded border">F12</kbd> to open Developer Tools, then click the <strong>Console</strong> tab.
                    </p>
                    <p className="text-sm text-gray-600">
                      3. Copy and paste the script below into the Console and press <kbd className="bg-gray-100 px-1 rounded border">Enter</kbd>.
                    </p>
                  </div>
                  
                  <div className="relative">
                    <textarea 
                      readOnly
                      value={CRAWLER_SCRIPT}
                      className="w-full h-40 bg-slate-900 text-green-400 font-mono text-xs p-3 rounded-lg outline-none resize-none"
                    />
                    <button 
                      onClick={handleCopyScript}
                      className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-1.5 rounded transition"
                      title="Copy Script"
                    >
                      <Copy size={14}/>
                    </button>
                  </div>

                  <div className="flex gap-3">
                     <button 
                       onClick={handleCopyScript}
                       className="flex-1 bg-slate-800 text-white py-2 rounded text-sm font-bold hover:bg-slate-900 flex items-center justify-center gap-2"
                     >
                       <Copy size={16}/> Copy Script
                     </button>
                     <button 
                       onClick={handleOpenJw}
                       className="flex-1 bg-blue-50 text-blue-600 border border-blue-200 py-2 rounded text-sm font-bold hover:bg-blue-100 flex items-center justify-center gap-2"
                     >
                       <ExternalLink size={16}/> Open JW System
                     </button>
                  </div>
                </div>
              )}

              {activeTab === 'manual' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    If you have the raw JSON response from `get-data`, paste it below.
                  </p>
                  <textarea 
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='Paste JSON content here...'
                    className="w-full h-48 border p-3 rounded text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button 
                    onClick={handleManualImport}
                    disabled={!jsonInput.trim()}
                    className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    <PlayCircle size={16}/> Parse & Import
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
