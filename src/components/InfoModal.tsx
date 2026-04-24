import React from 'react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      
      {/* Darkened/Blurred Backdrop */}
      <div 
        className="absolute inset-0 bg-[#09090b]/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* The Brutalist Modal Window */}
      <div className="relative w-full max-w-2xl bg-[#09090b] border border-zinc-800 shadow-2xl flex flex-col max-h-full">
        
        {/* Bauhaus Top Bar */}
        <div className="flex w-full h-1 shrink-0">
          <div className="w-1/3 bg-[#005A9C]"></div>
          <div className="w-1/3 bg-[#E03C31]"></div>
          <div className="w-1/3 bg-[#FFD100]"></div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-zinc-800/50 shrink-0">
          <h2 className="text-[#F4F4F0] font-black uppercase tracking-tighter text-xl leading-none">
            System Architecture
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-[#E03C31] font-mono text-sm uppercase tracking-widest transition-colors"
          >
            [ Close ]
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 md:p-6 overflow-y-auto font-mono text-xs md:text-sm text-zinc-400 space-y-6">
          
          <section>
            <h3 className="text-[#005A9C] font-bold uppercase tracking-widest mb-2">01. The Objective</h3>
            <p className="leading-relaxed">
              <strong className="text-[#F4F4F0]">NODUS</strong> is a Strategic Dialectic Engine designed to dismantle complex dilemmas. It rejects single-threaded AI responses in favor of multi-agent wargaming, forcing distinct, often hostile, philosophical frameworks to collide.
            </p>
          </section>

          <section>
            <h3 className="text-[#E03C31] font-bold uppercase tracking-widest mb-2">02. The Methodology</h3>
            <p className="leading-relaxed">
              The engine operates on the Hegelian dialectic (Thesis + Antithesis = Synthesis). When a variable is injected into the nexus, it is simultaneously processed by a specialized Task Force. Machiavellian realism clashes with existential theory. Cold logic fights raw creativity. 
            </p>
            <p className="leading-relaxed mt-2">
              This engineered friction strips away bias, platitudes, and weak assumptions.
            </p>
          </section>

          <section>
            <h3 className="text-[#FFD100] font-bold uppercase tracking-widest mb-2">03. The Output</h3>
            <p className="leading-relaxed">
              The debate is not the final product; it is the refining process. Once the perimeter of the problem is established, the overarching <strong className="text-[#F4F4F0]">Synthesizer</strong> forcefully distills the chaos into an absolute, actionable executive brief.
            </p>
          </section>

        </div>
        
      </div>
    </div>
  );
};