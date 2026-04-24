import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Sparkles, Paperclip, X, Plus } from 'lucide-react';

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // base64
}

interface ChatInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  onSuggest?: (text: string) => void;
  disabled: boolean;
  isSuggesting?: boolean;
  isNewsModeEnabled?: boolean;
  onToggleNewsMode?: () => void;
  appMode?: 'COUNCIL' | 'LAB';
  value?: string;
  onChange?: (value: string) => void;
  isExtractMode?: boolean;
  onToggleExtractMode?: () => void;
  isDesktopCanvasOpen?: boolean;
  onToggleDesktopCanvas?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, onSuggest, disabled, isSuggesting, isNewsModeEnabled, onToggleNewsMode, appMode, value, onChange, isExtractMode, onToggleExtractMode, isDesktopCanvasOpen, onToggleDesktopCanvas }) => {
  const [internalText, setInternalText] = useState('');
  const text = value !== undefined ? value : internalText;
  const setText = onChange || setInternalText;
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ... (keep existing useEffect)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((text.trim() || attachments.length > 0) && !disabled) {
      onSend(text.trim(), attachments);
      setText('');
      setAttachments([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments(prev => [...prev, {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const isNewsOn = appMode === 'LAB' || isNewsModeEnabled;
  const isNewsLocked = appMode === 'LAB';

  return (
    <div className="flex flex-col bg-black border-t border-zinc-800 p-4">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-full text-xs font-mono text-zinc-300">
              <span className="truncate max-w-[150px]">{att.name}</span>
              <button onClick={() => removeAttachment(i)} className="hover:text-[#F4F4F0]"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
         {onToggleNewsMode && (
            <button
              type="button"
              onClick={!isNewsLocked ? onToggleNewsMode : undefined}
              disabled={isNewsLocked}
              className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 border transition-all ${
                isNewsOn 
                  ? 'bg-[#BFFF00]/10 border-[#BFFF00] text-[#BFFF00] shadow-[0_0_10px_rgba(191,255,0,0.2)]' 
                  : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
              } ${isNewsLocked ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              [ NEWS MODE: {isNewsOn ? 'ON' : 'OFF'} ]
            </button>
         )}
         {onToggleExtractMode && (
           <button
             type="button"
             onClick={onToggleExtractMode}
             className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 border transition-all ${
               isExtractMode 
                 ? 'bg-[#F2A900]/10 border-[#F2A900] text-[#F2A900] shadow-[0_0_10px_rgba(242,169,0,0.2)]' 
                 : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
             }`}
           >
             [ EXTRACT MODE: {isExtractMode ? 'ON' : 'OFF'} ]
           </button>
         )}
         {onToggleDesktopCanvas && (
           <button
             type="button"
             onClick={onToggleDesktopCanvas}
             className={`hidden lg:block text-[10px] font-mono uppercase tracking-widest px-2 py-1 border transition-all ${
               isDesktopCanvasOpen 
                 ? 'bg-[#005A9C]/20 border-[#005A9C]/50 text-[#005A9C] hover:bg-[#005A9C]/30'
                 : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
             }`}
           >
             [ CANVAS: {isDesktopCanvasOpen ? 'OPEN' : 'CLOSED'} ]
           </button>
         )}
      </div>
      <form 
        onSubmit={handleSubmit}
        className="flex items-center gap-2"
      >
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            disabled={disabled}
            className="p-4 bg-zinc-900 text-zinc-400 hover:text-[#F4F4F0] hover:bg-zinc-800 disabled:opacity-50 transition-colors border border-zinc-700"
            title="More Options"
          >
            <Plus size={20} />
          </button>
          
          {isMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 bg-zinc-900 border border-zinc-700 flex flex-col shadow-xl min-w-[200px] z-50">
              <button 
                type="button" 
                onClick={() => { fileInputRef.current?.click(); setIsMenuOpen(false); }} 
                className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-800 text-sm text-left text-zinc-300 hover:text-[#F4F4F0] transition-colors"
              >
                <Paperclip size={16} /> Attach File
              </button>
              {onSuggest && (
                <button 
                  type="button" 
                  onClick={() => { onSuggest(text); setIsMenuOpen(false); }} 
                  disabled={isSuggesting || !text.trim()} 
                  className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-800 text-sm text-left text-zinc-300 hover:text-[#F4F4F0] transition-colors disabled:opacity-50"
                >
                  <Sparkles size={16} className={isSuggesting ? "animate-pulse" : ""} /> Summon Experts
                </button>
              )}
            </div>
          )}
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          multiple 
          accept=".pdf,.txt,.md,.csv,.json"
        />

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? "The Council is speaking..." : "Submit a topic, link, or attach a document..."}
          className="flex-1 bg-zinc-900 text-[#F4F4F0] font-mono text-sm p-4 rounded-none border border-zinc-700 focus:outline-none focus:border-[#F4F4F0] transition-colors disabled:opacity-50 min-w-0"
        />

        <button
          type="submit"
          disabled={disabled || (!text.trim() && attachments.length === 0)}
          className="p-4 bg-[#F4F4F0] text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors font-mono font-bold uppercase tracking-widest shrink-0"
        >
          <SendHorizontal size={20} />
        </button>
      </form>
    </div>
  );
};
