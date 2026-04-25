import React, { useState } from 'react';
import { Download, FileCode, Copy, Image, Check, Shield } from 'lucide-react';

export const ExportArtifactBlock = ({ 
  conversation, 
  onExport, 
  onExportHTML,
  onCopyText,
  onExportCanvas 
}: { 
  conversation: any, 
  onExport: () => void, 
  onExportHTML: () => void,
  onCopyText: () => void,
  onExportCanvas: () => void 
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyText();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const btnClass = "flex items-center gap-2 px-4 py-2 bg-black border border-zinc-800 text-zinc-400 hover:text-[#FFD100] hover:border-[#FFD100]/50 font-mono text-[10px] font-black uppercase tracking-widest transition-all shadow-[4px_4px_0px_#141414] hover:shadow-[2px_2px_0px_#FFD100] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none min-w-[120px] justify-center";

  return (
    <div className="mt-8 border-2 border-zinc-800 bg-zinc-950 p-6 relative overflow-hidden">
      {/* Decorative Corner Accents */}
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#FFD100] opacity-30" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-[#FFD100] font-mono text-xs font-black uppercase tracking-[0.3em]">
            <Shield size={14} className="animate-pulse" />
            Synthesized Intelligence Ready
          </div>
          <p className="text-zinc-500 text-[9px] font-mono uppercase tracking-[0.2em]">
            Strategic archives prepared for extraction.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={onExport} className={btnClass}>
            <Download size={14} />
            Full .MD
          </button>

          <button onClick={onExportCanvas} className={btnClass}>
            <Image size={14} />
            Canvas .MD
          </button>

          <button onClick={onExportHTML} className={btnClass}>
            <FileCode size={14} />
            Rich .HTML
          </button>

          <button 
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 bg-black border font-mono text-[10px] font-black uppercase tracking-widest transition-all shadow-[4px_4px_0px_#141414] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none min-w-[120px] justify-center ${
              copied 
              ? 'text-green-500 border-green-500/50 shadow-[2px_2px_0px_rgba(34,197,94,0.3)]' 
              : 'text-zinc-400 border-zinc-800 hover:text-[#FFD100] hover:border-[#FFD100]/50 hover:shadow-[2px_2px_0px_#FFD100]'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Text'}
          </button>
        </div>
      </div>
    </div>
  );
};
