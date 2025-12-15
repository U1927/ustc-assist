
import React, { useState } from 'react';
import { X, RefreshCw, AlertCircle, BookOpen, GraduationCap, ClipboardCopy, ArrowRight } from 'lucide-react';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonData: any) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [source, setSource] = useState<'jw' | 'yjs'>('jw');
  const [rawInput, setRawInput] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleParse = () => {
    setError('');
    if (!rawInput.trim()) {
        setError("Please paste the content first.");
        return;
    }

    try {
        let payload: any = {};
        
        if (source === 'jw') {
            // Attempt to parse JSON
            try {
                const json = JSON.parse(rawInput);
                // Handle direct array or wrapped object
                payload = { firstClassroom: json.lessons || json };
            } catch (e) {
                throw new Error("Invalid JSON format. Make sure you copied the entire Response.");
            }
        } else {
            // Treat as HTML string
            if (!rawInput.includes('<html') && !rawInput.includes('<table')) {
                throw new Error("Invalid HTML. Please copy the full page source.");
            }
            payload = { graduateHtml: rawInput };
        }

        onImport(payload);
        setRawInput('');
    } catch (err: any) {
        setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[600px] max-w-[95vw] overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
          <h2 className="font-bold flex items-center gap-2"><RefreshCw size={18}/> Manual Import (No Backend)</h2>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        
        <div className="flex border-b shrink-0">
          <button 
            onClick={() => { setSource('jw'); setError(''); }}
            className={`flex-1 py-3 text-sm font-bold flex flex-col items-center justify-center gap-1 transition ${source === 'jw' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <BookOpen size={18}/> 
            <span>Undergrad (JW)</span>
            <span className="text-[10px] font-normal opacity-70">JSON Mode</span>
          </button>
          <button 
            onClick={() => { setSource('yjs'); setError(''); }}
            className={`flex-1 py-3 text-sm font-bold flex flex-col items-center justify-center gap-1 transition ${source === 'yjs' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <GraduationCap size={18}/> 
            <span>Graduate (YJS)</span>
            <span className="text-[10px] font-normal opacity-70">HTML Mode</span>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {source === 'jw' ? (
              <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-2">
                  <p className="font-bold">How to get Undergrad Data:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                      <li>Log in to <a href="https://jw.ustc.edu.cn/for-std/course-table" target="_blank" className="underline font-bold">jw.ustc.edu.cn</a>.</li>
                      <li>Press <kbd className="bg-white px-1 rounded border">F12</kbd> to open DevTools, go to <strong>Network</strong> tab.</li>
                      <li>Select the "XHR" or "Fetch" filter.</li>
                      <li>Refresh the page. Find the request named <code>get-data</code>.</li>
                      <li>Click it, go to the <strong>Response</strong> tab.</li>
                      <li>Select All (Ctrl+A), Copy (Ctrl+C), and paste below.</li>
                  </ol>
              </div>
          ) : (
              <div className="mb-4 bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-800 space-y-2">
                  <p className="font-bold">How to get Graduate Data:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                      <li>Log in to <a href="https://yjs1.ustc.edu.cn/py/kbcx/xskbcx!init.action" target="_blank" className="underline font-bold">Graduate Schedule Page</a>.</li>
                      <li>Wait for the table to load.</li>
                      <li>Right-click anywhere on the page &rarr; <strong>View Page Source</strong> (or Ctrl+U).</li>
                      <li>Select All (Ctrl+A), Copy (Ctrl+C), and paste below.</li>
                  </ol>
              </div>
          )}

          <textarea 
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            placeholder={source === 'jw' ? 'Paste JSON here (e.g. {"studentId": 123, "lessons": [...]})' : 'Paste HTML source code here (<html>...</html>)'}
            className="w-full h-48 p-3 border rounded-lg text-xs font-mono bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />

          {error && (
            <div className="mt-3 text-red-600 text-xs flex items-center gap-1 bg-red-50 p-2 rounded border border-red-100">
                <AlertCircle size={12}/> {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end shrink-0">
            <button 
                onClick={handleParse} 
                className={`px-6 py-2.5 rounded-lg font-bold text-white flex items-center gap-2 shadow-lg transition ${source === 'jw' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
                <ClipboardCopy size={16}/> Parse & Import
            </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;

