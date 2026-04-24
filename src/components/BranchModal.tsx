import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, GitBranch, Sparkles, Loader2 } from 'lucide-react';
import { getAI, withRetry } from '../lib/gemini';
import { InfoTooltip } from './InfoTooltip';

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBranch: (scenario: string) => void;
  context: string;
  onTokenUsage?: (usage: { input: number, output: number }) => void;
}

export const BranchModal: React.FC<BranchModalProps> = ({ isOpen, onClose, onBranch, context, onTokenUsage }) => {
  const [scenario, setScenario] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerateBlackSwan = async () => {
    setIsGenerating(true);
    try {
      const prompt = `Based on the following conversation context, suggest a single, high-impact "Black Swan" event or "What If" scenario that would completely disrupt the current consensus or strategy.
      
      Context:
      ${context.substring(0, 5000)}...
      
      Output only the scenario description (1-2 sentences). Make it provocative, unexpected, and challenging.`;

      const responseStream = await withRetry(() => getAI().models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: prompt,
      }));

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          setScenario(fullText);
        }
        if (chunk.usageMetadata && onTokenUsage) {
          onTokenUsage({
            input: chunk.usageMetadata.promptTokenCount || 0,
            output: chunk.usageMetadata.candidatesTokenCount || 0
          });
        }
      }
    } catch (error) {
      console.error("Failed to generate scenario:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E03C31]/10 rounded-lg border border-[#E03C31]/20">
              <GitBranch size={20} className="text-[#E03C31]" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-[#F4F4F0] uppercase tracking-wider flex items-center gap-2">
                Branch Timeline
                <InfoTooltip text="Branching creates a parallel timeline. Your original chat is preserved, but this new timeline forces the Council to adapt to a sudden change in reality." />
              </h3>
              <p className="text-xs text-zinc-500 font-mono">Fork the conversation with a new variable.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-[#F4F4F0] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Scenario / Pivot Point</label>
            <textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="e.g., What if the primary competitor drops their price to zero?"
              className="w-full h-32 bg-black border border-zinc-800 rounded-lg p-4 text-sm text-[#F4F4F0] focus:outline-none focus:border-[#E03C31]/50 transition-colors resize-none placeholder:text-zinc-700 font-mono"
            />
          </div>

          <div className="flex justify-between items-center gap-4">
            <button
              onClick={handleGenerateBlackSwan}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-[#E03C31]/30 text-[#E03C31] text-xs font-mono uppercase tracking-wider rounded-lg transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isGenerating ? 'Generating...' : 'Auto-Generate Black Swan'}
            </button>

            <button
              onClick={() => onBranch(scenario)}
              disabled={!scenario.trim()}
              className="px-6 py-2 bg-[#F4F4F0] text-black hover:bg-zinc-200 text-xs font-bold font-mono uppercase tracking-widest rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Branch
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
