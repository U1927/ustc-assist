
import React, { useState, useEffect, useRef } from 'react';
import { X, FileJson, Check, Terminal, Copy, PlayCircle, AlertCircle, Loader2, RefreshCw, Shield, Lock, Globe } from 'lucide-react';
import * as Crawler from '../services/crawlerService';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonData: any) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState<'script' | 'auto' | 'manual'>('script'); 
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

  // 这里的脚本完全模拟 WakeupSchedule 的提取逻辑
  const CRAWLER_SCRIPT = `
/**
 * USTC Assistant 课表提取脚本 (兼容 WakeupSchedule 逻辑)
 * 请在 [教务系统 -> 学生课表查询] 页面按 F12 在控制台运行
 */
(async () => {
  try {
    console.clear();
    console.log("%c正在从网页源码提取数据...", "color:blue; font-weight:bold; font-size:14px;");
    
    // 1. 获取网页源码
    const html = document.body.innerHTML;
    let json = null;

    // 2. 正则提取: 寻找 studentTableVm
    const vmMatch = html.match(/var\\s+studentTableVm\\s*=\s*(\\{.*?\\});/s);
    if (vmMatch) {
        try {
            const vm = JSON.parse(vmMatch[1]);
            json = vm.activities || vm.lessons;
            console.log("✅ 成功通过 studentTableVm 提取数据");
        } catch(e) {}
    }

    // 3. 正则提取: 寻找 activities (旧版兼容)
    if (!json) {
        const actMatch = html.match(/var\\s+activities\\s*=\s*(\\[.*?\\]);/s) || 
                         html.match(/lessonList\\s*:\\s*(\\[.*?\\])/s);
        if (actMatch) {
             try { json = JSON.parse(actMatch[1]); console.log("✅ 成功通过 activities/lessonList 提取数据"); } catch(e) {}
        }
    }

    if (!json) {
        alert("❌ 提取失败！\\n请确认：\\n1. 您已登录教务系统\\n2. 当前页面是 [学生课表查询]");
        return;
    }

    // 4. 复制到剪贴板
    const str = JSON.stringify(json);
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(str);
    } else {
        const input = document.createElement('textarea');
        input.value = str;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    }
    
    console.log("%c✅ 数据已复制！", "color:green; font-weight:bold; font-size:16px;");
    alert("✅ 课表数据已复制！\\n\\n请回到 USTC Assistant，在 [方式三：直接粘贴] 中粘贴。");

  } catch (e) {
    console.error(e);
    alert("❌ 脚本运行出错: " + e.message);
  }
})();
`.trim();

  const handleCopyScript = () => {
    navigator.clipboard.writeText(CRAWLER_SCRIPT);
    alert("脚本已复制！\n请在教务系统页面按 F12 打开 Console 粘贴。");
  };

  const handleManualImport = () => {
    if (!jsonInput.trim()) return;
    try {
        const data = JSON.parse(jsonInput);
        onImport(data);
        setStatus('success');
    } catch (e) {
        alert("JSON 格式错误，请检查粘贴内容。");
    }
  };

  const handleAutoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setIsLoading(true);
    setError('');

    try {
        const result = await Crawler.autoImportFromJw(username, password, captchaCode, loginContext);

        if (result.requireCaptcha) {
            setCaptchaImg(result.captchaImage);
            setLoginContext(result.context);
            setError("需要验证码");
            setIsLoading(false);
            return;
        }

        onImport(result);
        setStatus('success');
    } catch (err: any) {
        setError(err.message || "登录失败");
        if (!err.message.includes('验证')) {
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
      <div className="bg-white rounded-xl shadow-2xl w-[640px] max-w-full flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
           <div>
             <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               <FileJson size={24} className="text-blue-600"/> 导入课表
             </h2>
             <p className="text-xs text-gray-500 mt-1">First & Second Classroom Import</p>
           </div>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-50 p-1 rounded-full"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50/50">
           <button 
             onClick={() => setActiveTab('script')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'script' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-white/50'}`}
           >
             <Terminal size={14}/> 方式一：源码提取 (推荐)
           </button>
           <button 
             onClick={() => setActiveTab('auto')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'auto' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-white/50'}`}
           >
             <RefreshCw size={14}/> 方式二：账号代理
           </button>
           <button 
             onClick={() => setActiveTab('manual')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-white/50'}`}
           >
             <Copy size={14}/> 方式三：直接粘贴
           </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {status === 'success' ? (
             <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4"><Check size={32} className="text-green-600"/></div>
                <h3 className="text-xl font-bold text-gray-800">导入成功！</h3>
                <button onClick={onClose} className="mt-6 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-full text-sm font-bold transition">关闭</button>
             </div>
          ) : (
            <>
              {/* --- SCRIPT TAB --- */}
              {activeTab === 'script' && (
                <div className="space-y-5">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 leading-relaxed">
                     <p className="font-bold mb-2 flex items-center gap-2"><Globe size={16}/> 核心原理 (Source Extraction)</p>
                     此方法与安卓版 <strong>WakeupSchedule (唤醒课程表)</strong> 原理一致：登录教务系统后，直接提取网页源码中隐藏的 <code>studentTableVm</code> 变量。
                     <br/>最安全，无需提供密码给第三方。
                  </div>

                  <div className="space-y-3">
                     <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">1</span>
                        <a href="https://jw.ustc.edu.cn/for-std/course-table" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold hover:text-blue-800">
                           点击打开 [教务系统] 并登录
                        </a>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">2</span>
                        <span>按 <kbd className="bg-gray-100 border px-1 rounded">F12</kbd> 打开 Console，复制下方脚本并运行。</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">3</span>
                        <span>切换回本窗口的 <strong>[方式三：直接粘贴]</strong>，粘贴刚才复制的数据。</span>
                     </div>
                  </div>

                  <div className="relative group border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-3 py-1 text-xs text-gray-500 border-b font-mono">Console Injector</div>
                    <textarea readOnly value={CRAWLER_SCRIPT} className="w-full h-24 bg-slate-50 text-slate-600 font-mono text-xs p-3 outline-none resize-none"/>
                    <button onClick={handleCopyScript} className="absolute bottom-3 right-3 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 shadow-sm flex items-center gap-1">
                      <Copy size={12}/> 复制脚本
                    </button>
                  </div>
                </div>
              )}

              {/* --- AUTO TAB --- */}
              {activeTab === 'auto' && (
                <div className="space-y-4">
                   <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg flex gap-3">
                      <Shield size={20} className="text-yellow-600 flex-shrink-0 mt-0.5"/>
                      <div className="text-xs text-yellow-800">
                        <p className="font-bold">后端代理模式</p>
                        <p>服务器将模拟浏览器行为：登录 CAS &rarr; 跳转 JW &rarr; 正则提取源码。适合不方便使用控制台的用户。</p>
                      </div>
                   </div>
                   
                   <form onSubmit={handleAutoLogin} className="space-y-3 px-1">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">学号 (Student ID)</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="PBxxxxxxxx"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">密码 (Password)</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="CAS Password"/>
                      </div>

                      {captchaImg && (
                          <div className="flex gap-2 items-end bg-gray-50 p-2 rounded border">
                             <img src={captchaImg} alt="Captcha" className="h-9 rounded border bg-white" />
                             <input type="text" value={captchaCode} onChange={e => setCaptchaCode(e.target.value)} className="flex-1 border p-2 rounded text-sm outline-none" placeholder="验证码" autoFocus />
                          </div>
                      )}

                      {error && <div className="text-red-600 text-xs flex items-center gap-1"><AlertCircle size={12}/> {error}</div>}

                      <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded hover:bg-blue-700 transition flex items-center justify-center gap-2">
                         {isLoading ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
                         {isLoading ? "模拟登录并提取" : "一键导入"}
                      </button>
                   </form>
                </div>
              )}

              {/* --- MANUAL TAB --- */}
              {activeTab === 'manual' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">请将脚本提取到的 JSON 内容粘贴到下方：</p>
                  <textarea 
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='例如: [{"id":...}, ...]'
                    className="w-full h-48 border p-3 rounded text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button onClick={handleManualImport} disabled={!jsonInput.trim()} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded hover:bg-blue-700 disabled:opacity-50 transition">
                    解析并导入
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
