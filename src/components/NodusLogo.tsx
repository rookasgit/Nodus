import React from 'react';

export const NodusLogo = ({ className = "w-8 h-8" }) => (
  <img 
    src="/nodus-logo.png" 
    alt="Nodus Logo" 
    // We combine your custom classes (size) with the blend mode needed for the dark UI
    className={`${className} object-contain mix-blend-screen`} 
  />
);