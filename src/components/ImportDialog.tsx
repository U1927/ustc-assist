
import React, { useState, useEffect } from 'react';
import { X, FileJson, Check, Terminal, ExternalLink, Copy, PlayCircle, AlertCircle } from 'lucide-react';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonStr: string) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState<'script' | 'manual'>('script');
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'waiting' | 'success'>('idle');

  // --- SCRIPT METHOD LOGIC ---
  
  // The script we want the user to run
  const CRAWLER_SCRIPT = `
(async () => {
  try {
    console.log("USTC Assistant: 开始抓取...");
    const html = document.body.innerHTML;
    
    // 1. Find Student ID
    const idMatch = html.match(/studentId[:\\s"']+(\\d+)/);
    const bizMatch = html.match(/bizTypeId[:\\s"']+(\\d+)/);
    
    if(!idMatch) {
        alert("❌ 无法找到学号信息。\\n请确保您已经登录，并且处于【学生课表查询】页面。");
        return;
    }
    
    const stdId = idMatch[1];
    const bizId = bizMatch ? bizMatch[1] : 2;
    console.log("Found ID:", stdId);

    // 2. Fetch Data using User's Session
    const url = \`https://jw.ustc.edu.cn/for-std/course-table/get-data?bizTypeId=\${bizId}&studentId=\${stdId}\`;
    const res = await fetch(url);
    const json = await res.json();
    
    // 3. Send back to App
    if (window.opener) {
        window.opener.postMessage({ type: 'USTC_DATA_IMPORT', payload: json }, '*');
        alert("✅ 课表数据已发送至 USTC Assistant！\\n您可以关闭此窗口了。");
    } else {
        // Fallback: Copy to clipboard
        const str = JSON.stringify(json);
        const input = document.createElement('textarea');
        input.value = str;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        alert("✅ 无法自动传回数据，但已复制到剪贴板！\\n请返回应用并手动粘贴。");
    }
  } catch (e) {
    alert("❌ 抓取失败: " + e.message);
  }
})();
`.trim();

  // Listen for the postMessage from the opened window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'USTC_DATA_IMPORT') {
        console.log("[Import] Received data via postMessage");
        onImport(JSON.stringify(event.data.payload));
        setStatus('success');
        // Optional: Close dialog automatically?
        // onClose();
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

  // --- MANUAL METHOD LOGIC ---
  const handleManualImport = () => {
    if (!jsonInput.trim()) return;
    onImport(jsonInput);
    setJsonInput('');
    setStatus('success');
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
             <p className="text-xs text-gray-500 mt-1">从中国科学技术大学教务系统同步课表</p>
           </div>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-50 p-1 rounded-full"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50/50">
           <button 
             onClick={() => setActiveTab('script')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'script' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
           >
             <Terminal size={16}/> 脚本自动同步 (推荐)
           </button>
           <button 
             onClick={() => setActiveTab('manual')}
             className={`flex-1 py-3 text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
           >
             <Copy size={16}/> 手动粘贴 JSON
           </button>
        </div>

        <div className="p-6 overflow-y-auto">
          
          {status === 'success' ? (
             <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800">导入成功!</h3>
                <p className="text-gray-500">课表数据已成功解析并保存。</p>
                <button onClick={onClose} className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition">完成</button>
             </div>
          ) : activeTab === 'script' ? (
             <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
                   <p className="font-bold mb-1 flex items-center gap-2"><AlertCircle size={16}/> 为什么需要这样操作?</p>
                   <p className="opacity-90 text-xs leading-relaxed">
                     由于浏览器的安全策略 (CORS)，我们无法直接读取教务系统的数据。
                     通过在教务系统页面运行一段简单的脚本，利用您已登录的身份获取数据并传回，是目前最安全、最稳定的方式。
                   </p>
                </div>

                <div className="space-y-4">
                   {/* Step 1 */}
                   <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center flex-shrink-0">1</div>
                      <div className="flex-1">
                         <h4 className="font-bold text-gray-800">打开教务系统并登录</h4>
                         <p className="text-xs text-gray-500 mb-2">点击下方按钮将在新窗口打开课表页面。请在该窗口完成登录。</p>
                         <button 
                           onClick={handleOpenJw}
                           className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium transition shadow-sm"
                         >
                           <ExternalLink size={16}/> 打开 JW 课表页面
                         </button>
                      </div>
                   </div>

                   {/* Step 2 */}
                   <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center flex-shrink-0">2</div>
                      <div className="flex-1 min-w-0">
                         <h4 className="font-bold text-gray-800">复制代码并在控制台运行</h4>
                         <p className="text-xs text-gray-500 mb-2">
                            在教务系统页面按下 <kbd className="bg-gray-100 border px-1 rounded font-mono">F12</kbd> 打开开发者工具，点击 <strong>Console (控制台)</strong> 标签，粘贴代码并回车。
                         </p>
                         
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

                   {/* Step 3 */}
                   <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center flex-shrink-0">3</div>
                      <div className="flex-1">
                         <h4 className="font-bold text-gray-800">等待同步</h4>
                         <p className="text-xs text-gray-500">
                            脚本运行成功后，数据会自动传回此处。如果自动传回失败，脚本会将数据复制到剪贴板，请切换到“手动粘贴”页签使用。
                         </p>
                         {status === 'waiting' && (
                             <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded animate-pulse">
                                <PlayCircle size={14}/> 正在监听来自教务窗口的数据...
                             </div>
                         )}
                      </div>
                   </div>
                </div>
             </div>
          ) : (
             <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 space-y-2">
                  <h3 className="font-bold flex items-center gap-2 text-gray-800"><Terminal size={16}/> 传统方法 (Network 面板)</h3>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>登录 <a href="https://jw.ustc.edu.cn/for-std/course-table" target="_blank" className="underline text-blue-600" rel="noreferrer">jw.ustc.edu.cn</a></li>
                    <li>按 <kbd className="bg-white px-1 border rounded">F12</kbd> 找到 Network (网络) 标签</li>
                    <li>刷新页面，在筛选框输入 <code>get-data</code></li>
                    <li>点击请求，复制 Response (响应) 中的完整内容</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">粘贴 JSON 数据</label>
                  <textarea 
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='{"studentTableVm": { "activities": [...] } ... }'
                    className="w-full h-40 p-3 bg-gray-50 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <button onClick={handleManualImport} className="w-full px-4 py-3 text-sm bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition">
                  <Check size={18}/> 解析并导入
                </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
