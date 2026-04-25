import React from 'react';
import Markdown from 'react-markdown';

interface ExtractableTextProps {
  text: string;
  isExtractMode?: boolean;
  onExtract?: (text: string) => void;
}

export const ExtractableText: React.FC<ExtractableTextProps> = ({ text, isExtractMode, onExtract }) => {
  const handleClick = (e: React.MouseEvent) => {
    if (!isExtractMode || !onExtract) return;
    
    const target = e.target as HTMLElement;
    // Extract from common markdown block elements
    const blockElement = target.closest('p, li, h1, h2, h3, h4, h5, h6, blockquote');
    
    if (blockElement) {
      e.stopPropagation();
      let extractedText = (blockElement as HTMLElement).innerText || blockElement.textContent || '';
      
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        extractedText = selection.toString();
      }
      
      if (extractedText.trim()) {
        onExtract(extractedText.trim());
      }
    }
  };

  if (!isExtractMode) {
    return <Markdown>{text}</Markdown>;
  }

  return (
    <div 
      onClick={handleClick}
      className="[&_p]:cursor-pointer [&_p]:hover:bg-[#005A9C]/30 [&_p]:hover:text-[#F4F4F0] [&_p]:transition-colors [&_p]:rounded [&_p]:px-1 [&_p]:-mx-1 [&_li]:cursor-pointer [&_li]:hover:bg-[#005A9C]/30 [&_li]:hover:text-[#F4F4F0] [&_li]:transition-colors [&_li]:rounded [&_li]:px-1 [&_li]:-mx-1"
    >
      <Markdown>{text}</Markdown>
    </div>
  );
};
