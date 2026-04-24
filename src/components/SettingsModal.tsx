import React from 'react';
import { ROLES, LAB_ROLES, UserSettings, DEFAULT_SETTINGS, MODELS, getActiveAgent } from '../agents';
import { X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  appMode: 'COUNCIL' | 'LAB';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange, appMode }) => {
  if (!isOpen) return null;

  const currentRoles = appMode === 'LAB' ? LAB_ROLES : ROLES;

  const handleChange = (roleId: string, field: 'thinkerId' | 'parameterValue' | 'model' | 'customInstruction' | 'isShadowCouncil', value: string | number | boolean) => {
    onSettingsChange({
      ...settings,
      [roleId]: {
        ...settings[roleId],
        [field]: value,
        ...(field === 'thinkerId' || field === 'parameterValue' ? { customInstruction: undefined } : {})
      }
    });
  };

  const handleReset = () => {
    onSettingsChange(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-zinc-800 shrink-0 bg-zinc-950">
          <h2 className="text-xl font-mono font-bold tracking-widest uppercase text-[#F4F4F0]">Council Configuration</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-[#F4F4F0] transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {appMode === 'COUNCIL' && (
            <div className="border-b border-zinc-800 pb-8 mb-4">
              <h3 className="text-sm font-mono uppercase tracking-widest text-[#F4F4F0] mb-2">Global Council Model</h3>
              <p className="text-xs text-zinc-500 mb-4">Apply a specific model to all council personas for this session.</p>
              <select 
                onChange={(e) => {
                  const newModel = e.target.value;
                  if (!newModel) return;
                  const newSettings = { ...settings };
                  ROLES.forEach(role => {
                    newSettings[role.id] = {
                      ...(newSettings[role.id] || DEFAULT_SETTINGS[role.id]),
                      model: newModel
                    };
                  });
                  onSettingsChange(newSettings);
                  e.target.value = "";
                }}
                className="w-full bg-black border border-zinc-800 text-[#F4F4F0] p-3 font-sans text-sm focus:outline-none focus:border-zinc-500"
                defaultValue=""
              >
                <option value="" disabled>Select a model to apply to all...</option>
                {MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {currentRoles.map(role => {
            const currentSettings = settings[role.id] || DEFAULT_SETTINGS[role.id];
            
            return (
              <div key={role.id} className="border-l-2 pl-4" style={{ borderColor: role.color }}>
                <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-400 mb-4">{role.name}</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-2">Selected Thinker</label>
                    <select 
                      value={currentSettings.thinkerId}
                      onChange={(e) => handleChange(role.id, 'thinkerId', e.target.value)}
                      className="w-full bg-black border border-zinc-800 text-[#F4F4F0] p-3 font-sans text-sm focus:outline-none focus:border-zinc-500"
                    >
                      {role.thinkers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-2">Model</label>
                    <select 
                      value={currentSettings.model || 'gemini-3-pro-preview'}
                      onChange={(e) => handleChange(role.id, 'model', e.target.value)}
                      className="w-full bg-black border border-zinc-800 text-[#F4F4F0] p-3 font-sans text-sm focus:outline-none focus:border-zinc-500"
                    >
                      {MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  {role.parameter && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs uppercase tracking-wider text-zinc-500">{role.parameter.name}</label>
                        <span className="text-xs font-mono text-zinc-400">{currentSettings.parameterValue}</span>
                      </div>
                      <input 
                        type="range" 
                        min={role.parameter.min} 
                        max={role.parameter.max} 
                        value={currentSettings.parameterValue}
                        onChange={(e) => handleChange(role.id, 'parameterValue', parseInt(e.target.value))}
                        className="w-full accent-[#F4F4F0]"
                        style={{ accentColor: role.color }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/50">
                    <input 
                      type="checkbox"
                      id={`shadow-${role.id}`}
                      checked={currentSettings.isShadowCouncil || false}
                      onChange={(e) => handleChange(role.id, 'isShadowCouncil', e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-red-600 focus:ring-red-900"
                    />
                    <label htmlFor={`shadow-${role.id}`} className="text-xs uppercase tracking-wider text-red-400 cursor-pointer select-none">
                      Enable Shadow Council Mode
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-2">System Prompt</label>
                    <textarea 
                      value={currentSettings.customInstruction ?? getActiveAgent(role.id, { ...settings, [role.id]: { ...currentSettings, customInstruction: undefined } }).systemInstruction}
                      onChange={(e) => handleChange(role.id, 'customInstruction', e.target.value)}
                      className="w-full bg-black border border-zinc-800 text-[#F4F4F0] p-3 font-mono text-xs focus:outline-none focus:border-zinc-500 h-32 resize-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-zinc-800 flex justify-between shrink-0 bg-zinc-950">
          <button 
            onClick={handleReset}
            className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-zinc-500 hover:text-[#F4F4F0] transition-colors"
          >
            Reset to Defaults
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-[#F4F4F0] text-black font-mono font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
