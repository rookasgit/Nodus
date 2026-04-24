import React, { useState } from 'react';
import { NodusLogo } from './NodusLogo';
import { InfoModal } from './InfoModal'; // Make sure to import the new component!

export const EmptyState = ({ children }: { children?: React.ReactNode }) => {
  // Add state to track if the modal is open
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto px-6 text-center w-full relative">
        
        {/* System Info Button - Positioned like a tactical readout in the top right */}
        <div className="absolute top-0 right-0 md:top-4 md:right-4 mt-4 mr-4 z-10">
          <button 
            onClick={() => setIsInfoOpen(true)}
            className="text-zinc-600 hover:text-[#F4F4F0] font-mono text-[10px] md:text-xs uppercase tracking-widest transition-colors border border-zinc-800/50 hover:border-zinc-600 px-3 py-1.5"
          >
            [ System Info ]
          </button>
        </div>

        {/* 1. The Minimal Core */}
        <div className="flex flex-col items-center justify-center flex-1 w-full mt-12 md:mt-0">
          
          {/* Subtle, smaller logo - Now clickable with pointer cursor */}
          <div 
            className="mb-4 opacity-30 hover:opacity-100 grayscale hover:grayscale-0 transition-all duration-500 cursor-pointer"
            onClick={() => setIsInfoOpen(true)}
            title="View System Architecture"
          >
             <NodusLogo className="w-12 h-12 mx-auto" />
          </div>

          <h2 className="text-lg md:text-xl font-mono uppercase tracking-[0.2em] text-[#F4F4F0] mb-6 leading-relaxed">
            The Engine awaits your inquiry.<br/>
            <span className="text-zinc-600">Submit a topic to initiate the sequence.</span>
          </h2>

          {/* 2. The Task Force Action Area */}
          <div className="w-full max-w-sm mx-auto">
            {children}
          </div>
        </div>

        {/* 3. The Refined Bauhaus Footer (Quiet & Structural) */}
        <div className="w-full grid grid-cols-3 gap-4 md:gap-6 text-left border-t border-zinc-800/50 pt-4 pb-4 mt-auto">
          
          {/* Assemble (Quiet Blue Accent) */}
          <div className="border-t-2 border-[#005A9C]/30 pt-2">
            <span className="text-zinc-500 font-mono text-[10px] md:text-xs uppercase tracking-widest block mb-1">
              01 Assemble
            </span>
            <p className="text-zinc-600 text-[10px] leading-relaxed hidden md:block uppercase tracking-wider">
              Select a framework.
            </p>
          </div>
          
          {/* Inject (Quiet Red Accent) */}
          <div className="border-t-2 border-[#E03C31]/30 pt-2">
            <span className="text-zinc-500 font-mono text-[10px] md:text-xs uppercase tracking-widest block mb-1">
              02 Inject
            </span>
            <p className="text-zinc-600 text-[10px] leading-relaxed hidden md:block uppercase tracking-wider">
              Upload variables.
            </p>
          </div>
          
          {/* Synthesize (Quiet Yellow Accent) */}
          <div className="border-t-2 border-[#FFD100]/30 pt-2">
            <span className="text-zinc-500 font-mono text-[10px] md:text-xs uppercase tracking-widest block mb-1">
              03 Synthesize
            </span>
            <p className="text-zinc-600 text-[10px] leading-relaxed hidden md:block uppercase tracking-wider">
              Extract absolute truth.
            </p>
          </div>

        </div>

      </div>

      {/* 4. The Modal Component injected into the DOM layer */}
      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </>
  );
};