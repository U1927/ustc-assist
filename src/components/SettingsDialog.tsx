import React, { useState } from 'react';
import { AppSettings } from '../types';
import { Save, Sliders, X } from 'lucide-react';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[400px] max-w-full m-4 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
           <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
             <Sliders size={20} className="text-blue-600"/> Preferences
           </h2>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 hover:bg-white transition cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={formData.earlyEightReminder}
                onChange={e => setFormData({...formData, earlyEightReminder: e.target.checked})}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-900">早八提醒 (Early 8 Alert)</div>
                <div className="text-xs text-gray-500">Get notified the night before 8:00 AM classes.</div>
              </div>
            </label>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Class Reminder</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  min="0"
                  max="120"
                  value={formData.reminderMinutesBefore}
                  onChange={e => setFormData({...formData, reminderMinutesBefore: Number(e.target.value)})}
                  className="w-20 border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
                <span className="text-sm text-gray-500">minutes before start</span>
              </div>
            </div>
          </div>
        </form>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
            <Save size={16}/> Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;