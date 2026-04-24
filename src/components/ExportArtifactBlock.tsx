import React from 'react';
import { Download } from 'lucide-react';

export const ExportArtifactBlock = ({ conversation, onExport, onExportCanvas }: { conversation: any, onExport: () => void, onExportCanvas: () => void }) => {
  return (
    <div className="mt-8 border-t-2 border-[#FFD100]/30 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-zinc-500 font-mono text-xs uppercase tracking-widest">
        <div className="w-2 h-2 bg-[#FFD100]"></div>
        Synthesis Complete.
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={onExport}
          className="flex items-center justify-center gap-2 px-3 py-1.5 bg-black text-zinc-400 border border-zinc-700 hover:text-[#FFD100] hover:border-[#FFD100]/50 font-mono text-xs uppercase tracking-widest transition-all group shrink-0"
        >
          <Download size={14} className="group-hover:-translate-y-0.5 transition-transform" />
          Export All
        </button>
        
        <button 
          onClick={onExportCanvas}
          className="flex items-center justify-center gap-2 px-3 py-1.5 bg-[#FFD100]/10 text-[#FFD100] border border-[#FFD100]/50 hover:bg-[#FFD100] hover:text-[#09090b] font-black font-mono text-xs uppercase tracking-widest transition-all group shrink-0"
        >
          <Download size={14} className="group-hover:-translate-y-0.5 transition-transform" />
          Export Canvas
        </button>
      </div>
    </div>
  );
};
