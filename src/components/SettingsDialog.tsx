
import React, { useState } from 'react';
import { AppSettings } from '../types';
import { Save, Sliders, X, CloudLightning, Lock, Calendar } from 'lucide-react';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onForceSync: () => void;
  onChangePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onSave, 
  onForceSync,
  onChangePassword
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Password Change State
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMessage, setPassMessage] = useState({ text: '', type: '' });
  const [isChangingPass, setIsChangingPass] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await onForceSync();
    setIsSyncing(false);
  };

  const handleChangePassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPass || !newPass) {
      setPassMessage({ text: 'Please fill all fields', type: 'error' });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMessage({ text: 'New passwords do not match', type: 'error' });
      return;
    }
    if (newPass.length < 6) {
      setPassMessage({ text: 'Password must be at least 6 chars', type: 'error' });
      return;
    }

    setIsChangingPass(true);
    setPassMessage({ text: '', type: '' });
    
    const res = await onChangePassword(oldPass, newPass);
    
    setIsChangingPass(false);
    if (res.success) {
      setPassMessage({ text: 'Password updated successfully', type: 'success' });
      setOldPass('');
      setNewPass('');
      setConfirmPass('');
    } else {
      setPassMessage({ text: res.error || 'Failed to update', type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-full m-4 flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
           <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
             <Sliders size={20} className="text-blue-600"/> Preferences
           </h2>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <form id="settings-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Semester Settings */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-1 flex items-center gap-1">
                <Calendar size={12}/> Academic Calendar
              </h3>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Semester Name</label>
                   <input 
                     type="text" 
                     value={formData.semester?.name || ''}
                     onChange={e => setFormData({
                       ...formData, 
                       semester: { ...formData.semester, name: e.target.value }
                     })}
                     className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Total Weeks</label>
                   <input 
                     type="number" 
                     value={formData.semester?.totalWeeks || 18}
                     onChange={e => setFormData({
                       ...formData, 
                       semester: { ...formData.semester, totalWeeks: Number(e.target.value) }
                     })}
                     className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                   />
                 </div>
                 <div className="col-span-2">
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date (Monday of Week 1)</label>
                   <input 
                     type="date" 
                     value={formData.semester?.startDate || ''}
                     onChange={e => setFormData({
                       ...formData, 
                       semester: { ...formData.semester, startDate: e.target.value }
                     })}
                     className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                   />
                   <p className="text-[10px] text-gray-400 mt-1">
                     Determines the dates for "Week 1", "Week 2", etc.
                   </p>
                 </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-1">Notifications</h3>
              <div className="space-y-3">
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
            </div>
          </form>

          {/* Security Section */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-1 flex items-center gap-1">
              <Lock size={12}/> Account Security
            </h3>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
               <div className="space-y-2">
                 <input 
                   type="password" 
                   placeholder="Current Password"
                   className="w-full text-sm p-2 border rounded focus:border-blue-500 outline-none"
                   value={oldPass}
                   onChange={e => setOldPass(e.target.value)}
                 />
                 <div className="grid grid-cols-2 gap-2">
                   <input 
                    type="password" 
                    placeholder="New Password"
                    className="w-full text-sm p-2 border rounded focus:border-blue-500 outline-none"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                   />
                   <input 
                    type="password" 
                    placeholder="Confirm New"
                    className="w-full text-sm p-2 border rounded focus:border-blue-500 outline-none"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                   />
                 </div>
                 
                 {passMessage.text && (
                   <div className={`text-xs p-2 rounded ${passMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {passMessage.text}
                   </div>
                 )}

                 <button 
                   onClick={handleChangePassSubmit}
                   disabled={isChangingPass}
                   className="w-full bg-slate-800 text-white text-xs font-bold py-2 rounded hover:bg-slate-900 transition flex justify-center"
                 >
                   {isChangingPass ? "Updating..." : "Update Password"}
                 </button>
               </div>
            </div>
          </div>

          {/* Debugging Zone */}
          <div className="pt-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 border-b pb-1">Troubleshooting</h3>
            <button 
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 py-2 px-3 rounded text-sm transition"
            >
              <CloudLightning size={16} /> 
              {isSyncing ? "Testing Connection..." : "Test Cloud Connection (Force Save)"}
            </button>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded">Close</button>
          <button form="settings-form" type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
            <Save size={16}/> Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
