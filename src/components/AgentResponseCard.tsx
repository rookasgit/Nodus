import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { TypewriterText } from './ChatMessage';
import { ExtractableText } from './ExtractableText';

interface AgentResponseCardProps {
  provocation: string;
  fullAnalysis: string;
  agentColor: string;
  isTyping?: boolean;
  isExtractMode?: boolean;
  onExtractText?: (text: string) => void;
}

export const AgentResponseCard: React.FC<AgentResponseCardProps> = ({ provocation, fullAnalysis, agentColor, isTyping, isExtractMode, onExtractText }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Provocation - Large, Bold, Highly Legible */}
      <div className="text-sm md:text-sm font-normal text-[#F4F4F0] leading-tight tracking-tight">
        <TypewriterText text={provocation} isTyping={isTyping} isExtractMode={isExtractMode} onExtractText={onExtractText} />
      </div>

      {/* Toggle Button - Distinctive Rationale Trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500 hover:text-[#F4F4F0] mt-4 transition-colors w-fit flex items-center gap-2"
      >
        <span>{isExpanded ? '[ - HIDE RATIONALE ]' : '[ + EXPAND RATIONALE ]'}</span>
      </button>

      {/* Expanded State - Stark Reveal */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div 
              className="pl-6 py-2 border-l border-zinc-700 text-[#F4F4F0] text-xs leading-relaxed markdown-body"
              style={{ borderLeftColor: agentColor }}
            >
              {isExtractMode && onExtractText ? (
                <ExtractableText text={fullAnalysis} isExtractMode={isExtractMode} onExtract={onExtractText} />
              ) : (
                <Markdown>{fullAnalysis}</Markdown>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
