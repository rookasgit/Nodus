import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { CustomAgent, MODELS } from '../agents';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (agent: CustomAgent) => void;
}

const COLORS = ['#FF3333', '#33FF33', '#3333FF', '#FFFF33', '#FF33FF', '#33FFFF', '#FF9933', '#9933FF', '#FFFFFF'];

export const CustomAgentModal: React.FC<Props> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [model, setModel] = useState(MODELS[1].id);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleDeepResearch = async () => {
    if (!name.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Write a highly detailed, comprehensive system prompt (at least 3-4 paragraphs) for an AI persona acting as: ${name}. 
        The prompt must deeply analyze their worldview, core philosophy, analytical frameworks, typical vocabulary, and tone. 
        Include specific instructions on how they should structure their arguments and what biases or perspectives they should apply. 
        End the prompt by instructing the AI to keep responses concise, around 150-250 words.
        Output ONLY the system prompt text, nothing else.`,
      });
      if (response.text) {
        setInstruction(response.text);
      }
    } catch (error) {
      console.error("Failed to generate prompt", error);
    }
    setIsGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isGenerating) return;
    
    let finalInstruction = instruction.trim();
    
    if (!finalInstruction) {
      setIsGenerating(true);
      try {
        const response = await ai.models.generateContent({
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
        });
        finalInstruction = response.text || `You are ${name}. Provide your perspective on the topic. Keep it concise, around 150-250 words.`;
      } catch (error) {
        console.error("Failed to generate prompt", error);
        finalInstruction = `You are ${name}. Provide your perspective on the topic. Keep it concise, around 150-250 words.`;
      }
      setIsGenerating(false);
    }
    
    const id = `custom-${uuidv4()}`;
    const instructionWithJson = `${finalInstruction}\n\nCRITICAL INSTRUCTION: You must respond ONLY with a raw, valid JSON object. Do not include any pleasantries, markdown formatting, or conversational text outside the JSON. Use exactly these keys: {"full_analysis": "...", "provocation": "..."}.`;
    
    onAdd({
      id,
      thinkerId: id,
      name: name.trim(),
      color,
      systemInstruction: instructionWithJson,
      model
    });
    
    setName('');
    setInstruction('');
    setColor(COLORS[0]);
    setModel(MODELS[1].id);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col rounded-lg overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-zinc-800 shrink-0 bg-zinc-950">
          <h2 className="text-xl font-mono font-bold tracking-widest uppercase text-[#F4F4F0]">Add Custom Thinker</h2>
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
                placeholder="e.g., Carl Jung"
                className="w-full bg-black border border-zinc-800 text-[#F4F4F0] p-3 font-mono text-sm focus:outline-none focus:border-zinc-500"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500">System Instruction</label>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-zinc-600 hidden sm:inline">Leave empty to auto-generate</span>
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
              </div>
              <textarea 
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g., You are Carl Jung. Analyze the topic through the lens of the collective unconscious and archetypes. Keep it concise, around 100-150 words."
                className="w-full bg-black border border-zinc-800 text-[#F4F4F0] p-3 font-mono text-sm focus:outline-none focus:border-zinc-500 h-48 resize-none"
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

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">Aura Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'scale-110 border-[#F4F4F0]' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
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
              disabled={!name.trim() || isGenerating}
              className="px-6 py-2 bg-[#F4F4F0] text-black font-mono font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isGenerating ? <><Sparkles size={16} className="animate-pulse" /> Generating...</> : 'Add to Council'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
