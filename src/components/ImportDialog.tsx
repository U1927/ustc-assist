import React, { useState, useEffect } from 'react';
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

  // Script State
  const CRAWLER_SCRIPT = `
(async () => {
  try {
    console.log("USTC Assistant: 开始抓取...");
    const html = document.body.innerHTML;
    let json = null;
    
    // 1. Find IDs
    const idMatch = html.match(/studentId[:\\s"']+(\\d+)/);
    const bizMatch = html.match(/bizTypeId[:\\s"']+(\\d+)/);
    const semMatch = html.match(/semesterId[:\\s"']+(\\d+)/);
    
    if(!idMatch) {
        alert("❌ 无法找到学号信息。\\n请确保您已经登录，并且处于【学生课表查询】页面。");
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
        throw new Error("无法获取数据 (API请求失败且无法从源码提取)。请尝试【手动粘贴 JSON】方式。");
    }
    
    // 4. Send back to App
    if (window.opener) {
        window.opener.postMessage({ type: 'USTC_DATA_IMPORT', payload: json }, '*');
        alert("✅ 课表数据已发送至 USTC Assistant！\\n您可以关闭此窗口了。");
    } else {
        const str = JSON.stringify(json);
        const input = document.createElement('textarea');
        input.value = str;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        alert("✅ 无法自动传回数据，但已复制到剪贴板！\\n请返回应用切换到【手动粘贴 JSON】标签页并粘贴。");
    }
  } catch (e) {
    alert("❌ 抓取失败: " + e.message);
  }
})();
`.trim();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'USTC_DATA_IMPORT') {
        console.log("[Import] Received data via postMessage");
        onImport(event.data.payload);
        setStatus('success');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onImport]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(CRAWLER_SCRIPT);
    alert("脚本已复制！请在教务系统控制台粘贴。");
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

    setIsLoading(true);
    setError('');

    try {
        const result = await Crawler.autoImportFromJw(
            username, 
            password, 
            captchaCode, 
            loginContext
        );

        // Check if Captcha is required (Intermediate Step)
        if (result.requireCaptcha) {
            setCaptchaImg(result.captchaImage);
            setLoginContext(result.context); // Save session state
            setError(result.message || "Please enter the verification code.");
            setCaptchaCode(''); // Clear previous code if any
            setIsLoading(false);
            return;
        }

        // Success!
        onImport(result);
        setStatus('success');
        
    } catch (err: any) {
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
    } finally {
        setIsLoading(false);
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
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'auto' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
           >
             <RefreshCw size={16}/> Auto Import
           </button>
           <button 
             onClick={() => setActiveTab('script')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'script' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
           >
             <Terminal size={16}/> Script (Backup)
           </button>
           <button 
             onClick={() => setActiveTab('manual')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
           >
             <Copy size={16}/> Manual JSON
           </button>
        </div>

        <div className="p-6 overflow-y-auto">
          
          {status === 'success' ? (
             <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Import Successful!</h3>
                <p className="text-gray-500">Your schedule has been updated.</p>
                <button onClick={onClose} className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition">Done</button>
             </div>
          ) : activeTab === 'auto' ? (
             <div className="space-y-6 max-w-sm mx-auto">
                <div className="text-center mb-4">
                   <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full text-blue-600 mb-2">
                      <Lock size={20} />
                   </div>
                   <h3 className="text-gray-800 font-bold">Unified Identity Login</h3>
                   <p className="text-xs text-gray-400">Credentials are used once to fetch data and never stored.</p>
                </div>

                <form onSubmit={handleAutoLogin} className="space-y-4">
                    <div className="space-y-3">
                       <div className="relative">
                          <User className="absolute left-3 top-2.5 text-gray-400" size={16} />
                          <input 
                             type="text" 
                             className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                             placeholder="Student ID (e.g. PB20xxxx)"
                             value={username}
                             onChange={e => setUsername(e.target.value)}
                             disabled={isLoading || !!captchaImg} // Disable ID input during captcha step
                          />
                       </div>
                       
                       {!captchaImg && (
                           <div className="relative">
                              <Lock className="absolute left-3 top-2.5 text-gray-400" size={16} />
                              <input 
                                 type={showPassword ? "text" : "password"}
                                 className="w-full pl-10 pr-10 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                 placeholder="Password"
                                 value={password}
                                 onChange={e => setPassword(e.target.value)}
                                 disabled={isLoading}
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
                       )}
                    </div>

                    {/* CAPTCHA SECTION */}
                    {captchaImg && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-2">
                           <label className="block text-xs font-bold text-gray-600 mb-2">Security Check Required</label>
                           <div className="flex gap-2">
                              <img src={captchaImg} alt="Captcha" className="h-10 rounded border" />
                              <input 
                                 type="text" 
                                 autoFocus
                                 className="flex-1 border rounded px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                                 placeholder="Enter Code"
                                 value={captchaCode}
                                 onChange={e => setCaptchaCode(e.target.value)}
                              />
                           </div>
                        </div>
                    )}

                    {error && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded flex items-start gap-2">
                           <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                           <div className="max-h-24 overflow-y-auto custom-scrollbar whitespace-pre-wrap">{error}</div>
                        </div>
                    )}

                    <button 
                       type="submit" 
                       disabled={isLoading}
                       className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-2"
                    >
                       {isLoading ? (
                           <> <Loader2 size={18} className="animate-spin" /> {captchaImg ? 'Verifying...' : 'Connecting...'} </>
                       ) : captchaImg ? (
                           'Verify & Import'
                       ) : (
                           'Login & Import'
                       )}
                    </button>
                </form>
             </div>
          ) : activeTab === 'script' ? (
             <div className="space-y-6">
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 text-sm text-orange-800">
                   <p className="font-bold mb-1 flex items-center gap-2"><Terminal size={16}/> Manual Fallback</p>
                   <p className="opacity-90 text-xs leading-relaxed">
                     If the automatic import fails (due to network blocking or CAPTCHA issues), use this script method. 
                     It runs directly in your browser window, bypassing proxy restrictions.
                   </p>
                </div>

                <div className="space-y-4">
                   <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center flex-shrink-0">1</div>
                      <div className="flex-1">
                         <h4 className="font-bold text-gray-800">Open JW System</h4>
                         <button 
                           onClick={handleOpenJw}
                           className="mt-2 flex items-center gap-2 bg-white border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 text-sm transition"
                         >
                           <ExternalLink size={14}/> Open in New Window
                         </button>
                      </div>
                   </div>

                   <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center flex-shrink-0">2</div>
                      <div className="flex-1 min-w-0">
                         <h4 className="font-bold text-gray-800">Run Script</h4>
                         <p className="text-xs text-gray-500 mb-2">Press <kbd>F12</kbd> &gt; Console &gt; Paste Code &gt; Enter</p>
                         
                         <div className="relative group">
                            <pre className="bg-slate-800 text-slate-300 p-3 rounded-lg text-[10px] font-mono overflow-x-auto h-24 border border-slate-700">
                               {CRAWLER_SCRIPT}
                            </pre>
                            <button 
                              onClick={handleCopyScript}
                              className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-1.5 rounded transition backdrop-blur-sm"
                              title="Copy Code"
                            >
                               <Copy size={14}/>
                            </button>
                         </div>
                      </div>
                   </div>
                   
                   {status === 'waiting' && (
                       <div className="flex items-center gap-2 text-xs text-blue-600 justify-center animate-pulse mt-4">
                          <Loader2 size={14} className="animate-spin"/> Listening for data...
                       </div>
                   )}
                </div>
             </div>
          ) : (
             <div className="space-y-4">
                <textarea 
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='Paste the raw JSON response here...'
                  className="w-full h-40 p-3 bg-gray-50 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
                <button onClick={handleManualImport} className="w-full px-4 py-3 text-sm bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition">
                  <Check size={18}/> Parse & Import
                </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
