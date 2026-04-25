import React, { useState } from 'react';
import { TASK_FORCES, TaskForce } from '../taskForces';
import { motion } from 'framer-motion';
import { ArrowRight, Users, Sparkles, Loader2 } from 'lucide-react';

interface TaskForceGridProps {
  onSelect: (taskForce: TaskForce) => void;
  onGenerate?: (goal: string) => Promise<void>;
  customTaskForces?: TaskForce[];
}

export const TaskForceGrid: React.FC<TaskForceGridProps> = ({ onSelect, onGenerate, customTaskForces = [] }) => {
  const [goal, setGoal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!goal.trim() || !onGenerate) return;
    setIsGenerating(true);
    await onGenerate(goal);
    setIsGenerating(false);
  };

  const allTaskForces = [...TASK_FORCES, ...customTaskForces];

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Auto-Assembler Section */}
      {onGenerate && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-xl flex flex-col md:flex-row gap-4 items-center"
        >
          <div className="p-3 bg-[#005A9C]/30 border border-[#005A9C]/50 rounded-lg shrink-0">
            <Sparkles size={24} className="text-[#005A9C]" />
          </div>
          
          <div className="flex-1 w-full">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#005A9C] mb-1">
              Auto-Assemble Custom Panel
            </h3>
            <p className="text-xs text-zinc-500 mb-3">
              Describe your specific problem, and AI will recruit 3 perfect experts.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full mt-4">
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What problem are you trying to solve? (e.g., 'Analyze the housing market')"
                className="w-full bg-black/50 border border-zinc-800 p-2 text-sm text-[#F4F4F0] focus:border-[#005A9C] outline-none transition-colors placeholder:text-zinc-700"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !goal.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-[#005A9C]/10 text-[#005A9C] border border-[#005A9C]/50 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {isGenerating ? 'Assembling...' : 'Assemble ->'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allTaskForces.map((tf, index) => (
          <motion.button
            key={tf.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelect(tf)}
            className="group relative flex flex-col items-start text-left bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 p-6 rounded-xl transition-colors duration-300 h-full hover:-translate-y-1 will-change-transform transform transition-transform ease-out"
          >
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400">
              <ArrowRight size={20} />
            </div>
            
            <div className="mb-4 p-3 bg-black border border-zinc-800 rounded-lg group-hover:border-zinc-600 transition-colors">
              <Users size={24} className="text-zinc-400 group-hover:text-[#F4F4F0] transition-colors" />
            </div>

            <h3 className="text-lg font-mono font-bold uppercase tracking-wider text-[#F4F4F0] mb-2 group-hover:text-[#005A9C] transition-colors">
              {tf.name}
            </h3>
            
            <p className="text-sm text-zinc-400 mb-6 font-light leading-relaxed">
              {tf.purpose}
            </p>

            <div className="mt-auto w-full space-y-2 border-t border-zinc-800 pt-4">
              {tf.agents.map((agent, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover:bg-zinc-500 transition-colors" />
                  <span className="truncate">{agent.name}</span>
                </div>
              ))}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
