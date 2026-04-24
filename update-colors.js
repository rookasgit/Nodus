const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/App.tsx',
  'src/components/ChatMessage.tsx',
  'src/components/ChatInput.tsx',
  'src/components/TaskForceGrid.tsx',
  'src/components/BranchModal.tsx',
  'src/components/CustomAgentModal.tsx',
  'src/components/SettingsModal.tsx',
  'src/components/EditPersonaModal.tsx'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace text-white with text-[#F4F4F0]
    content = content.replace(/text-white/g, 'text-[#F4F4F0]');
    
    // Replace bg-white with bg-[#F4F4F0]
    content = content.replace(/bg-white/g, 'bg-[#F4F4F0]');
    
    // Replace border-white with border-[#F4F4F0]
    content = content.replace(/border-white/g, 'border-[#F4F4F0]');
    
    // Replace specific button classes
    // Conflict
    content = content.replace(/border-red-500\/50 text-red-400 hover:bg-red-950\/30/g, 'border-[#E03C31]/50 text-[#E03C31] hover:bg-[#E03C31]/10');
    // Consensus
    content = content.replace(/border-emerald-500\/50 text-emerald-400 hover:bg-emerald-950\/30/g, 'border-[#005A9C]/50 text-[#005A9C] hover:bg-[#005A9C]/10');
    // Executive
    content = content.replace(/border-cyan-500\/50 text-cyan-400 hover:bg-cyan-950\/30/g, 'border-[#FFD100]/50 text-[#FFD100] hover:bg-[#FFD100]/10');
    
    // If there were fuchsia ones
    content = content.replace(/border-fuchsia-800/g, 'border-[#E03C31]/50');
    content = content.replace(/text-fuchsia-400/g, 'text-[#E03C31]');
    content = content.replace(/bg-fuchsia-900\/20/g, 'bg-[#E03C31]/10');
    
    // If there were emerald ones
    content = content.replace(/border-emerald-800/g, 'border-[#005A9C]/50');
    content = content.replace(/text-emerald-400/g, 'text-[#005A9C]');
    content = content.replace(/bg-emerald-900\/20/g, 'bg-[#005A9C]/10');
    
    // If there were cyan ones
    content = content.replace(/border-cyan-800/g, 'border-[#FFD100]/50');
    content = content.replace(/text-cyan-400/g, 'text-[#FFD100]');
    content = content.replace(/bg-cyan-900\/20/g, 'bg-[#FFD100]/10');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
