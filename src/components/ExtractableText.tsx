import React from 'react';
import Markdown from 'react-markdown';

interface ExtractableTextProps {
  text: string;
  isExtractMode?: boolean;
  onExtract?: (text: string) => void;
}

export const ExtractableText: React.FC<ExtractableTextProps> = ({ text, isExtractMode, onExtract }) => {
  if (!isExtractMode) {
    return <Markdown>{text}</Markdown>;
  }

  // Split text into an array of sentences
  const fragments = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
  
  return (
    <div>
      {fragments.map((fragment, idx) => (
        <span 
          key={idx} 
          onClick={() => isExtractMode && onExtract && onExtract(fragment.trim())}
          className={`${isExtractMode ? 'cursor-pointer hover:bg-[#005A9C]/30 hover:text-white transition-colors border-b border-transparent hover:border-[#005A9C]' : ''}`}
        >
          {fragment}{" "}
        </span>
      ))}
    </div>
  );
};
