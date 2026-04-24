import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { ROLES, LAB_ROLES, MODELS, UserSettings, CustomAgent, getActiveAgent } from '../agents';
import { getAI, withRetry } from '../lib/gemini';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  agentId: string | null;
  roleSettings: UserSettings;
  customAgents: CustomAgent[];
  onUpdateRole: (roleId: string, settings: any) => void;
  onUpdateCustomAgent: (agent: CustomAgent) => void;
  appMode: 'COUNCIL' | 'LAB';
}

export const EditPersonaModal: React.FC<Props> = ({ isOpen, onClose, agentId, roleSettings, customAgents, onUpdateRole, onUpdateCustomAgent, appMode }) => {
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    
    if (agentId.startsWith('custom-')) {
      const ca = customAgents.find(a => a.id === agentId);
      if (ca) {
        setName(ca.name);
        setInstruction(ca.systemInstruction);
        setModel(ca.model || MODELS[1].id);
        setColor(ca.color);
      }
    } else if (agentId === 'synthesizer') {
      const agent = getActiveAgent('synthesizer', roleSettings);
      setName(agent.name);
      setInstruction(agent.systemInstruction);
      setModel(agent.model || MODELS[2].id); // Default to Pro 3.1 for Synthesizer
      setColor(agent.color);
    } else {
      const currentRoles = appMode === 'LAB' ? LAB_ROLES : ROLES;
      const role = currentRoles.find(r => r.id === agentId);
      if (role) {
        const agent = getActiveAgent(agentId, roleSettings, appMode);
        setName(agent.name);
        setInstruction(agent.systemInstruction);
        setModel(agent.model || MODELS[1].id);
        setColor(agent.color);
      }
    }
  }, [agentId, roleSettings, customAgents, isOpen]);

  if (!isOpen || !agentId) return null;

  const isCustom = agentId.startsWith('custom-');

  const handleDeepResearch = async () => {
    if (!name.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const response = await withRetry(() => getAI().models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Generate a system prompt for an AI persona acting as: ${name}.
        Use the following "Authentic Intellectual Architecture Template" to structure the prompt. Fill in the bracketed sections with deep research about ${name}.
        
        [TEMPLATE START]
        System Directive:
        You are to embody the authentic intellectual framework, philosophy, and analytical methodology of ${name}. You will not act as a generic AI playing a character, nor will you rely on exaggerated stereotypes. Every response you generate must be rigorously filtered through ${name}'s actual published works, philosophical systems, and historical worldview.

        1. Core Epistemology & Ontology
        • The Primary Thesis: You fundamentally believe that reality and human history are driven by [Core driving force].
        • View of Human Agency: In your framework, individual human choices are [How they view free will vs. systems].
        • Historical Methodology: When examining a current event, you always analyze it through [Their specific method].

        2. The Analytical Lens
        • The First Question: When presented with any topic, the very first question you internally ask yourself is: "[Their defining analytical question]"
        • Primary Intellectual Targets: You frequently aim your critiques at [Specific ideologies/groups they critique].
        • Treatment of Opposing Views: When encountering an opposing worldview, your default approach is to [How they argue].

        3. Dialectical & Rhetorical Style
        • Argumentative Structure: You build your answers by [Their structural hallmark].
        • Authentic Lexicon: You rely heavily on your specific, defined terminology. When relevant, you accurately utilize concepts such as:
          • [Concept 1 + Definition]
          • [Concept 2 + Definition]
          • [Concept 3 + Definition]
        • Tone & Delivery: Your authentic speaking/writing voice is strictly [Tone description].

        4. Contextual Boundaries & Blind Spots
        • Historical Anchor: Your worldview is fundamentally anchored by your experience of [Specific historical context].
        • Intentional Limitations: To maintain authenticity, you do not possess deep modern expertise outside your field. If asked about subjects you wouldn't care about, you will either ignore it or relate it back entirely to [Their primary obsession].

        5. AI Guardrails & Anti-Caricature Constraints
        • NEVER use standard AI phrasing (e.g., "It's important to consider," "In conclusion," "As an AI").
        • NEVER exaggerate your traits.
        • ALWAYS maintain the intellectual rigor of ${name}'s actual bibliography.
        • Keep responses concise, around 150-250 words.
        [TEMPLATE END]

        Output ONLY the filled-out system prompt text, nothing else.`,
      }));
      if (response.text) {
        setInstruction(response.text);
      }
    } catch (error) {
      console.error("Failed to generate prompt", error);
    }
    setIsGenerating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCustom) {
      onUpdateCustomAgent({
        id: agentId,
        thinkerId: agentId,
        name,
        systemInstruction: instruction,
        model,
        color
      });
    } else {
      onUpdateRole(agentId, {
        ...(roleSettings[agentId] || {}),
        customInstruction: instruction,
        model
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-zinc-800 shrink-0 bg-zinc-950">
          <h2 className="text-xl font-mono font-bold tracking-widest uppercase text-[#F4F4F0]">Edit Persona</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-[#F4F4F0] transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden h-full">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isCustom}
                className="w-full bg-black border border-zinc-800 text-[#F4F4F0] p-3 font-mono text-sm focus:outline-none focus:border-zinc-500 disabled:opacity-50"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500">System Instruction</label>
                <button 
                  type="button"
                  onClick={handleDeepResearch}
                  disabled={isGenerating || !name.trim()}
                  className="text-[10px] font-mono text-zinc-400 hover:text-[#F4F4F0] flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Sparkles size={10} className={isGenerating ? "animate-pulse" : ""} /> 
                  {isGenerating ? 'Researching...' : 'Deep Research Prompt'}
                </button>
              </div>
              <textarea 
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                className="w-full bg-black border border-zinc-800 text-[#F4F4F0] p-3 font-mono text-sm focus:outline-none focus:border-zinc-500 h-64 resize-none"
                required
                disabled={isGenerating}
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-black border border-zinc-800 text-[#F4F4F0] p-3 font-mono text-sm focus:outline-none focus:border-zinc-500"
              >
                {MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-6 border-t border-zinc-800 flex justify-end gap-4 shrink-0 bg-zinc-950">
            <button 
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-zinc-500 hover:text-[#F4F4F0] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isGenerating}
              className="px-6 py-2 bg-[#F4F4F0] text-black font-mono font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
