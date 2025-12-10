
import React, { useState } from 'react';
import { X, FileJson, Check, AlertCircle, HelpCircle } from 'lucide-react';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonStr: string) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleImport = () => {
    if (!jsonInput.trim()) {
      setError("Please paste the JSON content.");
      return;
    }
    setError('');
    onImport(jsonInput);
    setJsonInput('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[600px] max-w-full flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
           <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
             <FileJson size={20} className="text-blue-600"/> Import from JW System
           </h2>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 space-y-2">
            <h3 className="font-bold flex items-center gap-2"><HelpCircle size={16}/> How to get the data?</h3>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Log in to <a href="https://jw.ustc.edu.cn/for-std/course-table" target="_blank" className="underline font-semibold" rel="noreferrer">jw.ustc.edu.cn</a> using Chrome/Edge.</li>
              <li>Press <kbd className="bg-white px-1 rounded border">F12</kbd> to open Developer Tools.</li>
              <li>Go to the <strong>Network</strong> tab and select <strong>Fetch/XHR</strong> filter.</li>
              <li>Refresh the page. Look for a request named <code>get-data</code> (or similar).</li>
              <li>Click it, go to the <strong>Response</strong> tab, select all (Ctrl+A), and Copy.</li>
              <li>Paste the content below.</li>
            </ol>
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Paste JSON Data Here</label>
             <textarea 
               value={jsonInput}
               onChange={(e) => setJsonInput(e.target.value)}
               placeholder='{"studentTableVm": { "activities": [...] } ... }'
               className="w-full h-48 p-3 bg-gray-50 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
             />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded flex items-center gap-2 text-sm border border-red-100">
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
          <button onClick={handleImport} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 shadow-sm">
            <Check size={16}/> Parse & Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
