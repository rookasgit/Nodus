import React, { useState } from 'react';
import { X, Star } from 'lucide-react';
import { SessionRetrospective, RetrospectiveStatus } from '../lib/sessionManager';
import { motion } from 'framer-motion';

interface RetrospectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SessionRetrospective) => void;
  sessionTitle: string;
}

const STATIC_QUESTIONS = [
  'Did this debate uncover a blind spot?',
  'Is your final decision different from your initial assumption?',
  'Are the remaining risks acceptable?'
];

export const RetrospectiveModal: React.FC<RetrospectiveModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave,
  sessionTitle 
}) => {
  const [status, setStatus] = useState<RetrospectiveStatus | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({
    [STATIC_QUESTIONS[0]]: '',
    [STATIC_QUESTIONS[1]]: '',
    [STATIC_QUESTIONS[2]]: ''
  });

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      status: status || 'NEEDS_MORE',
      answers: Object.entries(answers).map(([question, answer]) => ({
        question,
        answer: answer || 'N/A'
      })),
      createdAt: Date.now()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-lg shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h2 className="text-xl font-mono font-bold tracking-widest uppercase text-[#F4F4F0]">Session Resolution</h2>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter mt-1">{sessionTitle}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-[#F4F4F0] transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          {/* Satisfaction Status */}
          <div className="space-y-4">
            <label className="block text-xs font-mono uppercase tracking-widest text-[#F4F4F0]">Outcome Status</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'SATISFIED', label: 'Satisfied', color: 'border-green-500/50 text-green-500 hover:bg-green-500/10' },
                { id: 'UNSATISFIED', label: 'No', color: 'border-red-500/50 text-red-500 hover:bg-red-500/10' },
                { id: 'NEEDS_MORE', label: 'Needs More', color: 'border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10' }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatus(s.id as RetrospectiveStatus)}
                  className={`px-4 py-3 text-[10px] font-bold font-mono uppercase border transition-all ${
                    status === s.id 
                    ? s.color.replace('hover:', '') + ' bg-zinc-800 shadow-inner scale-[0.98]' 
                    : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-mono text-zinc-500 uppercase">Are you satisfied with the council's perspective?</p>
          </div>

          {/* Grounding Questions */}
          <div className="space-y-6">
            <label className="block text-xs font-mono uppercase tracking-widest text-[#F4F4F0]">Grounding Questions</label>
            {STATIC_QUESTIONS.map((q, idx) => (
              <div key={idx} className="space-y-2">
                <p className="text-xs text-zinc-400 font-sans">{q}</p>
                <div className="flex gap-2">
                   <button 
                    onClick={() => setAnswers(prev => ({ ...prev, [q]: 'Yes' }))}
                    className={`px-4 py-2 text-[10px] font-mono uppercase border transition-all ${
                        answers[q] === 'Yes' 
                        ? 'bg-zinc-100 text-black border-zinc-100' 
                        : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'
                    }`}
                   >
                    Yes
                   </button>
                   <button 
                    onClick={() => setAnswers(prev => ({ ...prev, [q]: 'No' }))}
                    className={`px-4 py-2 text-[10px] font-mono uppercase border transition-all ${
                        answers[q] === 'No' 
                        ? 'bg-zinc-100 text-black border-zinc-100' 
                        : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'
                    }`}
                   >
                    No
                   </button>
                   <input 
                    type="text"
                    placeholder="Elaborate..."
                    value={answers[q] !== 'Yes' && answers[q] !== 'No' ? answers[q] : ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                    className="flex-1 bg-black border border-zinc-800 text-[#F4F4F0] px-3 py-2 text-[10px] font-mono focus:outline-none focus:border-zinc-500"
                   />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-[#F4F4F0] transition-colors"
          >
            Skip
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all bg-[#F4F4F0] text-black hover:bg-zinc-200 cursor-pointer"
          >
            Resolve & Save
          </button>
        </div>
      </motion.div>
    </div>
  );
};
