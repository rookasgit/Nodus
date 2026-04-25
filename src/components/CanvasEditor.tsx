import React, { useRef, useEffect, useState } from 'react';
import { Loader2, AlertTriangle, Check, X, Edit3 } from 'lucide-react';

export interface MarginNote {
  id: string;
  quote: string;
  comment: string;
  agent: string;
  suggestion?: string;
  status?: 'active' | 'dismissed' | 'integrated';
  integratedText?: string;
}

interface CanvasEditorProps {
  text: string;
  onChange: (text: string) => void;
  onSelection: () => void;
  notes: MarginNote[];
  isReviewing: boolean;
  onRequestReview: () => void;
  onUpdateNote?: (noteId: string, updates: Partial<MarginNote>) => void;
  theme?: 'light' | 'dark';
}

// Substring fuzzy matching logic
const findBestMatch = (text: string, quote: string) => {
  // 1. Exact match
  let start = text.indexOf(quote);
  if (start !== -1) {
    return { start, end: start + quote.length, match: quote };
  }

  // 2. Whitespace & punctuation agnostic match
  const sanitize = (s: string) => (s || '').replace(/[\s\W_]+/g, '').toLowerCase();
  const sanitizedQuote = sanitize(quote);
  if (!sanitizedQuote) return null;

  // Let's create a regex that allows optional space/punctuation between any char
  const regexStr = sanitizedQuote.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\W_]*');
  try {
    const regex = new RegExp(regexStr, 'i');
    const m = text.match(regex);
    if (m && m.index !== undefined) {
       // if the match is unreasonably large compared to quote (e.g. over 2x length), it might be a false positive across paragraphs
       if (m[0].length <= quote.length * 2.5) {
         return { start: m.index, end: m.index + m[0].length, match: m[0] };
       }
    }
  } catch (e) {
    // regex compilation failed
  }

  return null;
};

const MarginNoteItem = ({ 
  note, 
  text, 
  onUpdateNote, 
  onReplaceText, 
  theme 
}: { 
  note: MarginNote, 
  text: string, 
  onUpdateNote?: (noteId: string, updates: Partial<MarginNote>) => void, 
  onReplaceText: (oldText: string | null, newText: string) => void, 
  theme: 'light' | 'dark' 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(note.suggestion || note.quote);

  const isDark = theme === 'dark';
  const noteBg = isDark ? 'bg-zinc-900' : 'bg-white';
  const noteBorder = isDark ? 'border-zinc-700' : 'border-black';
  const noteText = isDark ? 'text-zinc-300' : 'text-black';
  const noteAgentBg = isDark ? 'bg-zinc-800' : 'bg-black';
  const noteAgentText = isDark ? 'text-zinc-300' : 'text-white';
  const noteQuoteText = isDark ? 'text-zinc-400' : 'text-zinc-600';

  const matchResult = findBestMatch(text, note.quote);
  const isMissing = !matchResult;
  const isDismissedOrIntegrated = note.status === 'dismissed' || note.status === 'integrated';

  let opacityClass = 'opacity-100';
  if (isDismissedOrIntegrated) opacityClass = 'opacity-50';

  const handleIntegrate = () => {
    if (matchResult && onReplaceText) {
      onReplaceText(matchResult.match, editedText);
    } else {
      // Just append or replace loosely
      onReplaceText(null, editedText);
    }
    if (onUpdateNote) onUpdateNote(note.id, { status: 'integrated', integratedText: editedText });
    setIsEditing(false);
  };

  return (
    <div className={`${noteBg} border-2 ${noteBorder} p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2 ${opacityClass} transition-opacity`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${noteAgentBg} ${noteAgentText} px-1.5 py-0.5`}>
          {note.agent}
        </span>
        <div className="flex gap-1">
           {isMissing && !isDismissedOrIntegrated && (
             <span className="text-[10px] text-red-500 flex items-center gap-1" title="Reference text changed">
               <AlertTriangle size={12} /> Changed
             </span>
           )}
           {!isDismissedOrIntegrated && onUpdateNote && (
            <>
              <button onClick={() => setIsEditing(!isEditing)} className="text-zinc-500 hover:text-[#005A9C] p-1" title="Integrate Rewrite">
                <Edit3 size={14} />
              </button>
              <button onClick={() => onUpdateNote(note.id, { status: 'dismissed' })} className="text-zinc-500 hover:text-[#E03C31] p-1" title="Dismiss">
                <X size={14} />
              </button>
            </>
           )}
        </div>
      </div>

      <div className={`text-xs font-serif italic ${noteQuoteText} border-l-2 border-yellow-400 pl-2 py-0.5`}>
        "{note.quote}"
      </div>
      <div className={`text-sm font-sans font-medium ${noteText} leading-snug`}>
        {note.comment}
      </div>

      {isEditing && (
        <div className="mt-2 flex flex-col gap-2">
           <textarea
             className="w-full text-xs font-serif p-2 bg-transparent border border-dashed border-zinc-500 focus:outline-none"
             value={editedText}
             onChange={e => setEditedText(e.target.value)}
             rows={3}
           />
           <button onClick={handleIntegrate} className="text-[10px] font-mono bg-[#005A9C] text-white py-1 px-2 uppercase hover:bg-blue-700">
             Replace text in Canvas
           </button>
        </div>
      )}
    </div>
  );
};

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  text,
  onChange,
  onSelection,
  notes,
  isReviewing,
  onRequestReview,
  onUpdateNote,
  theme = 'light'
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Function to highlight text in the backdrop
  const renderHighlightedText = () => {
    if (!notes || notes.length === 0) return text;

    let result: React.ReactNode[] = [text];

    notes.forEach((note) => {
      // Don't highlight dismissed notes
      if (note.status === 'dismissed' || note.status === 'integrated') return;

      const newResult: React.ReactNode[] = [];
      result.forEach((part, index) => {
        if (typeof part === 'string') {
          const matchResult = findBestMatch(part, note.quote);
          if (matchResult) {
            const before = part.substring(0, matchResult.start);
            const matchText = part.substring(matchResult.start, matchResult.end);
            const after = part.substring(matchResult.end);
            
            if (before) newResult.push(before);
            newResult.push(
              <mark key={`${note.id}-${index}`} className="bg-yellow-300/50 text-transparent rounded-sm border-b-2 border-yellow-400">
                {matchText}
              </mark>
            );
            if (after) newResult.push(after);
          } else {
            newResult.push(part);
          }
        } else {
          newResult.push(part);
        }
      });
      result = newResult;
    });

    return result;
  };

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-[#09090b]' : 'bg-[#F4F4F0]';
  const textClass = isDark ? 'text-[#F4F4F0]' : 'text-black';
  const borderClass = isDark ? 'border-zinc-800' : 'border-zinc-300';
  const sidebarBg = isDark ? 'bg-zinc-950' : 'bg-zinc-50';
  const noteBg = isDark ? 'bg-zinc-900' : 'bg-white';
  const noteBorder = isDark ? 'border-zinc-700' : 'border-black';
  const noteText = isDark ? 'text-zinc-300' : 'text-black';
  const noteAgentBg = isDark ? 'bg-zinc-800' : 'bg-black';
  const noteAgentText = isDark ? 'text-zinc-300' : 'text-white';
  const noteQuoteText = isDark ? 'text-zinc-400' : 'text-zinc-600';

  return (
    <div className={`flex flex-col h-full w-full ${bgClass} ${textClass} relative`} data-canvas-container>
      {/* Header */}
      <div className={`p-4 border-b ${borderClass} flex justify-between items-center ${bgClass} shrink-0`}>
        <h2 className="font-mono font-bold uppercase tracking-widest text-sm">Canvas</h2>
        <button
          onClick={onRequestReview}
          disabled={isReviewing || !text.trim()}
          className="px-3 py-1.5 bg-[#E03C31] text-white text-[10px] font-mono font-bold uppercase tracking-widest rounded hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          {isReviewing && <Loader2 size={12} className="animate-spin" />}
          Task Force Review
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Container */}
        <div className="flex-1 relative overflow-hidden bg-transparent">
          {/* Backdrop for highlights */}
          <div 
            ref={backdropRef}
            className="absolute inset-0 p-4 font-sans text-sm leading-normal whitespace-pre-wrap break-words pointer-events-none text-transparent overflow-hidden"
            aria-hidden="true"
          >
            {renderHighlightedText()}
            {/* Add extra space at the bottom to match textarea scrolling behavior */}
            <br />
          </div>
          
          {/* Actual Textarea */}
          <textarea
            ref={textareaRef}
            className={`absolute inset-0 p-4 bg-transparent resize-none outline-none font-sans text-sm leading-normal ${textClass} z-10`}
            placeholder="Draft your final report here..."
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onMouseUp={onSelection}
            onKeyUp={onSelection}
            onScroll={handleScroll}
            spellCheck={false}
          />
        </div>

        {/* Desktop Sidebar for Notes */}
        {notes.length > 0 && (
          <div className={`hidden md:flex w-64 lg:w-72 border-l ${borderClass} ${sidebarBg} flex-col overflow-y-auto p-4 gap-4 shrink-0 shadow-inner`}>
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Margin Notes</h3>
            {notes.map((note) => (
              <MarginNoteItem 
                 key={note.id} 
                 note={note} 
                 text={text} 
                 theme={theme}
                 onUpdateNote={onUpdateNote}
                 onReplaceText={(oldText, newText) => {
                    if (oldText) {
                      onChange(text.replace(oldText, newText));
                    } else {
                      onChange(text + '\n\n' + newText);
                    }
                 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile Notes List */}
      {notes.length > 0 && (
        <div className={`md:hidden border-t ${borderClass} ${sidebarBg} p-4 overflow-y-auto max-h-64 flex flex-col gap-4`}>
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Margin Notes</h3>
          {notes.map((note) => (
              <MarginNoteItem 
                 key={note.id} 
                 note={note} 
                 text={text} 
                 theme={theme}
                 onUpdateNote={onUpdateNote}
                 onReplaceText={(oldText, newText) => {
                    if (oldText) {
                      onChange(text.replace(oldText, newText));
                    } else {
                      onChange(text + '\n\n' + newText);
                    }
                 }}
              />
          ))}
        </div>
      )}
    </div>
  );
};
