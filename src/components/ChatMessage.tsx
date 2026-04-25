import React, { useState, useEffect } from 'react';
import { getActiveAgent, UserSettings, CustomAgent, ROLES, LAB_ROLES } from '../agents';
import { parseAgentResponse } from '../lib/streamExtractor';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Paperclip, CheckCircle, AlertTriangle, Loader2, RefreshCw, Link as LinkIcon, Globe, Gavel, Layout, Plus } from 'lucide-react';

import { Synthesizer } from './Synthesizer';
import { AgentResponseCard } from './AgentResponseCard';

import { ExtractableText } from './ExtractableText';

export const TypewriterText: React.FC<{ text: string, isTyping?: boolean, isExtractMode?: boolean, onExtractText?: (text: string) => void }> = ({ text = '', isTyping, isExtractMode, onExtractText }) => {
  const [displayedText, setDisplayedText] = useState(isTyping ? '' : text);
  const currentLengthRef = React.useRef(isTyping ? 0 : text.length);
  
  // If we transition to a completely new text stream (e.g. regeneration), reset
  useEffect(() => {
    if (isTyping && text === '') {
      setDisplayedText('');
      currentLengthRef.current = 0;
    }
  }, [text, isTyping]);

  useEffect(() => {
    let timeoutId: number;
    let isCancelled = false;
    
    const animate = () => {
      if (isCancelled) return;
      
      if (currentLengthRef.current < text.length) {
        const remainingText = text.slice(currentLengthRef.current);
        
        // Match up to the next space or punctuation to advance word by word
        const match = remainingText.match(/^.*?[.\s!?\n]/);
        let step = match ? match[0].length : remainingText.length;
        
        if (step === 0) step = 1;
        
        const addedText = remainingText.slice(0, step);
        const isSentenceEnd = /[.!?\n]/.test(addedText);
        
        currentLengthRef.current += step;
        setDisplayedText(text.slice(0, currentLengthRef.current));
        
        // Pause longer at sentence ends, otherwise type word by word
        const delay = isSentenceEnd ? 400 : 50;
        timeoutId = window.setTimeout(animate, delay);
      } else if (isTyping) {
        // If we caught up but still typing, check again shortly in case more text streams in
        timeoutId = window.setTimeout(animate, 100);
      } else {
        // Done typing and stream is closed
        setDisplayedText(text);
      }
    };
    
    // Only animate if we are typing or haven't caught up to the final text yet
    if (isTyping || currentLengthRef.current < text.length) {
      animate();
    } else {
      setDisplayedText(text);
    }
    
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [text, isTyping]);

  if (isExtractMode && onExtractText) {
    return <ExtractableText text={displayedText} isExtractMode={isExtractMode} onExtract={onExtractText} />;
  }

  return <Markdown>{displayedText}</Markdown>;
};

export interface DeepDive {
  id: string;
  keyword: string;
  text: string;
  isTyping?: boolean;
}

interface FactCheck {
  status: 'verifying' | 'verified' | 'warning' | 'error' | 'interpretation';
  text?: string;
  sources?: { title: string, url: string }[];
}

interface ChatMessageProps {
  id: string;
  roleId: string;
  text: string;
  isTyping?: boolean;
  settings: UserSettings;
  deepDives?: DeepDive[];
  onDeepDive?: (messageId: string, keyword: string) => void;
  customAgents?: CustomAgent[];
  attachments?: { name: string }[];
  factCheck?: FactCheck;
  onRetry?: (messageId: string) => void;
  onRegenerateWithFactCheck?: (messageId: string) => void;
  onParameterChange?: (messageId: string, newValue: number) => void;
  synthesizerData?: any; // Using any to be flexible with the 4-part structure
  fullAnalysis?: string;
  tokenCount?: number;
  sessionTokens?: { agentInput: number, agentOutput: number, synthInput: number, synthOutput: number };
  onRebuttal?: (messageId: string, targetAgentId: string, attackingAgentId: string) => void;
  availableAgents?: string[];
  allAgentsList?: (CustomAgent | ReturnType<typeof getActiveAgent>)[];
  rebuttals?: {
    id: string;
    agentId: string;
    text: string;
    isTyping: boolean;
  }[];
  pendingInfographicPrompt?: string | null;
  isGeneratingImage?: boolean;
  onGenerateInfographic?: (messageId: string, prompt: string) => void;
  imageUrl?: string;
  onAppendToCanvas?: (messageId: string) => void;
  isExtractMode?: boolean;
  onExtractText?: (text: string) => void;
  onExtractToBuffer?: (messageId: string) => void;
  onActionClick?: (question: string) => void;
}

const ParameterSlider: React.FC<{ 
  value: number, 
  min: number, 
  max: number, 
  label: string, 
  color: string,
  onChange: (val: number) => void 
}> = ({ value, min, max, label, color, onChange }) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handlePointerUp = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">{label}</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>{localValue}</span>
      </div>
      <div className="relative h-1 bg-zinc-800 rounded-full w-full cursor-pointer group">
        <input 
          type="range" 
          min={min} 
          max={max} 
          value={localValue}
          onChange={(e) => setLocalValue(parseInt(e.target.value))}
          onPointerUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div 
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-100" 
          style={{ width: `${((localValue - min) / (max - min)) * 100}%`, backgroundColor: color }}
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#F4F4F0] rounded-full shadow-lg transition-all duration-100 group-hover:scale-125"
          style={{ left: `${((localValue - min) / (max - min)) * 100}%`, marginLeft: '-6px' }}
        />
      </div>
    </div>
  );
};

// Helper to extract markdown links
const extractLinks = (text: string) => {
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const links: { title: string, url: string }[] = [];
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    links.push({ title: match[1], url: match[2] });
  }
  return links;
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ id, roleId, text, isTyping, settings, deepDives = [], onDeepDive, customAgents = [], attachments = [], factCheck, onRetry, onRegenerateWithFactCheck, onParameterChange, synthesizerData, fullAnalysis, tokenCount, sessionTokens, onRebuttal, availableAgents, allAgentsList, rebuttals, pendingInfographicPrompt, isGeneratingImage, onGenerateInfographic, imageUrl, onAppendToCanvas, isExtractMode, onExtractText, onExtractToBuffer, onActionClick }) => {
  let agent = getActiveAgent(roleId, settings);
  let parameterConfig: { name: string, min: number, max: number, default: number } | null = null;

  // Find parameter config if it exists for this role, or provide a fallback
  if (roleId === 'synthesizer') {
    parameterConfig = { name: 'Synthesis Depth', min: 0, max: 100, default: 50 };
  } else if (roleId.startsWith('custom-')) {
    parameterConfig = { name: 'Intensity', min: 0, max: 100, default: 50 };
  } else if (roleId !== 'user') {
    const role = [...ROLES, ...LAB_ROLES].find(r => r.id === roleId);
    if (role?.parameter) {
      parameterConfig = role.parameter;
    } else {
      parameterConfig = { name: 'Intensity', min: 0, max: 100, default: 50 };
    }
  }

  if (roleId.startsWith('custom-')) {
    const ca = customAgents.find(a => a.id === roleId);
    if (ca) agent = ca;
  }
  
  const [showDeepDiveInput, setShowDeepDiveInput] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [showFactCheckDetails, setShowFactCheckDetails] = useState(false);
  const [showGavelDropdown, setShowGavelDropdown] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  
  const safeText = text || '';
  const isError = safeText.startsWith('[Connection lost]') || safeText.startsWith('[Synthesis failed]');
  
  // Detect raw JSON artifacts during streaming to mask them
  const isRawJson = isTyping && roleId !== 'user' && roleId !== 'synthesizer' && (
    safeText.trim().startsWith('{') || 
    safeText.includes('"provocation"') || 
    safeText.includes('"full_analysis"') ||
    safeText.includes('```json')
  );

  // Cycling "War Room" Feedback strings
  const [thinkingIndex, setThinkingIndex] = useState(0);
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTyping && roleId !== 'user') {
      interval = setInterval(() => {
         setThinkingIndex(prev => (prev + 1) % 3);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isTyping, roleId]);

  const thinkingTraces = [
    `${agent.name} is cross-referencing datasets...`,
    `${agent.name} is challenging baseline assumptions...`,
    `${agent.name} is formulating a provocation...`
  ];

  const handleDeepDiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim() && onDeepDive) {
      onDeepDive(id, keyword.trim());
      setKeyword('');
      setShowDeepDiveInput(false);
    }
  };

  let provocationText = safeText;
  let fullAnalysisText = fullAnalysis || "";

  if (roleId !== 'user' && !isError) {
    try {
      const cleanJson = safeText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      if (roleId === 'synthesizer') {
        provocationText = parsed.whitepaper_markdown || parsed.executive_summary || safeText;
        if (parsed.alignment_quotes && Array.isArray(parsed.alignment_quotes)) {
          const quotes = parsed.alignment_quotes.map((q: any) => `> "${q.quote}" - ${q.agent_name}`).join('\n\n');
          provocationText += `\n\n### Alignment Quotes\n\n${quotes}`;
        }
        fullAnalysisText = "";
      } else {
        const headline = parsed.headline || parsed.provocation || parsed.content || parsed.maxim || parsed.quote || '';
        const rationale = parsed.rationale || parsed.full_analysis || parsed.analysis || '';
        
        if (headline && rationale) {
          provocationText = `**${headline}**\n\n${rationale}`;
          fullAnalysisText = "";
        } else if (headline) {
          provocationText = headline;
          fullAnalysisText = "";
        } else if (rationale) {
          provocationText = rationale;
          fullAnalysisText = "";
        }
      }
    } catch (e) {
      // Fallback to existing parsing for partial streams
      if (roleId !== 'synthesizer') {
        const { provocation, fullAnalysis: parsedAnalysis } = parseAgentResponse(safeText);
        if (provocation) provocationText = provocation;
        if (parsedAnalysis) fullAnalysisText = parsedAnalysis;
      }
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col h-full ${roleId === 'user' || roleId === 'synthesizer' ? 'col-span-full mb-8' : 'border border-zinc-800 p-4 bg-zinc-950/30 group relative'} ${isFlashing ? 'ring-2 ring-[#005A9C] bg-[#005A9C]/10 transition-all duration-300' : 'transition-all duration-500'}`}
      data-message-block
    >
      <div className={`flex items-center gap-2 mb-3 ${roleId === 'user' ? 'justify-end' : 'justify-start'}`}>
        {roleId !== 'user' && (
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: agent.color }}
          />
        )}
        <span 
          className="text-xs font-mono uppercase tracking-widest"
          style={{ color: roleId === 'user' ? '#888' : agent.color }}
        >
          {agent.name}
        </span>
        {roleId === 'user' && (
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: agent.color }}
          />
        )}
      </div>
      
      {/* Gavel Button (Absolute positioned) */}
      {!isTyping && roleId !== 'user' && roleId !== 'synthesizer' && onRebuttal && (
         <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
           <div className="relative">
             <button
               onClick={() => setShowGavelDropdown(!showGavelDropdown)}
               className="p-2 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-[#F4F4F0] hover:border-zinc-500 rounded-full transition-all shadow-lg"
               title="Rebut this argument"
             >
               <Gavel size={14} />
             </button>
             
             {showGavelDropdown && (
               <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-20">
                 <div className="px-3 py-2 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                   Select Attacker
                 </div>
                 {allAgentsList?.filter(a => a.id !== roleId && availableAgents?.includes(a.id)).map(agent => (
                   <button
                     key={agent.id}
                     onClick={() => {
                       onRebuttal(id, roleId, agent.id);
                       setShowGavelDropdown(false);
                     }}
                     className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-zinc-900 flex items-center gap-2 transition-colors"
                     style={{ color: agent.color }}
                   >
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
                     {agent.name}
                   </button>
                 ))}
               </div>
             )}
           </div>
         </div>
       )}
      
      <div 
        className={`w-full flex-1 ${roleId === 'user' ? 'text-right border-r-2 pr-4' : roleId === 'synthesizer' ? 'border-l-2 pl-4' : ''}`}
        style={{ borderColor: agent.color }}
      >
        {/* Parameter Slider */}
        {!isTyping && parameterConfig && onParameterChange && (
          <div className="mb-4 pb-4 border-b border-zinc-800/50">
            <ParameterSlider 
              value={settings[roleId]?.parameterValue ?? parameterConfig.default}
              min={parameterConfig.min}
              max={parameterConfig.max}
              label={parameterConfig.name}
              color={agent.color}
              onChange={(val) => onParameterChange(id, val)}
            />
          </div>
        )}

        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 justify-end">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-full text-xs font-mono text-zinc-400">
                <Paperclip size={12} />
                <span className="truncate max-w-[150px]">{att.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className={`font-mono text-sm leading-relaxed markdown-body ${isError ? 'text-red-400' : 'text-gray-300'}`}>
          {roleId === 'synthesizer' && isTyping ? (
             <div className="text-[#BFFF00] text-xs font-bold uppercase tracking-widest animate-pulse py-4">
               [ SYNTHESIZING ALIGNMENT DATA... ]
             </div>
          ) : synthesizerData ? (
            <Synthesizer data={synthesizerData} sessionTokens={sessionTokens} isExtractMode={isExtractMode} onExtractText={onExtractText} onActionClick={onActionClick} />
          ) : (
            <>
              {isRawJson ? (
                 <div className="font-mono text-lime-400 animate-pulse text-xs tracking-widest py-2">
                   [ INITIATING NEURAL LINK... ▓▓▓░░░░ ]
                 </div>
              ) : (
                fullAnalysisText || (roleId !== 'user' && (safeText.includes('"provocation":') || safeText.includes('"maxim":') || safeText.includes('"quote":'))) ? (
                  <AgentResponseCard 
                    provocation={provocationText} 
                    fullAnalysis={fullAnalysisText} 
                    agentColor={agent.color} 
                    isTyping={isTyping}
                    isExtractMode={isExtractMode}
                    onExtractText={onExtractText}
                  />
                ) : (
                  <TypewriterText text={provocationText} isTyping={isTyping} isExtractMode={isExtractMode} onExtractText={onExtractText} />
                )
              )}
              {isTyping && !synthesizerData && !isRawJson && (
                <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse align-middle" style={{ backgroundColor: agent.color }}></span>
              )}

              {isTyping && (
                <div className="mt-4 text-[10px] font-mono text-zinc-500 italic animate-pulse">
                   [ {(thinkingTraces[thinkingIndex] || '').toUpperCase()} ]
                </div>
              )}
            </>
          )}
        </div>

        {/* Image Rendering (DISABLED) */}
        {/*
        {imageUrl && (
          <div className="mt-4 mb-4">
            <img 
              src={imageUrl} 
              alt="Strategic Infographic" 
              className="w-full rounded-lg border border-zinc-800 shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
        */}

        {/* Loading State (DISABLED) */}
        {/*
        {isGeneratingImage && roleId === 'synthesizer' && (
           <div className="mt-4 mb-4 h-64 w-full bg-zinc-900/50 border border-zinc-800 animate-pulse flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-[#FFD100]/30 border-t-[#FFD100] rounded-full animate-spin"></div>
              <div className="text-[#FFD100] font-mono text-xs uppercase tracking-widest animate-pulse">
                 GENERATING VISUAL SYNTHESIS...
              </div>
           </div>
        )}
        */}

        {/* Infographic Generation Button (DISABLED) */}
        {/*
        {roleId === 'synthesizer' && pendingInfographicPrompt && !imageUrl && !isGeneratingImage && onGenerateInfographic && (
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <button
              onClick={() => onGenerateInfographic(id, pendingInfographicPrompt)}
              className="w-full py-4 bg-[#FFD100]/30 border border-[#FFD100]/50 text-[#FFD100] font-mono font-bold uppercase tracking-[0.2em] hover:bg-[#FFD100] hover:text-black transition-all flex items-center justify-center gap-3 group"
            >
              <Layout size={20} />
              VISUAL SYNTHESIS
            </button>
          </div>
        )}
        */}

        {/* Evidence Chips */}
        {!isTyping && roleId !== 'user' && roleId !== 'synthesizer' && (
          (() => {
            const links = extractLinks(fullAnalysisText || text);
            if (links.length === 0) return null;
            return (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {links.map((link, i) => (
                  <a 
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-xs text-zinc-400 p-2 rounded whitespace-nowrap transition-colors"
                  >
                    <LinkIcon size={12} />
                    <span className="max-w-[200px] truncate">{link.title}</span>
                  </a>
                ))}
              </div>
            );
          })()
        )}

        {isError && onRetry && (
          <div className="mt-4 pt-3 border-t border-zinc-800/50">
            <button 
              onClick={() => onRetry(id)}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 text-xs font-mono uppercase tracking-widest transition-colors"
            >
              <RefreshCw size={12} />
              <span>Retry Generation</span>
            </button>
          </div>
        )}

        {/* Fact Check Indicator */}
        {roleId === 'synthesizer' && factCheck && (
          <div className="mt-4 pt-3 border-t border-zinc-800/50">
            <div className="flex items-center gap-2 flex-wrap">
              {factCheck.status === 'verifying' && (
                <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono uppercase tracking-widest">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Verifying claims...</span>
                </div>
              )}
              {factCheck.status === 'verified' && (
                <div className="flex items-center gap-2 text-[#005A9C] text-xs font-mono uppercase tracking-widest">
                  <CheckCircle size={12} />
                  <span>Verified Accurate</span>
                </div>
              )}
              {factCheck.status === 'warning' && (
                <>
                  <button 
                    onClick={() => setShowFactCheckDetails(!showFactCheckDetails)}
                    className="flex items-center gap-2 text-amber-500 hover:text-amber-400 text-xs font-mono uppercase tracking-widest transition-colors mr-4"
                  >
                    <AlertTriangle size={12} />
                    <span>Potential Inaccuracies Found</span>
                    <span className="text-[10px] ml-1 opacity-70 underline">{showFactCheckDetails ? 'Hide' : 'View'}</span>
                  </button>
                  
                  {onRegenerateWithFactCheck && (
                    <button 
                      onClick={() => onRegenerateWithFactCheck(id)}
                      className="flex items-center gap-2 text-zinc-400 hover:text-[#F4F4F0] text-xs font-mono uppercase tracking-widest transition-colors border border-zinc-800 px-2 py-1 rounded hover:bg-zinc-900"
                    >
                      <RefreshCw size={12} />
                      <span>Regenerate with Corrections</span>
                    </button>
                  )}
                </>
              )}
              {factCheck.status === 'interpretation' && (
                <button 
                  onClick={() => setShowFactCheckDetails(!showFactCheckDetails)}
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-xs font-mono uppercase tracking-widest transition-colors"
                >
                  <AlertTriangle size={12} />
                  <span>Contains Persona Perspectives</span>
                  <span className="text-[10px] ml-1 opacity-70 underline">{showFactCheckDetails ? 'Hide' : 'View'}</span>
                </button>
              )}
              {factCheck.status === 'error' && (
                <div className="text-red-500 text-xs font-mono uppercase tracking-widest">
                  Fact check failed
                </div>
              )}
            </div>
            
            <AnimatePresence>
              {showFactCheckDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mt-2 text-xs p-3 rounded border font-mono ${
                    factCheck.status === 'warning' 
                      ? 'text-amber-200/80 bg-amber-950/30 border-amber-900/50' 
                      : 'text-blue-200/80 bg-blue-950/30 border-blue-900/50'
                  }`}
                >
                  <Markdown>{factCheck.text}</Markdown>
                  
                  {/* Render Sources */}
                  {factCheck.sources && factCheck.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-[#F4F4F0]/10 flex flex-wrap gap-2">
                      <span className="text-[10px] uppercase opacity-50 w-full mb-1">Grounded Ledger:</span>
                      {factCheck.sources.map((source, idx) => (
                        <a 
                          key={idx}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-black/20 hover:bg-black/40 px-2 py-1 rounded text-[10px] transition-colors border border-[#F4F4F0]/10"
                        >
                          <Globe size={10} />
                          <span className="truncate max-w-[150px]">{source.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Rebuttals Rendering */}
        {rebuttals && rebuttals.length > 0 && (
          <div className="mt-4 space-y-3 pl-4 border-l-2 border-red-500/20">
            {rebuttals.map(rebuttal => {
              const attacker = allAgentsList?.find(a => a.id === rebuttal.agentId);
              return (
                <motion.div 
                  key={rebuttal.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Gavel size={12} className="text-red-500" />
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: attacker?.color }}>
                      {attacker?.name || 'Unknown'} Rebuttal
                    </span>
                  </div>
                  <div className="text-zinc-400 italic">
                    <TypewriterText text={rebuttal.text} isTyping={rebuttal.isTyping} isExtractMode={isExtractMode} onExtractText={onExtractText} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Actions Row */}
        {!isTyping && roleId !== 'user' && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50 flex flex-col gap-2">
            <div className="flex items-center gap-4">
              {roleId !== 'synthesizer' && onDeepDive && !showDeepDiveInput && (
                <button 
                  onClick={() => setShowDeepDiveInput(true)}
                  className="text-xs font-mono uppercase tracking-widest flex items-center gap-1 hover:text-[#F4F4F0] transition-colors"
                  style={{ color: agent.color }}
                >
                  <Search size={14} />
                  Deep Dive
                </button>
              )}
              {onAppendToCanvas && (
                <button
                  onClick={() => onAppendToCanvas(id)}
                  className="hidden lg:flex text-xs font-mono uppercase tracking-widest items-center gap-1 text-zinc-500 hover:text-[#F4F4F0] transition-colors"
                >
                  <Plus size={14} />
                  Append
                </button>
              )}
              {onExtractToBuffer && (
                <button
                  onClick={() => {
                    onExtractToBuffer(id);
                    setIsFlashing(true);
                    setTimeout(() => setIsFlashing(false), 500);
                  }}
                  className="flex lg:hidden text-xs font-mono uppercase tracking-widest items-center gap-1 text-zinc-500 hover:text-[#005A9C] transition-colors"
                >
                  <Plus size={14} />
                  Extract
                </button>
              )}
            </div>
            {roleId !== 'synthesizer' && onDeepDive && showDeepDiveInput && (
              <form onSubmit={handleDeepDiveSubmit} className="flex flex-col gap-2 mt-2">
                <input 
                  type="text" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Enter concept..."
                  className="bg-black border border-zinc-800 text-[#F4F4F0] text-xs font-mono p-2 w-full focus:outline-none focus:border-zinc-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button 
                    type="submit"
                    disabled={!keyword.trim()}
                    className="flex-1 py-2 bg-[#F4F4F0] text-black text-xs font-mono font-bold uppercase disabled:opacity-50"
                  >
                    Dive
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowDeepDiveInput(false)}
                    className="flex-1 py-2 text-zinc-500 text-xs font-mono uppercase hover:text-[#F4F4F0] border border-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Nested Deep Dives */}
        {deepDives.length > 0 && (
          <div className="mt-4 space-y-4 pl-3 border-l border-zinc-800">
            <AnimatePresence>
              {deepDives.map((dd) => (
                <motion.div 
                  key={dd.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-black/40 p-3 border border-zinc-800/50"
                >
                  <div className="text-xs font-mono uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: agent.color }}>
                    <Search size={12} />
                    Diving into: <span className="text-[#F4F4F0]">"{dd.keyword}"</span>
                  </div>
                  <div className="font-mono text-sm leading-relaxed text-gray-400 markdown-body">
                    <TypewriterText text={dd.text} isTyping={dd.isTyping} />
                    {dd.isTyping && (
                      <span className="inline-block w-2 h-3 ml-1 bg-current animate-pulse align-middle" style={{ backgroundColor: agent.color }}></span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};
