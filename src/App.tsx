import React, { useState, useEffect, useRef } from 'react';

import { v4 as uuidv4 } from 'uuid';
import { ROLES, LAB_ROLES, SYNTHESIZER, getActiveAgent, UserSettings, DEFAULT_SETTINGS, CustomAgent } from './agents';
import { TASK_FORCES, TaskForce } from './taskForces';
import { ChatMessage, DeepDive } from './components/ChatMessage';
import { ChatInput, Attachment } from './components/ChatInput';
import { SettingsModal } from './components/SettingsModal';
import { CustomAgentModal } from './components/CustomAgentModal';
import { EditPersonaModal } from './components/EditPersonaModal';
import { TaskForceGrid } from './components/TaskForceGrid';
import { BranchModal } from './components/BranchModal';
import { EmptyState } from './components/EmptyState';
import { ExportArtifactBlock } from './components/ExportArtifactBlock';
import { CanvasEditor, MarginNote } from './components/CanvasEditor';
import { GoogleGenAI, Type } from '@google/genai';
import { getAI, withRetry, calculateQueryCost, fetchLiveContext } from './lib/gemini';
import { extractPartialField, parseAgentResponse, parseSynthesizerResponse } from './lib/streamExtractor';
import { resilientJSONParse } from './utils/jsonParser';
import { SessionManager, SessionRetrospective } from './lib/sessionManager';
import { RetrospectiveModal } from './components/RetrospectiveModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Download, Settings, Menu, Plus, UserPlus, Users, X, Settings2, RefreshCw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Grid, AlertTriangle, Globe, GitBranch, Star, Check } from 'lucide-react';
import { NodusLogo } from './components/NodusLogo';

declare global {
  interface Window {
    aistudio?: {
      openSelectKey: () => Promise<void>;
      hasSelectedApiKey: () => Promise<boolean>;
    };
  }
}

interface FactCheck {
  status: 'verifying' | 'verified' | 'warning' | 'error' | 'interpretation';
  text?: string;
  sources?: { title: string, url: string }[];
}

interface Message {
  id: string;
  roleId: string;
  text: string;
  isTyping?: boolean;
  deepDives?: DeepDive[];
  attachments?: Attachment[];
  factCheck?: FactCheck;
  isDebate?: boolean;
  synthesizerData?: any;
  fullAnalysis?: string;
  tokenCount?: number;
  imageUrl?: string;
  rebuttals?: {
    id: string;
    agentId: string;
    text: string;
    isTyping: boolean;
  }[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  customAgents: CustomAgent[];
  activeAgentIds: string[];
  roleSettings?: UserSettings;
  agentOrder?: string[];
  taskForcePurpose?: string;
  taskForceName?: string;
  customTaskForces?: TaskForce[];
  mode?: 'COUNCIL' | 'LAB';
  parentId?: string;
  branchConcept?: string;
  canvasText?: string;
  marginNotes?: MarginNote[];
  artifactBuffer?: string[];
  debateFormat?: 'OPEN' | 'OXFORD' | 'SOCRATIC';
  pushbackLevel?: 'COLLABORATIVE' | 'BALANCED' | 'DEVILS_ADVOCATE';
  retrospective?: SessionRetrospective;
}

const STORAGE_KEY = 'the-council-conversations';
const SETTINGS_KEY = 'the-council-settings';

const DEBATE_FORMAT_RULES: Record<string, string> = {
  'OPEN': 'Open Debate: Each agent provides their perspective independently.',
  'OXFORD': 'Oxford-Style: Agents must structure their response analytically, consisting of a clear Opening thesis, a preemptive Rebuttal of opposition, and a strong Closing statement.',
  'SOCRATIC': 'Socratic Questioning: Agents must act as Socratic questioners. Instead of providing declarative answers, they must ask a series of probing, foundational questions targeting the assumptions in the input.'
};

const DEBATE_PUSHBACK_RULES: Record<string, string> = {
  'COLLABORATIVE': 'Pushback Level: Collaborative Synthesis. Agents should seek common ground, emphasize constructive building, and minimize toxic adversariality.',
  'BALANCED': 'Pushback Level: Balanced. Agents should maintain their persona, disagreeing where natural but remaining objective.',
  'DEVILS_ADVOCATE': 'Pushback Level: Devil\'s Advocate (Highly Adversarial). Agents must relentlessly attack the weakest points of the premise, showing no mercy and strictly avoiding premature consensus.'
};

const getDebateRulesStr = (conv: Conversation | null, mode: string | undefined): string => {
  if (mode !== 'COUNCIL') return '';
  return `DEBATE CONFIGURATION:
${DEBATE_FORMAT_RULES[conv?.debateFormat || 'OPEN']}
${DEBATE_PUSHBACK_RULES[conv?.pushbackLevel || 'BALANCED']}\n\n`;
};

const INFOGRAPHIC_ARCHITECT_PROMPT = `
You are an expert AI Prompt Architect specializing in Brutalist and Bauhaus data visualization.

INPUT DATA (Synthesizer Report):
"[SYNTHESIZER_TEXT]"

YOUR TASK:
Analyze the Input Data. Extract the 4-5 most critical, distinct, and high-impact conclusions. Populate the following template. Do not change the aesthetic instructions. Ensure text is concise and fitting for a "War Room" dashboard.

TEMPLATE TO POPULATE:
"A massive, high-order conclusion infographic poster designed with a strict Bauhaus and Brutalist aesthetic. Background: Charcoal Black (#09090b). Layout: Uncompromising geometric grid, sharp edges, solid blocks of neon cyan, industrial yellow, and stark white. No gradients. 

Exact text rendering required (Sans-Serif, Bold):
- Top Left: 'SYNTHESIS TOPOLOGY: [POSTER_TITLE]'
- Panel 1 (Top-Left): Headline '[HEADLINE_1]'. Diagram showing [DATA_1A] vs [DATA_1B].
- Panel 2 (Top-Right): Headline '[HEADLINE_2]'. Radar chart comparing [POLYGON_A] vs [POLYGON_B].
- Panel 3 (Middle): Headline '[HEADLINE_3]'. Feedback loop: [STEP_A] -> [STEP_B] -> [STEP_C].
- Panel 4 (Bottom): Headline '[HEADLINE_4]'. Risk matrix cells: [CELL_A] and [CELL_B].
- Footer: '4K RESOLUTION / SYSTEM STATUS: ONLINE'

The overall effect: A clinical, industrial executive briefing."

OUTPUT: Return ONLY the finalized, fully populated image prompt.
`;

export default function App() {
  const [appMode, setAppMode] = useState<'COUNCIL' | 'LAB'>('COUNCIL');
  const currentRoles = appMode === 'LAB' ? LAB_ROLES : ROLES;
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [canvasWidth, setCanvasWidth] = useState(33);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isCustomAgentModalOpen, setIsCustomAgentModalOpen] = useState(false);
  const [isTaskForceGridOpen, setIsTaskForceGridOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [isExtractMode, setIsExtractMode] = useState(false);
  const [isNewsModeEnabled, setIsNewsModeEnabled] = useState(false);
  const [sessionTokens, setSessionTokens] = useState({ agentInput: 0, agentOutput: 0, synthInput: 0, synthOutput: 0 });
  const [pendingInfographicPrompt, setPendingInfographicPrompt] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [canvasText, setCanvasText] = useState('');
  const [isDesktopCanvasOpen, setIsDesktopCanvasOpen] = useState(true);
  const [artifactBuffer, setArtifactBuffer] = useState<string[]>([]);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [chatInputValue, setChatInputValue] = useState('');
  const [showCanvasTooltip, setShowCanvasTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedCanvasText, setSelectedCanvasText] = useState('');
  const [showExtractTooltip, setShowExtractTooltip] = useState(false);
  const [selectedExtractText, setSelectedExtractText] = useState('');
  const [extractTooltipPos, setExtractTooltipPos] = useState({ x: 0, y: 0 });
  const [lastExtractedBlockId, setLastExtractedBlockId] = useState<string | null>(null);
  const [marginNotes, setMarginNotes] = useState<MarginNote[]>([]);
  const [isReviewingCanvas, setIsReviewingCanvas] = useState(false);
  const [isRetrospectiveModalOpen, setIsRetrospectiveModalOpen] = useState(false);
  
  useEffect(() => {
    const runDiagnostics = () => {
      console.group('--- ENVIRONMENT DIAGNOSTICS ---');
      try {
        const testBlob = new Blob(['test'], { type: 'text/plain' });
        const testUrl = URL.createObjectURL(testBlob);
        URL.revokeObjectURL(testUrl);
      } catch (e) {
        console.error('Object URL creation blocked:', e);
      }

      console.groupEnd();
    };
    runDiagnostics();
  }, []);

  useEffect(() => {
    if (!isDraggingCanvas) return;
    
    const handleMouseMove = (e: MouseEvent) => {
       const newWidth = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
       setCanvasWidth(Math.min(Math.max(newWidth, 20), 80));
    };
    
    const handleMouseUp = () => {
       setIsDraggingCanvas(false);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
       window.removeEventListener('mousemove', handleMouseMove);
       window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingCanvas]);

  // Optional: Auto-expand canvas if we get margin notes and canvas is still narrow
  useEffect(() => {
     if (marginNotes.length > 0 && canvasWidth < 40) {
        setCanvasWidth(50);
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marginNotes.length]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentConv = conversations.find(c => c.id === currentId) || null;
  const messages = currentConv?.messages || [];
  const customAgents = currentConv?.customAgents || [];
  const activeAgentIds = currentConv?.activeAgentIds || currentRoles.map(r => r.id);
  const taskForcePurpose = currentConv?.taskForcePurpose;
  
  const lastMsg = messages[messages.length - 1];
  const showSynthesize = lastMsg && lastMsg.roleId !== 'user' && lastMsg.roleId !== 'synthesizer' && !isProcessing;

  const getAgentGenerationConfig = (baseTemperature: number, useSearch: boolean = false) => {
    return {
      temperature: appMode === 'LAB' ? 0.1 : baseTemperature,
      ...(useSearch ? { tools: [{ googleSearch: {} }] } : {})
    };
  };

  // Load from local storage on mount
  useEffect(() => {
    const initializeSessions = async () => {
      // 1. One-time migration if needed
      await SessionManager.migrateFromLocalStorage();
      
      // 2. Load all sessions
      const allSessions = await SessionManager.getAllSessions();
      let initialConvs: Conversation[] = [];
      
      if (allSessions.length > 0) {
        // Hydrate Conversations from WarRoomState payloads
        initialConvs = allSessions.map(session => {
           let c = { ...session.payload, retrospective: session.retrospective };
           
           // Apply same migrations as before for flash previews
           const migratedRoleSettings = { ...c.roleSettings };
           if (migratedRoleSettings) {
             Object.keys(migratedRoleSettings).forEach(key => {
               if (migratedRoleSettings[key].model === 'gemini-2.5-flash') {
                 migratedRoleSettings[key].model = 'gemini-3-flash-preview';
               }
             });
           }
           const migratedCustomAgents = (c.customAgents || []).map((ca: any) => {
             if (ca.model === 'gemini-2.5-flash') {
               return { ...ca, model: 'gemini-3-flash-preview' };
             }
             return ca;
           });
           return {
             ...c,
             roleSettings: migratedRoleSettings,
             customAgents: migratedCustomAgents,
             activeAgentIds: c.activeAgentIds || (c.mode === 'LAB' ? LAB_ROLES : ROLES).map(r => r.id)
           };
        });
      } else {
        // Fallback or empty state
        initialConvs = [{ id: uuidv4(), title: 'New Conversation', messages: [], createdAt: Date.now(), customAgents: [], activeAgentIds: currentRoles.map(r => r.id), roleSettings: DEFAULT_SETTINGS, mode: appMode }];
      }

      setConversations(initialConvs);
      setCurrentId(initialConvs[0].id);
    };

    initializeSessions();

    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        // Migrate old gemini-2.5-flash to gemini-3-flash-preview
        Object.keys(parsedSettings).forEach(key => {
          if (parsedSettings[key].model === 'gemini-2.5-flash') {
            parsedSettings[key].model = 'gemini-3-flash-preview';
          }
        });
        setSettings(parsedSettings);
      } catch (e) {
        console.error('Failed to parse saved settings', e);
      }
    }
  }, []);

  // Sync canvas state when conversation changes
  useEffect(() => {
    if (currentConv) {
      setCanvasText(currentConv.canvasText || '');
      setMarginNotes(currentConv.marginNotes || []);
      setArtifactBuffer(currentConv.artifactBuffer || []);
    }
  }, [currentId]);

  // Sync back to currentConv when they change
  useEffect(() => {
    setConversations(prev => prev.map(c => 
      c.id === currentId 
        ? { ...c, canvasText, marginNotes, artifactBuffer } 
        : c
    ));
  }, [canvasText, marginNotes, artifactBuffer]);

  // Save conversations to IDB
  useEffect(() => {
    if (currentConv) {
      const session = {
        sessionId: currentConv.id,
        title: currentConv.title,
        lastModified: Date.now(),
        payload: { ...currentConv, retrospective: undefined }, // Don't double-save retrospective in payload if we want it top-level
        retrospective: currentConv.retrospective
      };
      SessionManager.saveSession(session).catch(e => console.error("Failed to save to IDB:", e));
      
      // Keep conversations sorted in UI if we want to reflect "last modified" on top
      // Note: Re-sorting `conversations` constantly while typing would cause UI jumping.
      // Doing it only on load is often sufficient, but we can leave it as is for UI stability.
    }
  }, [currentConv]);

  // Save settings to local storage
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Auto-scroll - ONLY when user sends a message, not on every update
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].roleId === 'user') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Sync appMode with current conversation and reset transient states
  useEffect(() => {
    if (currentConv) {
      const targetMode = currentConv.mode || 'COUNCIL';
      if (targetMode !== appMode) {
        setAppMode(targetMode);
      }
      // Reset infographic prompt when switching conversations
      setPendingInfographicPrompt(null);
      setIsGeneratingImage(false);
    }
  }, [currentConv?.id, currentConv?.mode]);

  const updateConv = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations(prev => prev.map(c => c.id === id ? updater(c) : c));
  };

  const createNewConversation = () => {
    const newConv: Conversation = { 
      id: uuidv4(), 
      title: 'New Conversation', 
      messages: [], 
      createdAt: Date.now(), 
      customAgents: [], 
      activeAgentIds: currentRoles.map(r => r.id), 
      roleSettings: settings,
      agentOrder: currentRoles.map(r => r.id),
      mode: appMode,
      debateFormat: 'OPEN',
      pushbackLevel: 'BALANCED'
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentId(newConv.id);
    setIsSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await SessionManager.deleteSession(id);
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (filtered.length === 0) {
        // Prevent empty state by starting fresh
        const newConv: Conversation = { 
          id: uuidv4(), 
          title: 'New Conversation', 
          messages: [], 
          createdAt: Date.now(), 
          customAgents: [], 
          activeAgentIds: currentRoles.map(r => r.id), 
          roleSettings: settings,
          agentOrder: currentRoles.map(r => r.id),
          mode: appMode,
          debateFormat: 'OPEN',
          pushbackLevel: 'BALANCED'
        };
        setCurrentId(newConv.id);
        return [newConv];
      }
      if (currentId === id) {
        setCurrentId(filtered[0].id);
      }
      return filtered;
    });
  };

  const toggleAgent = (agentId: string) => {
    if (!currentId) return;
    updateConv(currentId, c => {
      const newActive = c.activeAgentIds.includes(agentId)
        ? c.activeAgentIds.filter(id => id !== agentId)
        : [...c.activeAgentIds, agentId];
      return { ...c, activeAgentIds: newActive };
    });
  };

  const moveAgent = (agentId: string, direction: 'left' | 'right') => {
    if (!currentId || !currentConv) return;
    
    const defaultOrder = [
      ...(currentConv.mode === 'LAB' ? LAB_ROLES : ROLES).map(r => r.id),
      ...currentConv.customAgents.map(a => a.id)
    ];
    
    let currentOrder = currentConv.agentOrder || defaultOrder;
    const missingAgents = defaultOrder.filter(id => !currentOrder.includes(id));
    currentOrder = [...currentOrder, ...missingAgents];
    
    const index = currentOrder.indexOf(agentId);
    if (index === -1) return;
    
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;
    
    const newOrder = [...currentOrder];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    
    updateConv(currentId, c => ({ ...c, agentOrder: newOrder }));
  };

  const generateArtifactMarkdown = (conversation: any, mode: 'full' | 'canvas' = 'full') => {
    let md = '';
    
    if (mode === 'full') {
        md += `# ${conversation.title || 'Nodus Strategic Artifact'}\n\n`;
        md += `**Archive ID:** \`${Math.random().toString(36).substr(2, 9).toUpperCase()}\`\n`;
        md += `**Release Date:** ${new Date().toLocaleDateString()}\n\n`;
        
        let taskForceStr = conversation.taskForceName || "Custom";
        if (conversation.mode === 'LAB') taskForceStr = 'Advanced Laboratory';
        md += `**Configuration:** ${taskForceStr}\n\n`;
        md += `---\n\n`;

        md += `## [ STRATEGIC LOGS ]\n\n`;
        conversation.messages.forEach((msg: any) => {
            let sender = (msg.roleId || 'AGENT').toUpperCase();
            if (msg.roleId === 'synthesizer') sender = 'SYNTHESIZER';
            else if (msg.roleId === 'user') sender = 'USER';
            
            md += `### ${sender} // ${msg.timestamp || ''}\n\n`;
            
            if (sender === 'SYNTHESIZER' && msg.synthesizerData) {
              const synthData = msg.synthesizerData;
              if (synthData.whitepaper || synthData.whitepaper_markdown) {
                md += `#### Final Synthesis\n\n${synthData.whitepaper || synthData.whitepaper_markdown}\n\n`;
              }
              if (synthData.suggested_next_questions?.length > 0) {
                md += `#### Strategic Vectors\n\n`;
                synthData.suggested_next_questions.forEach((q: string) => {
                  md += `- ${q}\n`;
                });
                md += `\n`;
              }
              if (synthData.fact_check?.length > 0) {
                md += `#### Fact Verification Audit\n\n| Agent | Verdict | Claim & Context |\n|-------|---------|-----------------|\n`;
                synthData.fact_check.forEach((f: any) => {
                  md += `| ${f.agent} | ${f.verdict} | **"${f.claim}"**<br>>> ${f.context} |\n`;
                });
                md += `\n`;
              }
              if (synthData.heatmap_data?.length > 0) {
                md += `#### Heatmap Summary\n\n| Agent 1 | Agent 2 | Score |\n|-------|---------|-------|\n`;
                synthData.heatmap_data.forEach((h: any) => {
                  md += `| ${h.agent1} | ${h.agent2} | ${h.score}/10 |\n`;
                });
                md += `\n`;
              }
              if (synthData.alignment_quotes?.length > 0) {
                md += `#### Alignment Log\n\n`;
                synthData.alignment_quotes.forEach((aq: any) => {
                  md += `> **[${aq.type.toUpperCase()}]** (${aq.agents.join(', ')}): "${aq.quote}"\n\n`;
                });
              }
            } else {
              md += `${msg.text || ''}\n\n`;
            }
            
            if (msg.fullAnalysis && msg.fullAnalysis.length > 0) {
                md += `**ANALYSIS:**\n${msg.fullAnalysis}\n\n`;
            }
            md += `---\n\n`;
        });
    }

    md += `## [ SYNTHESIZED CANVAS ]\n\n`;
    const canvasContent = conversation.canvasText || conversation.canvas;
    if (typeof canvasContent === 'string') {
        md += canvasContent;
    } else {
        md += `\`\`\`json\n${JSON.stringify(canvasContent, null, 2)}\n\`\`\``;
    }

    if (conversation.marginNotes && conversation.marginNotes.length > 0) {
        md += `\n\n### [ PROVOCATIONS / MARGIN NOTES ]\n\n`;
        conversation.marginNotes.forEach((note: any) => {
            md += `> **[${(note.agent || note.author || 'SYSTEM').toUpperCase()}]** on "${note.quote}":\n> ${note.comment}\n\n`;
        });
    }

    if (mode === 'full' && conversation.retrospective) {
      md += `---\n\n## [ SESSION RESOLUTION ]\n\n`;
      md += `**Status:** ${conversation.retrospective.status}\n\n`;
      conversation.retrospective.answers.forEach((a: any) => {
        md += `**Q:** ${a.question}\n**A:** ${a.answer}\n\n`;
      });
    }

    md += `\n\n---\n*NODUS INTELLIGENCE SYNTHESIS ENGINE // [ END OF MD ARCHIVE ]*`;
    return md;
  };

const generateArtifactHTML = (conversation: any) => {
    const title = (conversation.title || 'Nodus Report').toUpperCase();
    const date = new Date().toLocaleDateString();

    // Capture Conversation
    let conversationHtml = '';
    if (conversation.messages && conversation.messages.length > 0) {
      conversationHtml = '<div class="section-title">Strategic Logs & Transcript</div><div class="conversation-history">';
      conversation.messages.forEach((msg: any) => {
        const isUser = msg.roleId === 'user';
        const isSynthesizer = msg.roleId === 'synthesizer';
        const roleName = (msg.roleId || 'AGENT').toUpperCase();
        
        let contentHtml = msg.text ? msg.text.replace(/\n/g, '<br>') : '';
        
        if (isSynthesizer && msg.synthesizerData) {
           const synthData = msg.synthesizerData;
           contentHtml = '';
           if (synthData.whitepaper || synthData.whitepaper_markdown) {
             let text = synthData.whitepaper || synthData.whitepaper_markdown;
             text = text.replace(/### (.*?)(?=\n|$)/g, '<br><strong>$1</strong><br>');
             text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
             text = text.replace(/\n/g, '<br>');
             contentHtml += `<h4>Executive Synthesis</h4><p>${text}</p>`;
           }
           if (synthData.suggested_next_questions?.length > 0) {
             contentHtml += `<h4>Strategic Vectors</h4><ul>`;
             synthData.suggested_next_questions.forEach((q: string) => {
               contentHtml += `<li>${q}</li>`;
             });
             contentHtml += `</ul>`;
           }
           if (synthData.fact_check?.length > 0) {
             contentHtml += `<h4>Fact Verification Audit</h4><table><tr><th>Agent</th><th>Verdict</th><th>Claim & Context</th></tr>`;
             synthData.fact_check.forEach((f: any) => {
               contentHtml += `<tr><td>${f.agent}</td><td><strong>${f.verdict}</strong></td><td><b>"${f.claim}"</b><br/><span class="context-text">>> ${f.context}</span></td></tr>`;
             });
             contentHtml += `</table>`;
           }
           if (synthData.heatmap_summary) {
             contentHtml += `<h4>Friction Topology</h4><p>${synthData.heatmap_summary}</p>`;
           }
           if (synthData.alignment_quotes?.length > 0) {
             contentHtml += `<h4>Alignment Log</h4>`;
             synthData.alignment_quotes.forEach((aq: any) => {
               contentHtml += `<blockquote><b>[${aq.type.toUpperCase()}]</b> (${aq.agents.join(', ')}):<br/>"${aq.quote}"</blockquote>`;
             });
           }
        }
        
        // Assign specific CSS classes for styling
        let blockClass = "message-block";
        if (isUser) blockClass += " user-msg";
        if (isSynthesizer) blockClass += " synthesizer-msg";

        let displayName = roleName;
        if (!isUser && !isSynthesizer) {
           if (msg.roleId.startsWith('custom-') && conversation.customAgents) {
              const ca = conversation.customAgents.find((a: any) => a.id === msg.roleId);
              if (ca) displayName = ca.name.toUpperCase();
           } else {
              const agent = ROLES.find(r => r.id === msg.roleId) || LAB_ROLES.find(r => r.id === msg.roleId);
              if (agent) displayName = agent.name.toUpperCase();
           }
        }

        conversationHtml += `
          <div class="${blockClass}">
            <div class="message-header">${displayName} <span class="timestamp">${msg.timestamp || ''}</span></div>
            <div class="message-content">${contentHtml}</div>
          </div>
        `;
      });
      conversationHtml += '</div>';
    }

    let canvasDataHtml = '';
    if (conversation.canvasText) {
        canvasDataHtml = `
            <div class="section-title">Active Document Canvas</div>
            <div class="canvas-fidelity-wrapper">
                <pre>${conversation.canvasText}</pre>
            </div>
        `;
    }

    if (conversation.marginNotes && conversation.marginNotes.length > 0) {
        canvasDataHtml += `
            <div class="section-title">Margin Notes & Provocations</div>
            <div style="display: flex; flex-direction: column; gap: 20px;">
                ${conversation.marginNotes.map((note: any) => `
                    <div style="border-left: 3px solid var(--border-dark); padding-left: 15px;">
                        <div style="font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 5px; color: var(--text-muted);">${note.agent}</div>
                        <div style="font-style: italic; color: var(--text-muted); margin-bottom: 5px;">"${note.quote}"</div>
                        <div style="font-size: 14px;">${note.comment}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Nodus Report</title>
    <style>
        /* MINIMALIST REPORT THEME */
        :root {
            --bg: #ffffff;
            --text-main: #111111;
            --text-muted: #555555;
            --border-light: #e5e5e5;
            --border-dark: #000000;
            --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
            --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        body {
            background: var(--bg);
            color: var(--text-main);
            font-family: var(--font-serif);
            line-height: 1.7;
            margin: 0;
            padding: 40px 20px;
            font-size: 15px;
            -webkit-font-smoothing: antialiased;
        }

        .container {
            max-width: 800px; /* Optimal reading width for a report */
            margin: 0 auto;
        }

        /* HEADER */
        .header {
            border-bottom: 2px solid var(--border-dark);
            padding-bottom: 30px;
            margin-bottom: 50px;
        }

        .title {
            font-family: var(--font-sans);
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin: 0 0 16px 0;
            color: var(--text-main);
        }

        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .meta-item {
            border-top: 1px solid var(--border-light);
            padding-top: 8px;
        }

        /* SECTIONS */
        .section-title {
            font-family: var(--font-sans);
            font-size: 18px;
            font-weight: 600;
            color: var(--text-main);
            margin: 60px 0 30px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-light);
        }

        /* CANVAS AREA */
        .canvas-fidelity-wrapper {
            padding: 0;
            border-left: 4px solid var(--border-light);
            padding-left: 20px;
        }

        .canvas-fidelity-wrapper pre {
            white-space: pre-wrap;
            word-break: break-word;
            font-family: var(--font-serif);
            font-size: 16px;
            margin: 0;
        }

        /* CONVERSATION TRANSCRIPT */
        .conversation-history {
            display: flex;
            flex-direction: column;
            gap: 40px;
        }

        .message-block {
            margin-bottom: 30px;
        }

        .message-block.user-msg {
            font-weight: bold;
        }

        .message-block.synthesizer-msg {
            margin-top: 50px;
            border-top: 2px solid var(--border-dark);
            padding-top: 30px;
        }

        .message-header {
            font-family: var(--font-mono);
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
            margin-bottom: 12px;
            letter-spacing: 0.05em;
        }

        .timestamp {
            font-weight: normal;
            color: #999;
            margin-left: 8px;
        }

        .message-content {
            color: var(--text-main);
        }

        /* SYNTHESIS FORMATTING */
        .message-content h4 {
            font-family: var(--font-sans);
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 2.5em 0 1em;
            color: var(--text-main);
        }
        
        .message-content h4:first-child {
            margin-top: 0;
        }

        .message-content ul {
            padding-left: 20px;
        }

        .message-content li {
            margin-bottom: 8px;
        }

        /* TABLES */
        .message-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5em 0;
            font-family: var(--font-sans);
            font-size: 13px;
        }

        .message-content th, .message-content td {
            border-top: 1px solid var(--border-light);
            border-bottom: 1px solid var(--border-light);
            padding: 8px 12px;
            text-align: left;
            vertical-align: top;
        }

        .message-content th {
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-size: 11px;
            border-top: none;
            border-bottom: 2px solid var(--border-light);
        }

        .context-text {
            color: var(--text-muted);
            display: block;
            margin-top: 6px;
        }

        /* QUOTES */
        .message-content blockquote {
            border-left: 3px solid var(--border-light);
            margin: 1.5em 0;
            padding: 5px 0 5px 15px;
            font-style: italic;
            color: var(--text-muted);
        }

        .message-content blockquote b {
            font-family: var(--font-mono);
            font-size: 11px;
            font-style: normal;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-main);
        }

        /* FOOTER */
        .footer {
            margin-top: 100px;
            text-align: center;
            font-family: var(--font-mono);
            font-size: 10px;
            color: var(--text-muted);
            border-top: 1px solid var(--border-light);
            padding-top: 40px;
            letter-spacing: 0.1em;
        }

        /* PRINT OPTIMIZATION */
        @media print {
            body { padding: 0; font-size: 12pt; }
            .container { max-width: 100%; }
            .canvas-fidelity-wrapper, .message-block.synthesizer-msg { 
                background: transparent; 
                border: 1px solid #000; 
            }
            .section-title { page-break-after: avoid; }
            table, blockquote { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${title}</h1>
            <div class="meta-grid">
                <div class="meta-item">
                    <strong>Report ID</strong><br>
                    ${Math.random().toString(36).substr(2, 9).toUpperCase()}
                </div>
                <div class="meta-item">
                    <strong>Generation Date</strong><br>
                    ${date}
                </div>
                <div class="meta-item">
                    <strong>System</strong><br>
                    Nodus Intelligence
                </div>
            </div>
        </div>

        ${canvasDataHtml}
        ${conversationHtml}

        <div class="footer">
            CONFIDENTIAL ARCHIVE // GENERATED BY NODUS SYSTEMS
        </div>
    </div>
</body>
</html>`;
};

  const handleSaveRetrospective = (data: SessionRetrospective) => {
    if (!currentId) return;
    updateConv(currentId, c => ({ ...c, retrospective: data }));
  };

  const handleExport = (format: 'md' | 'html' = 'md') => {
    if (!currentConv) return;
    
    if (format === 'html') {
        handleExportHTML();
        return;
    }

    const md = generateArtifactMarkdown(currentConv, 'full');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (currentConv?.title || 'report').toLowerCase().replace(/\s+/g, '_');
    a.download = `${safeTitle}_full.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHTML = () => {
    if (!currentConv) return;
    const html = generateArtifactHTML(currentConv);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (currentConv?.title || 'report').toLowerCase().replace(/\s+/g, '_');
    a.download = `${safeTitle}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyText = () => {
    if (!currentConv) return;
    const md = generateArtifactMarkdown(currentConv, 'full');
    
    // Modern API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).catch(err => {
        console.error('Modern copy failed, trying fallback: ', err);
        fallbackCopyText(md);
      });
    } else {
      fallbackCopyText(md);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Ensure it's not visible or causing layout shifts
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch (err) {
      console.error('Fallback copy failed: ', err);
    }
  };

  const handleExportCanvas = () => {
    if (!currentConv) return;
    const md = generateArtifactMarkdown(currentConv, 'canvas');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (currentConv?.title || 'report').toLowerCase().replace(/\s+/g, '_');
    a.download = `${safeTitle}_canvas.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSuggestExperts = async (topic: string) => {
    if (!topic.trim() || isSuggesting || !currentId) return;
    setIsSuggesting(true);

    try {
      const response = await withRetry(() => getAI().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `The user wants to discuss: "${topic}". Suggest 2 highly specific, niche, or relevant thinkers/personas to analyze this topic. Provide their name, a system instruction for them to act as this persona (around 100 words), and a hex color code that represents their vibe.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                systemInstruction: { type: Type.STRING },
                color: { type: Type.STRING }
              },
              required: ["name", "systemInstruction", "color"]
            }
          }
        }
      }));

      const suggestions = JSON.parse(response.text || '[]');
      
      updateConv(currentId, c => {
        const newAgents = suggestions.map((s: any) => ({
          id: `custom-${uuidv4()}`,
          thinkerId: `custom-${uuidv4()}`,
          name: s.name,
          color: s.color,
          systemInstruction: s.systemInstruction,
          model: 'gemini-3-pro-preview'
        }));
        
        return {
          ...c,
          customAgents: [...c.customAgents, ...newAgents],
          activeAgentIds: [...c.activeAgentIds, ...newAgents.map((a: any) => a.id)]
        };
      });

    } catch (error: any) {
      console.error("Failed to suggest experts", error);
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        setShowQuotaError(true);
      }
    }
    setIsSuggesting(false);
  };

  const handleSend = async (text: string, attachments: Attachment[] = [], overrideId?: string, systemInjection?: string) => {
    const targetId = overrideId || currentId;
    if ((!text.trim() && attachments.length === 0) || isProcessing || !targetId) return;

    // Explicitly derive current agents based on mode
    const currentAgents = appMode === 'LAB' ? LAB_ROLES : ROLES;

    const userMsg: Message = { id: uuidv4(), roleId: 'user', text, attachments };
    
    updateConv(targetId, c => {
      const isFirst = c.messages.length === 0;
      return {
        ...c,
        title: isFirst ? (text.substring(0, 30) || 'Document Analysis') + (text.length > 30 ? '...' : '') : c.title,
        messages: [...c.messages, userMsg]
      };
    });
    
    setIsProcessing(true);

    let liveContext = '';
    if (isNewsModeEnabled && text.trim()) {
      liveContext = await fetchLiveContext(text);
    }

    const latestConv = conversations.find(c => c.id === targetId) || currentConv;
    const activeSettings = latestConv?.roleSettings || settings;

    // Build context from previous messages to allow continuation
// LIMIT CONTEXT: Only look at the last 12 messages to save tokens
const recentMessages = messages.slice(-12); 

let currentContext = recentMessages.map(m => {
      if (m.roleId === 'user') return `User: ${m.text}`;
      if (m.roleId === 'synthesizer') return `Synthesizer: ${m.text}`;
      
      const agent = getActiveAgent(m.roleId, activeSettings, appMode);
      let agentName = agent.name;
      if (m.roleId.startsWith('custom-')) {
        const ca = customAgents.find(a => a.id === m.roleId);
        if (ca) agentName = ca.name;
      }
      // Use full analysis if available for deeper context
      return `${agentName}: ${m.fullAnalysis || m.text}`;
    }).join('\n\n');
    
    currentContext += `\n\nUser asked: ${text}\n\n`;
    
    const defaultOrder = [
      ...currentAgents.map(r => r.id),
      ...(latestConv?.customAgents || []).map(a => a.id)
    ];
    let order = latestConv?.agentOrder || defaultOrder;
    const missing = defaultOrder.filter(id => !order.includes(id));
    order = [...order, ...missing];

    const allAvailableAgents = [
      ...currentAgents.map(r => getActiveAgent(r.id, activeSettings, appMode)),
      ...(latestConv?.customAgents || [])
    ];
    
    // Only run agents that are currently active and sort them
    let agentsToRun = allAvailableAgents
      .filter(a => latestConv?.activeAgentIds.includes(a.id))
      .sort((a, b) => {
        const orderA = order.indexOf(a.id);
        const orderB = order.indexOf(b.id);
        return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
      });
    
    // Fallback: If in LAB mode and no agents matched (likely due to ID migration), run all available Lab agents
    if (agentsToRun.length === 0 && appMode === 'LAB' && allAvailableAgents.length > 0) {
      agentsToRun = allAvailableAgents;
    }
    
    // Add all empty messages to state first
    const agentMessages = agentsToRun.map(agent => ({
      id: uuidv4(),
      roleId: agent.id,
      text: '',
      isTyping: true
    }));

    updateConv(targetId, c => ({
      ...c,
      messages: [...c.messages, ...agentMessages]
    }));

    // --- CONSOLIDATED SINGLE-CALL LOGIC ---

    const rosterString = agentsToRun.map(a => 
      `Agent ID: "${a.id}"\nName: ${a.name}\nFramework/Persona: ${a.systemInstruction}`
    ).join('\n\n');

    let effectiveUserPrompt = text;
    if (liveContext) {
      effectiveUserPrompt = `CURRENT GLOBAL CONTEXT: \n${liveContext}\n\nUSER PROMPT: ${text}`;
    }

    const masterPrompt = `
You are an orchestrator for a high-level Task Force.
Below is the context and user input.

${getDebateRulesStr(latestConv, appMode)}CONTEXT/DOCUMENT:
${effectiveUserPrompt}

PREVIOUS DISCUSSION:
${currentContext}

I need the following experts to analyze this:
${rosterString}

CRITICAL: You must generate a distinct response for EACH agent listed above.
Do not let their perspectives bleed together.
Return ONLY a valid JSON object with the following structure:
{
  "responses": [
    { "agentId": "uuid-1", "full_analysis": "...", "provocation": "..." },
    { "agentId": "uuid-2", "full_analysis": "...", "provocation": "..." }
  ]
}
    `;

    const parts: any[] = [];
    if (attachments && attachments.length > 0) {
      attachments.forEach(att => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      });
    }
    parts.push({ text: masterPrompt });

    // SEARCH LOGIC:
    // Lab Agents: ALWAYS use search.
    // Council Agents: Use search ONLY if newsMode is enabled.
    const useSearch = appMode === 'LAB' || (appMode === 'COUNCIL' && isNewsModeEnabled);

    const config: any = {
        systemInstruction: systemInjection 
          ? `You are the Task Force Orchestrator. ${systemInjection}` 
          : "You are the Task Force Orchestrator. Your job is to simulate multiple distinct personas analyzing the same input simultaneously.",
        ...getAgentGenerationConfig(appMode === 'LAB' ? 0.1 : 0.7, useSearch),
    };

    if (useSearch) {
       config.systemInstruction += "\n\nIMPORTANT: You have access to Google Search. Use it to find current data. You MUST still output valid JSON format.";
       // When using search, we CANNOT use responseMimeType: 'application/json'
       // We rely on the system instruction and the resilient parser.
    } else {
       // Strict JSON mode for non-search agents
       config.responseMimeType = "application/json";
       config.responseSchema = {
        type: Type.OBJECT,
        properties: {
          responses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                agentId: { type: Type.STRING },
                full_analysis: { type: Type.STRING },
                provocation: { type: Type.STRING }
              },
              required: ["agentId", "full_analysis", "provocation"]
            }
          }
        },
        required: ["responses"]
      };
    }

    // Use a high-context model for the master call
    const modelName = 'gemini-3-pro-preview'; 
    
    try {
      const responseStream = await withRetry(() => getAI().models.generateContentStream({
        model: modelName,
        contents: { parts },
        config
      }));

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
        }
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount || 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }
      }

      setSessionTokens(prev => ({
        ...prev,
        agentInput: prev.agentInput + inputTokens,
        agentOutput: prev.agentOutput + outputTokens
      }));

      const parsed = resilientJSONParse(fullText);
      
      if (parsed && parsed.responses && Array.isArray(parsed.responses)) {
        // Fan-out updates
        updateConv(targetId, c => ({
          ...c,
          messages: c.messages.map(msg => {
            const response = parsed.responses.find((r: any) => r.agentId === msg.roleId);
            if (response && agentMessages.some(am => am.id === msg.id)) {
              return {
                ...msg,
                text: response.provocation || response.full_analysis,
                fullAnalysis: response.full_analysis,
                isTyping: false
              };
            }
            return msg;
          })
        }));
      } else {
        console.error("Failed to parse master response:", fullText);
        // Fallback: Mark all as failed
        updateConv(targetId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            agentMessages.some(am => am.id === msg.id) 
              ? { ...msg, text: '[Analysis Failed - Invalid JSON]', isTyping: false } 
              : msg
          )
        }));
      }

    } catch (error: any) {
      console.error("Master call failed:", error);
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        setShowQuotaError(true);
      }
      updateConv(targetId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          agentMessages.some(am => am.id === msg.id) 
            ? { ...msg, text: '[Connection lost]', isTyping: false } 
            : msg
        )
      }));
    }

    setIsProcessing(false);
  };

  const handleRebuttal = async (messageId: string, targetAgentId: string, attackingAgentId: string) => {
    if (!currentId || isProcessing) return;

    const targetMsg = messages.find(m => m.id === messageId);
    if (!targetMsg) return;

    const activeSettings = currentConv?.roleSettings || settings;
    const attacker = getActiveAgent(attackingAgentId, activeSettings, appMode);
    
    // Create rebuttal entry
    const rebuttalId = uuidv4();
    updateConv(currentId, c => ({
      ...c,
      messages: c.messages.map(msg => 
        msg.id === messageId ? {
          ...msg,
          rebuttals: [...(msg.rebuttals || []), {
            id: rebuttalId,
            agentId: attackingAgentId,
            text: '',
            isTyping: true
          }]
        } : msg
      )
    }));

    try {
      const prompt = `You are ${attacker.name}. Target statement by ${targetAgentId}: '${targetMsg.text}'. TASK: Attack this specific statement. Find the logical fallacy or risk. Dismantle it in one sharp paragraph (under 60 words).`;
      
      const responseStream = await withRetry(() => getAI().models.generateContentStream({
        model: attacker.model || 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: attacker.systemInstruction,
          ...getAgentGenerationConfig(0.7)
        }
      }));

      let inputTokens = 0;
      let outputTokens = 0;

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          updateConv(currentId, c => ({
            ...c,
            messages: c.messages.map(msg => 
              msg.id === messageId ? {
                ...msg,
                rebuttals: (msg.rebuttals || []).map(r => 
                  r.id === rebuttalId ? { ...r, text: fullText } : r
                )
              } : msg
            )
          }));
        }
        
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount || 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }
      }

      setSessionTokens(prev => ({
        ...prev,
        agentInput: prev.agentInput + inputTokens,
        agentOutput: prev.agentOutput + outputTokens
      }));

      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === messageId ? {
            ...msg,
            rebuttals: (msg.rebuttals || []).map(r => 
              r.id === rebuttalId ? { ...r, isTyping: false } : r
            )
          } : msg
        )
      }));

    } catch (error) {
      console.error("Rebuttal failed", error);
      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === messageId ? {
            ...msg,
            rebuttals: (msg.rebuttals || []).map(r => 
              r.id === rebuttalId ? { ...r, text: '[Rebuttal failed]', isTyping: false } : r
            )
          } : msg
        )
      }));
    }
  };




  const handleRetry = async (messageId: string) => {
    if (!currentId || isProcessing) return;
    
    const targetMsg = messages.find(m => m.id === messageId);
    if (!targetMsg) return;

    // Determine if it's a synthesizer message or a regular agent message
    if (targetMsg.roleId === 'synthesizer') {
      // Retry synthesis
      setIsProcessing(true);
      
      // Reset message state
      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === messageId ? { ...msg, text: '', isTyping: true, factCheck: undefined } : msg
        )
      }));

      try {
        const lastUserIndex = [...messages].reverse().findIndex(m => m.roleId === 'user');
        // We need to exclude the failed synth message itself from context
        const relevantMessages = (lastUserIndex !== -1 ? messages.slice(messages.length - 1 - lastUserIndex) : messages)
          .filter(m => m.id !== messageId);
        
        const context = relevantMessages.map(m => {
          let agentName = getActiveAgent(m.roleId, currentConv?.roleSettings || settings, currentConv?.mode).name;
          if (m.roleId.startsWith('custom-')) {
            const ca = customAgents.find(a => a.id === m.roleId);
            if (ca) agentName = ca.name;
          }
          return `${agentName}: ${m.fullAnalysis || m.text}`;
        }).join('\n\n');
        
        // -----------------------------------------------------------------------
        // STEP 1: Standalone Fact Checker (Linear Pipeline)
        // -----------------------------------------------------------------------
        let factCheckerResults: any[] = [];
        try {
          const activeAgentNames = activeAgentIds.map(id => {
            if (id.startsWith('custom-')) {
              const ca = customAgents.find(a => a.id === id);
              return ca ? ca.name : id;
            }
            const std = allAvailableAgents.find(a => a.id === id);
            return std ? std.name : id;
          }).join(', ');
          const factCheckResponse = await withRetry(() => getAI().models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `You are a Grounded Ledger Auditor for a debate between AI personas.
            The following analytical operatives generated this data: ${activeAgentNames}.
            
            Context (Previous Arguments):
            ${context}

            Extract 2-3 NEW core data points, statistics, or historical precedents mentioned by the operatives. You MUST use Google Search to verify them and provide the actual real-world data. Do not return empty. Do NOT re-verify claims that have already been evaluated in previous rounds.

            IMPORTANT FORMATTING RULE: You MUST output a valid JSON array of objects inside a \`\`\`json markdown block. Do not concatenate words together. Ensure proper spacing between words.

            Use this schema:
            [\n  {\n    "agent": "Name",\n    "claim": "The data point...",\n    "verdict": "VERIFIED" | "DEBUNKED" | "NEEDS CONTEXT",\n    "context": "Actual real-world data from search"\n  }\n]`,
            config: {
              tools: [{ googleSearch: {} }],
              ...getAgentGenerationConfig(0.2, true)
            }
          }));
          
          let parsedResults = resilientJSONParse(factCheckResponse.text || '[]') || [];
          factCheckerResults = parsedResults.filter((f: any) => !f.agent?.toLowerCase().includes('empiricist'));

          // Extract grounding metadata (sources)
          const groundingMetadata = factCheckResponse.candidates?.[0]?.groundingMetadata;
          const sources = groundingMetadata?.groundingChunks?.map((chunk: any) => ({
            title: chunk.web?.title || 'Source',
            url: chunk.web?.uri
          })).filter((s: any) => s.url) || [];

          updateConv(currentId, c => ({
            ...c,
            messages: c.messages.map(msg => 
              msg.id === messageId ? { 
                ...msg, 
                factCheck: { 
                  ...msg.factCheck,
                  sources: sources as { title: string, url: string }[] 
                } as FactCheck
              } : msg
            )
          }));

        } catch (fcError) {
          console.error("Fact check step failed:", fcError);
          // Continue without fact check results if it fails
        }

        // -----------------------------------------------------------------------
        // STEP 2: Synthesizer (With Injected Facts)
        // -----------------------------------------------------------------------
        const activeAgentNames = activeAgentIds.map(id => {
          if (id.startsWith('custom-')) {
            const ca = customAgents.find(a => a.id === id);
            return ca ? ca.name : id;
          }
          const std = allAvailableAgents.find(a => a.id === id);
          return std ? std.name : id;
        }).join(', ');
        let prompt = `Synthesize the following discussion generated by these analytical operatives: ${activeAgentNames}\n\n${context}\n\nVERIFIED CONTEXT: You must base your final synthesis on these verified facts: ${JSON.stringify(factCheckerResults)}\n\nSynthesize these perspectives into a higher-order conclusion. You must also generate a 'radar_data' array for a 5-axis chart: ["Pragmatism", "Ethics", "Innovation", "Feasibility", "Risk"]. For each axis, assign a score (1-10) for every agent based on their arguments. You must also output an array of 2 to 3 'suggested_next_questions' that identify the most critical unresolved friction points to drive the next iteration of the debate.`;
        
        if (taskForcePurpose) {
          prompt = `You are moderating a curated panel. The specific goal of this session is: ${taskForcePurpose}. When you generate your final 3 provocative questions (suggested_next_questions), they MUST NOT be generic. They must be aggressively tailored to help the user achieve this specific goal using the friction you just observed between the agents.\n\n${prompt}`;
        }

        const activeSynth = getActiveAgent('synthesizer', currentConv?.roleSettings || settings, currentConv?.mode);
        
        const responseStream = await withRetry(() => getAI().models.generateContentStream({
          model: activeSynth.model || 'gemini-3.1-pro-preview',
          contents: prompt,
          config: {
            systemInstruction: activeSynth.systemInstruction,
            ...getAgentGenerationConfig(0.5),
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                radar_data: {
                  type: Type.ARRAY,
                  description: "5 fixed axes: ['Pragmatism', 'Ethics', 'Innovation', 'Feasibility', 'Risk']. For each axis, provide a score (1-10) for every agent.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      axis: { type: Type.STRING, enum: ['Pragmatism', 'Ethics', 'Innovation', 'Feasibility', 'Risk'] },
                      agent_scores: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                             agent: { type: Type.STRING },
                             score: { type: Type.NUMBER }
                          },
                          required: ["agent", "score"]
                        }
                      }
                    },
                    required: ["axis", "agent_scores"]
                  }
                },
                heatmap_summary: { type: Type.STRING, description: "A concise 1-2 sentence summary of the main alignment friction and consensus from the heatmap." },
              heatmap_data: {
                  type: Type.ARRAY,
                  description: "A flat array of objects representing the alignment score between every pair of agents.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      agent1: { type: Type.STRING },
                      agent2: { type: Type.STRING },
                      score: { type: Type.NUMBER, description: "Alignment score between -1.0 (friction) and 1.0 (consensus)" }
                    },
                    required: ["agent1", "agent2", "score"]
                  }
                },
                alignment_quotes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      agents: { type: Type.ARRAY, items: { type: Type.STRING } },
                      type: { type: Type.STRING, enum: ["friction", "consensus"] },
                      quote: { type: Type.STRING }
                    },
                    required: ["agents", "type", "quote"]
                  }
                },
                suggested_next_questions: {
                  type: Type.ARRAY,
                  description: "2 to 3 suggested next questions based on the most critical unresolved friction points in the current debate.",
                  items: { type: Type.STRING }
                },
                whitepaper_markdown: { type: Type.STRING }
              },
              required: ["radar_data", "heatmap_summary", "heatmap_data", "alignment_quotes", "suggested_next_questions", "whitepaper_markdown"]
            },
          },
        }));

        let fullText = '';
        for await (const chunk of responseStream) {
          if (chunk.text) {
            fullText += chunk.text;
            updateConv(currentId, c => ({
              ...c,
              messages: c.messages.map(msg => 
                msg.id === messageId ? { ...msg, text: fullText } : msg
              )
            }));
          }
        }
        
        const synthesizerData = parseSynthesizerResponse(fullText);
        
        // Transform radar_data if present
        if (synthesizerData && synthesizerData.radar_data && Array.isArray(synthesizerData.radar_data)) {
          synthesizerData.radar_data = synthesizerData.radar_data.map((item: any) => {
            const newItem: any = { axis: item.axis };
            if (Array.isArray(item.agent_scores)) {
              item.agent_scores.forEach((score: any) => {
                newItem[score.agent] = score.score;
              });
            }
            return newItem;
          });
        }
        
        // Inject the pre-calculated fact check results into the final data object
        if (synthesizerData) {
          synthesizerData.fact_check = factCheckerResults;
        }
        
        updateConv(currentId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            msg.id === messageId ? { ...msg, isTyping: false, synthesizerData } : msg
          )
        }));

      } catch (error: any) {
        console.error('Error retrying synthesis:', error);
        if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
          setShowQuotaError(true);
        }
        updateConv(currentId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            msg.id === messageId ? { ...msg, text: '[Synthesis failed]', isTyping: false } : msg
          )
        }));
      }
      setIsProcessing(false);

    } else {
      // Retry regular agent
      setIsProcessing(true);
      
      // Reset message state
      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === messageId ? { ...msg, text: '', isTyping: true } : msg
        )
      }));

      try {
        const agent = getActiveAgent(targetMsg.roleId, currentConv?.roleSettings || settings, currentConv?.mode);
        if (targetMsg.roleId.startsWith('custom-')) {
          const ca = customAgents.find(a => a.id === targetMsg.roleId);
          if (ca) Object.assign(agent, ca);
        }

        // Reconstruct context
        // Find the user message that triggered this batch
        // We assume the batch is bounded by user messages
        const msgIndex = messages.findIndex(m => m.id === messageId);
        const previousMessages = messages.slice(0, msgIndex);
        const lastUserMsg = [...previousMessages].reverse().find(m => m.roleId === 'user');
        
        if (!lastUserMsg) {
          throw new Error('Could not find original user prompt');
        }

        // Construct context from history up to the user message
        const contextMessages = previousMessages.filter(m => m.id !== lastUserMsg.id); // Everything before the prompt
        const currentContext = contextMessages.map(m => {
          let agentName = getActiveAgent(m.roleId, currentConv?.roleSettings || settings, currentConv?.mode).name;
          if (m.roleId.startsWith('custom-')) {
            const ca = customAgents.find(a => a.id === m.roleId);
            if (ca) agentName = ca.name;
          }
          return `${agentName}: ${m.fullAnalysis || m.text}`;
        }).join('\n\n');

        const prompt = `${getDebateRulesStr(currentConv, currentConv?.mode)}Topic: ${lastUserMsg.text}\n\nPrevious thoughts from the council:\n${currentContext}\n\nNow, provide your perspective on the topic, maintaining your persona and reacting to the previous thoughts if relevant.`;

        const config: any = {
            systemInstruction: agent.systemInstruction + "\n\nCRITICAL SYSTEM DIRECTIVE: You must output a valid JSON object with EXACTLY two keys: 'provocation' (a short quote under 250 chars) and 'full_analysis' (a deep multi-paragraph breakdown). Do not include markdown blocks.",
            ...getAgentGenerationConfig(0.7, agent.useSearch),
        };

        // Only use JSON mode if NOT using search (Gemini API limitation)
        if (!agent.useSearch) {
          config.responseMimeType = "application/json";
          config.responseSchema = {
            type: Type.OBJECT,
            properties: {
              full_analysis: {
                type: Type.STRING,
                description: "A deep, multi-paragraph analysis from the persona's worldview."
              },
              provocation: {
                type: Type.STRING,
                description: "A single, punchy, provocative sentence summarizing the core insight."
              }
            },
            required: ["full_analysis", "provocation"]
          };
        }

        const responseStream = await withRetry(() => getAI().models.generateContentStream({
          model: agent.model || 'gemini-3-pro-preview',
          contents: prompt,
          config,
        }));

        let inputTokens = 0;
        let outputTokens = 0;

        let fullText = '';
        for await (const chunk of responseStream) {
          if (chunk.text) {
            fullText += chunk.text;
            
            // Real-time extraction for progressive typing
            const partialProvocation = extractPartialField(fullText, 'provocation');
            const partialAnalysis = extractPartialField(fullText, 'full_analysis');
            const hasJsonFields = !!partialProvocation || fullText.includes('"provocation"');

            updateConv(currentId, c => ({
              ...c,
              messages: c.messages.map(msg => 
                msg.id === messageId ? { 
                  ...msg, 
                  text: hasJsonFields ? (partialProvocation || "...") : fullText,
                  fullAnalysis: partialAnalysis
                } : msg
              )
            }));
          }
          
          if (chunk.usageMetadata) {
            inputTokens = chunk.usageMetadata.promptTokenCount || 0;
            outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
          }
        }
        
        setSessionTokens(prev => ({
          ...prev,
          agentInput: prev.agentInput + inputTokens,
          agentOutput: prev.agentOutput + outputTokens
        }));

        const { provocation, fullAnalysis } = parseAgentResponse(fullText);

        updateConv(currentId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            msg.id === messageId ? { ...msg, isTyping: false, text: provocation, fullAnalysis } : msg
          )
        }));

      } catch (error: any) {
        console.error('Error retrying agent:', error);
        if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
          setShowQuotaError(true);
        }
        updateConv(currentId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            msg.id === messageId ? { ...msg, text: '[Connection lost]', isTyping: false } : msg
          )
        }));
      }
      setIsProcessing(false);
    }
  };

  const handleRegenerateWithFactCheck = async (messageId: string) => {
    if (!currentId || isProcessing) return;
    
    const targetMsg = messages.find(m => m.id === messageId);
    if (!targetMsg || targetMsg.roleId !== 'synthesizer' || !targetMsg.factCheck?.text) return;

    setIsProcessing(true);
    
    // Store fact check feedback before clearing message
    const factCheckFeedback = targetMsg.factCheck.text;

    // Reset message state
    updateConv(currentId, c => ({
      ...c,
      messages: c.messages.map(msg => 
        msg.id === messageId ? { ...msg, text: '', isTyping: true, factCheck: { status: 'verifying' } } : msg
      )
    }));

    try {
      const lastUserIndex = [...messages].reverse().findIndex(m => m.roleId === 'user');
      const relevantMessages = (lastUserIndex !== -1 ? messages.slice(messages.length - 1 - lastUserIndex) : messages)
        .filter(m => m.id !== messageId);
      
      const context = relevantMessages.map(m => {
        let agentName = getActiveAgent(m.roleId, currentConv?.roleSettings || settings, currentConv?.mode).name;
        if (m.roleId.startsWith('custom-')) {
          const ca = customAgents.find(a => a.id === m.roleId);
          if (ca) agentName = ca.name;
        }
        return `${agentName}: ${m.fullAnalysis || m.text}`;
      }).join('\n\n');
      
      let prompt = `Synthesize the following discussion:\n\n${context}\n\nIMPORTANT: The previous synthesis contained the following factual inaccuracies which MUST be corrected in this new version:\n${factCheckFeedback}\n\nEnsure the new synthesis is factually accurate and addresses these points. You must also output an array of 2 to 3 'suggested_next_questions' that identify the most critical unresolved friction points to drive the next iteration of the debate.`;
      
      if (taskForcePurpose) {
        prompt = `You are moderating a curated panel. The specific goal of this session is: ${taskForcePurpose}. When you generate your final 3 provocative questions (suggested_next_questions), they MUST NOT be generic. They must be aggressively tailored to help the user achieve this specific goal using the friction you just observed between the agents.\n\n${prompt}`;
      }

      const activeSynth = getActiveAgent('synthesizer', currentConv?.roleSettings || settings, currentConv?.mode);
      
      const responseStream = await withRetry(() => getAI().models.generateContentStream({
        model: activeSynth.model || 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: activeSynth.systemInstruction,
          ...getAgentGenerationConfig(0.5),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              heatmap_summary: { type: Type.STRING, description: "A concise 1-2 sentence summary of the main alignment friction and consensus from the heatmap." },
              heatmap_data: {
                type: Type.ARRAY,
                description: "A flat array of objects representing the alignment score between every pair of agents.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    agent1: { type: Type.STRING },
                    agent2: { type: Type.STRING },
                    score: { type: Type.NUMBER, description: "Alignment score between -1.0 (friction) and 1.0 (consensus)" }
                  },
                  required: ["agent1", "agent2", "score"]
                }
              },
              alignment_quotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    agents: { type: Type.ARRAY, items: { type: Type.STRING } },
                    type: { type: Type.STRING, enum: ["friction", "consensus"] },
                    quote: { type: Type.STRING }
                  },
                  required: ["agents", "type", "quote"]
                }
              },
              fact_check: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    agent: { type: Type.STRING },
                    claim: { type: Type.STRING },
                    verdict: { type: Type.STRING, enum: ["VERIFIED", "DEBUNKED", "NEEDS CONTEXT"] },
                    context: { type: Type.STRING }
                  },
                  required: ["agent", "claim", "verdict", "context"]
                }
              },
              suggested_next_questions: {
                type: Type.ARRAY,
                description: "2 to 3 suggested next questions based on the most critical unresolved friction points in the current debate.",
                items: { type: Type.STRING }
              },
              whitepaper_markdown: { type: Type.STRING }
            },
            required: ["heatmap_summary", "heatmap_data", "alignment_quotes", "fact_check", "suggested_next_questions", "whitepaper_markdown"]
          }
        },
      }));

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          updateConv(currentId, c => ({
            ...c,
            messages: c.messages.map(msg => 
              msg.id === messageId ? { ...msg, text: fullText } : msg
            )
          }));
        }
      }
      
      const synthesizerData = parseSynthesizerResponse(fullText);
      
      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === messageId ? { ...msg, isTyping: false, synthesizerData } : msg
        )
      }));

      // Re-run Fact Check
      try {
        const factCheckResponse = await withRetry(() => getAI().models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: `You are a Grounded Ledger Auditor for a debate between AI personas (e.g., Baudrillard, Zizek, etc.).
          Your goal is to distinguish between **Objective Factual Errors** and **Persona Interpretations**.

          Text to check:
          "${fullText}"

          Analyze the text.
          1. **Objective Factual Errors**: Wrong dates, wrong historical events, scientific falsehoods presented as consensus fact. (e.g. "World War II ended in 1950").
          2. **Persona Interpretations**: Philosophical claims, theoretical frameworks, or subjective viewpoints that are consistent with the persona but not "objective fact". (e.g. "Reality is a simulation").

          Output Format:
          If there are **Objective Factual Errors**, return exactly:
          STATUS: ERROR
          [List of specific factual corrections]

          If there are **No Factual Errors** but significant **Persona Interpretations** that might be mistaken for fact, return exactly:
          STATUS: INTERPRETATION
          [List of claims that are theoretical interpretations, not objective facts]

          If the text is purely factual and accurate (or correctly attributes interpretations), return exactly:
          STATUS: VERIFIED`,
        }));

        const factCheckText = factCheckResponse.text?.trim() || '';
        
        let status: FactCheck['status'] = 'warning';
        let displayText: string | undefined = factCheckText;

        if (factCheckText.includes('STATUS: VERIFIED')) {
          status = 'verified';
          displayText = undefined;
        } else if (factCheckText.includes('STATUS: INTERPRETATION')) {
          status = 'interpretation';
          displayText = factCheckText.replace('STATUS: INTERPRETATION', '').trim();
        } else if (factCheckText.includes('STATUS: ERROR')) {
          status = 'warning';
          displayText = factCheckText.replace('STATUS: ERROR', '').trim();
        }

        updateConv(currentId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            msg.id === messageId ? { 
              ...msg, 
              factCheck: { 
                status,
                text: displayText
              } 
            } : msg
          )
        }));
      } catch (fcError: any) {
        console.error('Fact check failed:', fcError);
        if (fcError?.message?.includes('429') || fcError?.message?.includes('RESOURCE_EXHAUSTED')) {
          setShowQuotaError(true);
        }
        updateConv(currentId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            msg.id === messageId ? { ...msg, factCheck: { status: 'error', text: 'Fact check failed' } } : msg
          )
        }));
      }

    } catch (error: any) {
      console.error('Error regenerating synthesis:', error);
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        setShowQuotaError(true);
      }
      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === messageId ? { ...msg, text: '[Synthesis failed]', isTyping: false } : msg
        )
      }));
    }
    setIsProcessing(false);
  };

  const handleParameterChange = async (messageId: string, newValue: number) => {
    if (!currentId) return;
    
    const targetMsg = messages.find(m => m.id === messageId);
    if (!targetMsg) return;

    // Update local settings state first for immediate UI feedback
    const roleId = targetMsg.roleId;
    const newSettings = {
      ...(currentConv?.roleSettings || settings),
      [roleId]: {
        ...(currentConv?.roleSettings?.[roleId] || settings[roleId] || DEFAULT_SETTINGS[roleId]),
        parameterValue: newValue
      }
    };
    
    setSettings(newSettings);
    updateConv(currentId, c => ({ ...c, roleSettings: newSettings }));
    
    // Store original text before clearing
    const originalResponse = targetMsg.text;

    // Reset message state
    updateConv(currentId, c => ({
      ...c,
      messages: c.messages.map(msg => 
        msg.id === messageId ? { ...msg, text: '', isTyping: true, factCheck: undefined } : msg
      )
    }));

    try {
      const agent = getActiveAgent(roleId, newSettings, appMode);
      let parameterName = 'Intensity';
      if (roleId === 'synthesizer') parameterName = 'Synthesis Depth';
      else if (!roleId.startsWith('custom-')) {
        const role = ROLES.find(r => r.id === roleId);
        if (role?.parameter) parameterName = role.parameter.name;
      }

      const prompt = `You are ${agent.name}.

You previously generated a response to the conversation.
Your Previous Response: "${originalResponse}"

The user has just adjusted your ${parameterName} parameter to ${newValue} out of 100.

Rewrite your response. You MUST maintain your exact core argument, analytical framework, and final conclusion. However, you must drastically shift your rhetorical style, tone, and vocabulary to reflect this new parameter value. Stay completely in character. Do not acknowledge this adjustment to the user; just deliver the modified response.`;

      const responseStream = await withRetry(() => getAI().models.generateContentStream({
        model: agent.model || 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: agent.systemInstruction + "\n\nCRITICAL SYSTEM DIRECTIVE: You must output a valid JSON object with EXACTLY two keys: 'provocation' (a short quote under 250 chars) and 'full_analysis' (a deep multi-paragraph breakdown). Do not include markdown blocks.",
          ...getAgentGenerationConfig(0.7),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              full_analysis: {
                type: Type.STRING,
                description: "A deep, multi-paragraph analysis from the persona's worldview."
              },
              provocation: {
                type: Type.STRING,
                description: "A single, punchy, provocative sentence summarizing the core insight."
              }
            },
            required: ["full_analysis", "provocation"]
          }
        },
      }));

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          
          const partialProvocation = extractPartialField(fullText, 'provocation');
          const partialAnalysis = extractPartialField(fullText, 'full_analysis');
          const hasJsonFields = !!partialProvocation || fullText.includes('"provocation"');

          updateConv(currentId, c => ({
            ...c,
            messages: c.messages.map(msg => 
              msg.id === messageId ? { 
                ...msg, 
                text: hasJsonFields ? (partialProvocation || "...") : fullText,
                fullAnalysis: partialAnalysis
              } : msg
            )
          }));
        }
      }
      
      if (!fullText) {
        throw new Error('No response generated');
      }

      const { provocation, fullAnalysis } = parseAgentResponse(fullText);

      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === messageId ? { 
            ...msg, 
            text: provocation || fullText,
            fullAnalysis: fullAnalysis,
            isTyping: false 
          } : msg
        )
      }));

    } catch (error: any) {
      console.error('Error updating parameter response:', error);
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        setShowQuotaError(true);
      }
      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === messageId ? { ...msg, text: originalResponse || '[Connection lost]', isTyping: false } : msg
        )
      }));
    }
  };

  const handleFactCheck = async (messageId: string, textToCheck: string, context: string[]) => {
    if (!currentId) return;

    updateConv(currentId, c => ({
      ...c,
      messages: c.messages.map(msg => 
        msg.id === messageId ? { ...msg, factCheck: { status: 'verifying' } } : msg
      )
    }));

    try {
      const factCheckResponse = await withRetry(() => getAI().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `You are a Grounded Ledger Auditor for a debate between AI personas.
        Your goal is to distinguish between **Objective Factual Errors** and **Persona Interpretations**.

        Context (Previous Arguments):
        ${context.join('\n\n')}

        Text to Check (Synthesis/Conclusion):
        "${textToCheck}"

        Analyze the text.
        1. **Objective Factual Errors**: Wrong dates, wrong historical events, scientific falsehoods presented as consensus fact.
        2. **Persona Interpretations**: Philosophical claims, theoretical frameworks, or subjective viewpoints that are consistent with the persona but not "objective fact".

        Output Format:
        If there are **Objective Factual Errors**, return exactly:
        STATUS: ERROR
        [List of specific factual corrections]

        If there are **No Factual Errors** but significant **Persona Interpretations** that might be mistaken for fact, return exactly:
        STATUS: INTERPRETATION
        [List of claims that are theoretical interpretations, not objective facts]

        If the text is purely factual and accurate (or correctly attributes interpretations), return exactly:
        STATUS: VERIFIED`,
      }));

      const factCheckText = factCheckResponse.text?.trim() || '';
      
      let status: FactCheck['status'] = 'warning';
      let displayText: string | undefined = factCheckText;

      if (factCheckText.includes('STATUS: VERIFIED')) {
        status = 'verified';
        displayText = undefined;
      } else if (factCheckText.includes('STATUS: INTERPRETATION')) {
        status = 'interpretation';
        displayText = factCheckText.replace('STATUS: INTERPRETATION', '').trim();
      } else if (factCheckText.includes('STATUS: ERROR')) {
        status = 'warning'; // Keep as warning for errors to show alert icon
        displayText = factCheckText.replace('STATUS: ERROR', '').trim();
      }

      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === messageId ? { 
            ...msg, 
            factCheck: { 
              status,
              text: displayText
            } 
          } : msg
        )
      }));
    } catch (fcError: any) {
      console.error('Fact check failed:', fcError);
      if (fcError?.message?.includes('429') || fcError?.message?.includes('RESOURCE_EXHAUSTED')) {
        setShowQuotaError(true);
      }
      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === messageId ? { ...msg, factCheck: { status: 'error', text: 'Fact check failed' } } : msg
        )
      }));
    }
  };

  const handleDeepDive = async (messageId: string, keyword: string) => {
    if (!currentId) return;
    const parentMsg = messages.find(m => m.id === messageId);
    if (!parentMsg) return;

    let activeAgent = getActiveAgent(parentMsg.roleId, currentConv?.roleSettings || settings, currentConv?.mode);
    if (parentMsg.roleId.startsWith('custom-')) {
      const ca = customAgents.find(a => a.id === parentMsg.roleId);
      if (ca) activeAgent = ca;
    }
    
    const deepDiveId = uuidv4();

    updateConv(currentId, c => ({
      ...c,
      messages: c.messages.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            deepDives: [...(msg.deepDives || []), { id: deepDiveId, keyword, text: '', isTyping: true }]
          };
        }
        return msg;
      })
    }));

    try {
      const prompt = `You previously said: "${parentMsg.text}"\n\nThe user wants you to elaborate specifically on the concept of: "${keyword}". Provide a focused, deeper analysis of this specific point, maintaining your persona. Keep it concise, around 100 words.`;
      
      const responseStream = await withRetry(() => getAI().models.generateContentStream({
        model: activeAgent.model || 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: activeAgent.systemInstruction + "\n\nCRITICAL SYSTEM DIRECTIVE: You must output a valid JSON object with EXACTLY two keys: 'provocation' (a short quote under 250 chars) and 'full_analysis' (a deep multi-paragraph breakdown). Do not include markdown blocks.",
          ...getAgentGenerationConfig(0.7),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              full_analysis: {
                type: Type.STRING,
                description: "A deep, multi-paragraph analysis from the persona's worldview."
              },
              provocation: {
                type: Type.STRING,
                description: "A single, punchy, provocative sentence summarizing the core insight."
              }
            },
            required: ["full_analysis", "provocation"]
          }
        },
      }));

      let inputTokens = 0;
      let outputTokens = 0;

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          
          // Real-time extraction for progressive typing
          const partialProvocation = extractPartialField(fullText, 'provocation');
          const partialAnalysis = extractPartialField(fullText, 'full_analysis');
          const hasJsonFields = !!partialProvocation || fullText.includes('"provocation"');

          updateConv(currentId, c => ({
            ...c,
            messages: c.messages.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  deepDives: msg.deepDives?.map(dd => 
                    dd.id === deepDiveId ? { 
                      ...dd, 
                      text: hasJsonFields ? (partialProvocation || "...") : fullText,
                      fullAnalysis: partialAnalysis
                    } : dd
                  )
                };
              }
              return msg;
            })
          }));
        }
        
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount || 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }
      }

      setSessionTokens(prev => ({
        ...prev,
        agentInput: prev.agentInput + inputTokens,
        agentOutput: prev.agentOutput + outputTokens
      }));

      const { provocation, fullAnalysis } = parseAgentResponse(fullText);

      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              deepDives: msg.deepDives?.map(dd => 
                dd.id === deepDiveId ? { ...dd, isTyping: false, text: provocation, fullAnalysis } : dd
              )
            };
          }
          return msg;
        })
      }));

    } catch (error: any) {
      console.error('Error in deep dive:', error);
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        setShowQuotaError(true);
      }
      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              deepDives: msg.deepDives?.map(dd => 
                dd.id === deepDiveId ? { ...dd, text: '[Deep dive failed]', isTyping: false } : dd
              )
            };
          }
          return msg;
        })
      }));
    }
  };

  const handleBranchConversation = (scenarioText: string) => {
    if (!currentConv) return;

    const newId = uuidv4();
    const newConv: Conversation = {
      ...currentConv,
      id: newId,
      parentId: currentConv.id,
      branchConcept: scenarioText,
      title: `Branch: ${currentConv.title}`,
      createdAt: Date.now(),
      messages: [...currentConv.messages]
    };

    setConversations(prev => [newConv, ...prev]);
    setCurrentId(newId);
    setIsBranchModalOpen(false);

    // Trigger AI response with system injection
    handleSend(scenarioText, [], newId, `SCENARIO PIVOT / BLACK SWAN EVENT: The user has injected a new reality into the simulation. You must adapt your entire strategy to this new fact: "${scenarioText}".`);
  };

  const handleSynthesize = async (mode: 'standard' | 'conflict' | 'consensus' | 'executive' = 'standard') => {
    if (!currentId || isProcessing) return;
    
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.roleId === 'synthesizer') return;

    // Find the current group of messages
    let groupStart = messages.length - 1;
    while (groupStart >= 0 && messages[groupStart].roleId !== 'user') {
      groupStart--;
    }
    const userMsg = messages[groupStart];
    const agentMsgs = messages.slice(groupStart + 1);
    
    if (!userMsg || agentMsgs.length === 0) return;

    setIsProcessing(true);
    const synthId = uuidv4();
    
    updateConv(currentId, c => ({
      ...c,
      messages: [...c.messages, { id: synthId, roleId: 'synthesizer', text: '', isTyping: true }]
    }));

    try {
      const synthAgent = getActiveAgent('synthesizer', activeSettings, appMode);
      const context = agentMsgs.map(m => {
        const agent = getActiveAgent(m.roleId, activeSettings, appMode);
        let agentName = agent.name;
        if (m.roleId.startsWith('custom-')) {
          const ca = customAgents.find(a => a.id === m.roleId);
          if (ca) agentName = ca.name;
        }
        return `${agentName}: ${m.text}`;
      }).join('\n\n');

      // -----------------------------------------------------------------------
      // STEP 1: Standalone Fact Checker (Linear Pipeline)
      // -----------------------------------------------------------------------
      let factCheckerResults: any[] = [];
      try {
        const activeAgentNames = activeAgentIds.map(id => {
          if (id.startsWith('custom-')) {
            const ca = customAgents.find(a => a.id === id);
            return ca ? ca.name : id;
          }
          const std = allAvailableAgents.find(a => a.id === id);
          return std ? std.name : id;
        }).join(', ');
        const factCheckResponse = await withRetry(() => getAI().models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: `You are a Grounded Ledger Auditor for a debate between AI personas.
          The following analytical operatives generated this data: ${activeAgentNames}.

          Context (Previous Arguments):
          ${context}

          Extract 2-3 NEW core data points, statistics, or historical precedents mentioned by the operatives. You MUST use Google Search to verify them and provide the actual real-world data. Do not return empty. Do NOT re-verify claims that have already been evaluated in previous rounds.

          IMPORTANT FORMATTING RULE: You MUST output a valid JSON array of objects inside a \`\`\`json markdown block. Do not concatenate words together. Ensure proper spacing between words.

          Use this schema:
          [\n  {\n    "agent": "Name",\n    "claim": "The data point...",\n    "verdict": "VERIFIED" | "DEBUNKED" | "NEEDS CONTEXT",\n    "context": "Actual real-world data from search"\n  }\n]`,
          config: {
            tools: [{ googleSearch: {} }],
            ...getAgentGenerationConfig(0.2, true)
          }
        }));
        
        let parsedResults = resilientJSONParse(factCheckResponse.text || '[]') || [];
        factCheckerResults = parsedResults.filter((f: any) => !f.agent?.toLowerCase().includes('empiricist'));

        // Extract grounding metadata (sources)
        const groundingMetadata = factCheckResponse.candidates?.[0]?.groundingMetadata;
        const sources = groundingMetadata?.groundingChunks?.map((chunk: any) => ({
          title: chunk.web?.title || 'Source',
          url: chunk.web?.uri
        })).filter((s: any) => s.url) || [];

        updateConv(currentId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            msg.id === synthId ? { 
              ...msg, 
              factCheck: { 
                ...msg.factCheck,
                sources: sources as { title: string, url: string }[] 
              } as FactCheck
            } : msg
          )
        }));

      } catch (fcError) {
        console.error("Fact check step failed:", fcError);
        // Continue without fact check results if it fails
      }

      // -----------------------------------------------------------------------
      // STEP 2: Synthesizer (With Injected Facts)
      // -----------------------------------------------------------------------
      const activeAgentNames = activeAgentIds.map(id => {
        if (id.startsWith('custom-')) {
          const ca = customAgents.find(a => a.id === id);
          return ca ? ca.name : id;
        }
        const std = allAvailableAgents.find(a => a.id === id);
        return std ? std.name : id;
      }).join(', ');
      
      let strategyInstruction = "Synthesize these perspectives into a higher-order conclusion.";
      if (mode === 'conflict') {
        strategyInstruction = "STRATEGY: AMPLIFY CONFLICT. Focus strictly on where the agents disagree. Highlight friction points and irreconcilable differences.";
      } else if (mode === 'consensus') {
        strategyInstruction = "STRATEGY: FORCE CONSENSUS. Ruthlessly filter out fringe opinions. Find the mathematical middle ground and shared truths.";
      } else if (mode === 'executive') {
        strategyInstruction = "STRATEGY: EXECUTIVE BRIEF. Format as a cold, bulleted CEO briefing. No philosophical fluff. Actionable intelligence only.";
      }

      let prompt = `User Query: "${userMsg.text}"\n\nCouncil Responses from these analytical operatives: ${activeAgentNames}\n${context}\n\nVERIFIED CONTEXT: You must base your final synthesis on these verified facts: ${JSON.stringify(factCheckerResults)}\n\n${strategyInstruction}\n\nYou must also generate a 'radar_data' array for a 5-axis chart: ["Pragmatism", "Ethics", "Innovation", "Feasibility", "Risk"]. For each axis, assign a score (1-10) for every agent based on their arguments. You must also output an array of 2 to 3 'suggested_next_questions' that identify the most critical unresolved friction points to drive the next iteration of the debate.`;

      if (taskForcePurpose) {
        prompt = `You are moderating a curated panel. The specific goal of this session is: ${taskForcePurpose}. When you generate your final 3 provocative questions (suggested_next_questions), they MUST NOT be generic. They must be aggressively tailored to help the user achieve this specific goal using the friction you just observed between the agents.\n\n${prompt}`;
      }

      const modelName = synthAgent.model || 'gemini-3.1-pro-preview';
      const payload = {
        contents: prompt,
        config: {
          systemInstruction: synthAgent.systemInstruction,
          ...getAgentGenerationConfig(0.7),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              heatmap_summary: { type: Type.STRING, description: "A concise 1-2 sentence summary of the main alignment friction and consensus from the heatmap." },
              heatmap_data: {
                type: Type.ARRAY,
                description: "A flat array of objects representing the alignment score between every pair of agents.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    agent1: { type: Type.STRING },
                    agent2: { type: Type.STRING },
                    score: { type: Type.NUMBER, description: "Alignment score between -1.0 (friction) and 1.0 (consensus)" }
                  },
                  required: ["agent1", "agent2", "score"]
                }
              },
              radar_data: {
                type: Type.ARRAY,
                description: "Scores for 5 axes: Pragmatism, Ethics, Innovation, Feasibility, Risk.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    axis: { type: Type.STRING, enum: ['Pragmatism', 'Ethics', 'Innovation', 'Feasibility', 'Risk'] },
                    agent_scores: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          agent: { type: Type.STRING },
                          score: { type: Type.NUMBER }
                        },
                        required: ["agent", "score"]
                      }
                    }
                  },
                  required: ["axis", "agent_scores"]
                }
              },
              alignment_quotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    agents: { type: Type.ARRAY, items: { type: Type.STRING } },
                    type: { type: Type.STRING, enum: ["friction", "consensus"] },
                    quote: { type: Type.STRING }
                  },
                  required: ["agents", "type", "quote"]
                }
              },
              suggested_next_questions: {
                type: Type.ARRAY,
                description: "2 to 3 suggested next questions based on the most critical unresolved friction points in the current debate.",
                items: { type: Type.STRING }
              },
              whitepaper_markdown: { type: Type.STRING }
            },
            required: ["heatmap_summary", "heatmap_data", "radar_data", "alignment_quotes", "suggested_next_questions", "whitepaper_markdown"]
          },
          tools: [{ googleSearch: {} }]
        },
      };

      const responseStream = await withRetry(() => getAI().models.generateContentStream({
        model: modelName,
        ...payload
      }));

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let groundingSources: any[] = [];

      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          updateConv(currentId, c => ({
            ...c,
            messages: c.messages.map(msg => 
              msg.id === synthId ? { ...msg, text: fullText } : msg
            )
          }));
        }
        
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount || 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }

        // Extract Grounding Metadata
        const candidate = chunk.candidates?.[0];
        if (candidate?.groundingMetadata?.groundingChunks) {
           groundingSources = [
             ...groundingSources, 
             ...candidate.groundingMetadata.groundingChunks
           ];
        }
      }
      
      setSessionTokens(prev => ({
        ...prev,
        synthInput: prev.synthInput + inputTokens,
        synthOutput: prev.synthOutput + outputTokens
      }));
      
      const synthesizerData = parseSynthesizerResponse(fullText);
      
      // Transform radar_data if present
      if (synthesizerData && synthesizerData.radar_data && Array.isArray(synthesizerData.radar_data)) {
        synthesizerData.radar_data = synthesizerData.radar_data.map((item: any) => {
          const newItem: any = { axis: item.axis };
          if (Array.isArray(item.agent_scores)) {
            item.agent_scores.forEach((score: any) => {
              newItem[score.agent] = score.score;
            });
          }
          return newItem;
        });
      }
      
      // Inject the pre-calculated fact check results into the final data object
      if (synthesizerData) {
        synthesizerData.fact_check = factCheckerResults;
        
        // Deduplicate grounding sources (sometimes they stream repeatedly)
        const uniqueSources = new Map();
        groundingSources.forEach(chunk => {
           if (chunk.web?.uri) {
             uniqueSources.set(chunk.web.uri, {
               title: chunk.web.title,
               url: chunk.web.uri
             });
           }
        });
        synthesizerData.grounding_sources = Array.from(uniqueSources.values());
      }
      
      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === synthId ? { ...msg, isTyping: false, synthesizerData } : msg
        )
      }));

      // --- INFOGRAPHIC ARCHITECT STEP (DISABLED) ---
      /*
      try {
        const architectResponse = await getAI().models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: [{ role: 'user', parts: [{ text: INFOGRAPHIC_ARCHITECT_PROMPT.replace('[SYNTHESIZER_TEXT]', fullText) }] }],
        });

        const finalizedPrompt = architectResponse.text;
        if (finalizedPrompt) {
          setPendingInfographicPrompt(finalizedPrompt);
        }
      } catch (archError) {
        console.error("Architect failed:", archError);
      }
      */

    } catch (error: any) {
      console.error('Error synthesizing:', error);
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        setShowQuotaError(true);
      }
      updateConv(currentId, c => ({
        ...c,
        messages: c.messages.map(msg => 
          msg.id === synthId ? { ...msg, text: '[Synthesis failed]', isTyping: false } : msg
        )
      }));
    }
    setIsProcessing(false);
  };

  const handleGenerateInfographic = async (messageId: string, prompt: string) => {
    const activeId = currentId;
    if (!activeId) return;
    setIsGeneratingImage(true);
    try {
      // Use gemini-2.5-flash-image (nano banana) for free tier compatibility
      const result = await getAI().models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });

      // Extract image from response
      let imageUrl = '';
      if (result.candidates?.[0]?.content?.parts) {
        for (const part of result.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }
      } else {
        console.warn("No parts found in candidate content");
      }

      if (imageUrl) {
        updateConv(activeId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            msg.id === messageId ? { ...msg, imageUrl: imageUrl } : msg
          )
        }));
        // Clear the prompt so the button disappears/changes state
        setPendingInfographicPrompt(null);
      } else {
        console.error("Failed to extract image URL from response");
        // Optional: Show error in UI
      }
    } catch (error: any) {
      console.error("Image generation failed:", error);
      // Handle missing API key, unavailable model, or permission denied
      if (
        error?.message?.includes('404') || 
        error?.message?.includes('Requested entity was not found') ||
        error?.message?.includes('403') || 
        error?.message?.includes('PERMISSION_DENIED')
      ) {
        if (window.aistudio?.openSelectKey) {
          await window.aistudio.openSelectKey();
          setShowQuotaError(false); // Reset quota error if it was shown
        }
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDebate = async () => {
    if (!currentId || isProcessing) return;
    
    // Find the current group of messages
    let groupStart = messages.length - 1;
    while (groupStart >= 0 && messages[groupStart].roleId !== 'user') {
      groupStart--;
    }
    const userMsg = messages[groupStart];
    const agentMsgs = messages.slice(groupStart + 1).filter(m => m.roleId !== 'synthesizer');
    
    if (!userMsg || agentMsgs.length === 0) return;

    setIsProcessing(true);

    // Create placeholder messages for the debate round
    const debateRoundIds: { [roleId: string]: string } = {};
    const newMessages: Message[] = [];

    // Only active agents participate in the debate
    const participatingAgents = activeAgentIds.filter(id => id !== 'user' && id !== 'synthesizer');

    const defaultOrder = [
      ...currentRoles.map(r => r.id),
      ...(currentConv?.customAgents || []).map(a => a.id)
    ];
    let order = currentConv?.agentOrder || defaultOrder;
    const missing = defaultOrder.filter(id => !order.includes(id));
    order = [...order, ...missing];

    const sortedParticipatingAgents = [...participatingAgents].sort((a, b) => {
      const orderA = order.indexOf(a);
      const orderB = order.indexOf(b);
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    });

    sortedParticipatingAgents.forEach(roleId => {
      const id = uuidv4();
      debateRoundIds[roleId] = id;
      newMessages.push({ id, roleId, text: '', isTyping: true, isDebate: true });
    });

    updateConv(currentId, c => ({
      ...c,
      messages: [...c.messages, ...newMessages]
    }));

    // Construct the context of all previous responses
    const councilContext = agentMsgs.map(m => {
      const agent = getActiveAgent(m.roleId, activeSettings, appMode);
      return `### ${agent.name}:\n${m.text}`;
    }).join('\n\n');

    // Launch parallel debate generation
    await Promise.all(sortedParticipatingAgents.map(async (roleId) => {
      try {
        const agent = getActiveAgent(roleId, activeSettings, appMode);
        const prompt = `${getDebateRulesStr(currentConv, appMode)}You are ${agent.name}. You and other members of The Council have just analyzed the following problem: "${userMsg.text}".

Here are the exact responses from the other council members:
${councilContext}

Review these arguments strictly through your analytical lens. Identify ONE fundamental flaw, naive assumption, or blind spot in another agent's argument.

Write a concise rebuttal directly addressing that specific agent by name. Defend your worldview against theirs. Do not summarize the arguments; attack the intellectual friction point directly and sharply. Keep it under 200 words.`;

        const responseStream = await withRetry(() => getAI().models.generateContentStream({
          model: agent.model || 'gemini-3-pro-preview',
          contents: prompt,
          config: {
            systemInstruction: agent.systemInstruction + "\n\nCRITICAL SYSTEM DIRECTIVE: You must output a valid JSON object with EXACTLY two keys: 'provocation' (a short quote under 250 chars) and 'full_analysis' (a deep multi-paragraph breakdown). Do not include markdown blocks.",
            ...getAgentGenerationConfig(0.8), // Slightly higher for more spirited debate
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                full_analysis: {
                  type: Type.STRING,
                  description: "A deep, multi-paragraph analysis from the persona's worldview."
                },
                provocation: {
                  type: Type.STRING,
                  description: "A single, punchy, provocative sentence summarizing the core insight."
                }
              },
              required: ["full_analysis", "provocation"]
            }
          },
        }));

        let fullText = '';
        for await (const chunk of responseStream) {
          if (chunk.text) {
            fullText += chunk.text;
            
            // Real-time extraction for progressive typing
            const partialProvocation = extractPartialField(fullText, 'provocation');
            const partialAnalysis = extractPartialField(fullText, 'full_analysis');
            const hasJsonFields = !!partialProvocation || fullText.includes('"provocation"');

            updateConv(currentId, c => ({
              ...c,
              messages: c.messages.map(msg => 
                msg.id === debateRoundIds[roleId] ? { 
                  ...msg, 
                  text: hasJsonFields ? (partialProvocation || "...") : fullText,
                  fullAnalysis: partialAnalysis
                } : msg
              )
            }));
          }
        }
        
        const { provocation, fullAnalysis } = parseAgentResponse(fullText);

        updateConv(currentId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            msg.id === debateRoundIds[roleId] ? { ...msg, isTyping: false, text: provocation, fullAnalysis } : msg
          )
        }));

      } catch (error: any) {
        console.error(`Error debating for ${roleId}:`, error);
        if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
          setShowQuotaError(true);
        }
        updateConv(currentId, c => ({
          ...c,
          messages: c.messages.map(msg => 
            msg.id === debateRoundIds[roleId] ? { ...msg, text: '[Debate failed]', isTyping: false } : msg
          )
        }));
      }
    }));

    setIsProcessing(false);
  };

  const handleModeChange = (mode: 'COUNCIL' | 'LAB') => {
    setAppMode(mode);
    if (currentConv) {
      if (currentConv.messages.length === 0) {
        setConversations(prev => prev.map(c => 
          c.id === currentId ? { ...c, mode, activeAgentIds: (mode === 'LAB' ? LAB_ROLES : ROLES).map(r => r.id) } : c
        ));
      } else {
        const newConv: Conversation = { 
          id: uuidv4(), 
          title: 'New Conversation', 
          messages: [], 
          createdAt: Date.now(), 
          customAgents: [], 
          activeAgentIds: (mode === 'LAB' ? LAB_ROLES : ROLES).map(r => r.id), 
          roleSettings: settings,
          mode,
          debateFormat: 'OPEN',
          pushbackLevel: 'BALANCED'
        };
        setConversations(prev => [newConv, ...prev]);
        setCurrentId(newConv.id);
      }
    }
  };

  const handleClear = () => {
    // Removed confirm for sandbox compatibility
    const newConv = { id: uuidv4(), title: 'New Conversation', messages: [], createdAt: Date.now(), customAgents: [], activeAgentIds: currentRoles.map(r => r.id), roleSettings: settings, mode: appMode };
    setConversations([newConv]);
    setCurrentId(newConv.id);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleAddCustomAgent = (agent: CustomAgent) => {
    if (!currentId) return;
    updateConv(currentId, c => ({
      ...c,
      customAgents: [...c.customAgents, agent],
      activeAgentIds: [...c.activeAgentIds, agent.id]
    }));
    setIsCustomAgentModalOpen(false);
  };

  const handleDeleteCustomAgent = (agentId: string) => {
    if (!currentId) return;
    // Removed confirm for sandbox compatibility
    updateConv(currentId, c => ({
      ...c,
      customAgents: c.customAgents.filter(a => a.id !== agentId),
      activeAgentIds: c.activeAgentIds.filter(id => id !== agentId),
      agentOrder: c.agentOrder ? c.agentOrder.filter(id => id !== agentId) : undefined
    }));
  };

  const handleSelectTaskForce = (taskForce: TaskForce) => {
  if (!currentId) return;

  const newAgents: CustomAgent[] = taskForce.agents.map(agent => {
    // Construct the high-fidelity prompt
    const expandedSystemPrompt = `
You are to embody the authentic intellectual framework, philosophy, and analytical methodology of ${agent.name}. 

1. Core Epistemology & Ontology
• The Primary Thesis: ${agent.profile.epistemology}

2. The Analytical Lens
• The First Question: ${agent.profile.lens}

3. Dialectical & Rhetorical Style
• Style & Tone: ${agent.profile.style}

4. Contextual Boundaries & Blind Spots
• Limitations: ${agent.profile.boundaries}

5. AI Guardrails & Anti-Caricature Constraints
• Authenticity: ${agent.profile.antiCaricature}
• NEVER use standard AI phrasing (e.g., "In conclusion", "It is important to consider").
• Stay in character. If asked about something outside your framework, pivot to your lens.

CRITICAL INSTRUCTION: You must respond ONLY with a raw, valid JSON object. 
Use exactly these keys: {"full_analysis": "...", "provocation": "..."}.
`.trim();

    return {
      id: `custom-${uuidv4()}`,
      thinkerId: `custom-${uuidv4()}`,
      name: agent.name,
      color: ROLES.find(r => r.id === agent.roleId)?.color || '#FFFFFF',
      systemInstruction: expandedSystemPrompt,
      model: 'gemini-3-flash-preview' // I recommend Flash for these structured JSON tasks
    };
  });

  updateConv(currentId, c => ({
    ...c,
    customAgents: [...c.customAgents, ...newAgents],
    activeAgentIds: newAgents.map(a => a.id),
    taskForcePurpose: taskForce.purpose,
    taskForceName: taskForce.name,
    agentOrder: newAgents.map(a => a.id)
  }));

  setIsTaskForceGridOpen(false);
};

  const handleGenerateCustomTaskForce = async (goal: string) => {
    if (!currentId) return;

    try {
      const response = await getAI().models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `The user needs a panel of 3 highly distinct, specialized thinkers (real or archetypal) to debate this topic: '${goal}'. Return a JSON object representing a Task Force.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              purpose: { type: Type.STRING },
              agents: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    roleId: { type: Type.STRING, enum: ['societal', 'cultural', 'researcher', 'tech', 'futurist', 'creative'] },
                    profile: {
                      type: Type.OBJECT,
                      properties: {
                        epistemology: { type: Type.STRING },
                        lens: { type: Type.STRING },
                        style: { type: Type.STRING },
                        boundaries: { type: Type.STRING },
                        antiCaricature: { type: Type.STRING }
                      },
                      required: ["epistemology", "lens", "style", "boundaries", "antiCaricature"]
                    }
                  },
                  required: ["name", "roleId", "profile"]
                }
              }
            },
            required: ["name", "purpose", "agents"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      const parsedTaskForce = JSON.parse(text) as TaskForce;
      parsedTaskForce.id = `auto-${uuidv4()}`;
      
      updateConv(currentId, c => ({
        ...c,
        customTaskForces: [...(c.customTaskForces || []), parsedTaskForce]
      }));
      
      handleSelectTaskForce(parsedTaskForce);
    } catch (error) {
      console.error("Failed to generate custom task force:", error);
    }
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setShowQuotaError(false);
    }
  };

  const extractTextForCanvas = (msg: Message) => {
    // 1. If it's the Synthesizer, parse the JSON and grab the whitepaper
    if (msg.roleId === 'synthesizer') {
      try {
        const cleanJson = msg.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        let text = parsed.whitepaper_markdown || parsed.executive_summary || "Error extracting synthesis.";
        if (parsed.alignment_quotes && Array.isArray(parsed.alignment_quotes)) {
          const quotes = parsed.alignment_quotes.map((q: any) => `> "${q.quote}" - ${q.agent_name}`).join('\n\n');
          text += `\n\n### Alignment Quotes\n\n${quotes}`;
        }
        return text;
      } catch (e) {
        return msg.text;
      }
    }
    
    // 2. If it's a regular agent, combine the headline and the rationale
    let fullText = msg.text; // The headline/provocation
    try {
      const cleanJson = msg.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      const headline = parsed.headline || parsed.provocation || parsed.content || parsed.maxim || parsed.quote || '';
      const rationale = parsed.rationale || parsed.full_analysis || parsed.analysis || '';
      
      if (headline && rationale) {
        fullText = `**${headline}**\n\n${rationale}`;
      } else if (headline) {
        fullText = headline;
      } else if (rationale) {
        fullText = rationale;
      }
    } catch (e) {
      // Not JSON, use raw text
    }
    
    // Add a Brutalist attribution
    const agentName = allAvailableAgents.find(a => a.id === msg.roleId)?.name || 'AGENT';
    return `> [ ${agentName.toUpperCase()} ]\n> ${fullText.split('\n').join('\n> ')}\n\n`;
  };

  const handleAppendToCanvas = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const textToAppend = extractTextForCanvas(msg);
    setCanvasText(prev => prev ? `${prev}\n\n${textToAppend}` : textToAppend);
  };

  const handleUpdateNote = (noteId: string, updates: Partial<MarginNote>) => {
    setMarginNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...updates } : n));
  };

  const handleExtractToBuffer = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const textToAppend = extractTextForCanvas(msg);
    setArtifactBuffer(prev => [...prev, textToAppend]);
  };

  const handleExtractTextToCanvas = (text: string, messageId?: string) => {
    // If it's the same message block, append without double newline
    if (messageId && messageId === lastExtractedBlockId) {
      setCanvasText(prev => prev ? `${prev} ${text}` : text);
    } else {
      setCanvasText(prev => prev ? `${prev}\n\n${text}` : text);
      if (messageId) {
        setLastExtractedBlockId(messageId);
      }
    }
  };

  const handleChatSelection = () => {
    if (isExtractMode) return; // Don't interfere if extract mode is already on
    
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      // Make sure we are selecting within the chat area
      const textContainer = document.getElementById('chat-messages-container');
      if (textContainer && textContainer.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setExtractTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
        setSelectedExtractText(selection.toString().trim());
        setShowExtractTooltip(true);
      } else {
        setShowExtractTooltip(false);
      }
    } else {
      setShowExtractTooltip(false);
    }
  };

  const handleSendSelectionToCanvas = () => {
    if (selectedExtractText) {
      setCanvasText(prev => prev ? `${prev}\n\n${selectedExtractText}` : selectedExtractText);
      setLastExtractedBlockId(null);
    }
    setShowExtractTooltip(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleCanvasSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
      setSelectedCanvasText(selection.toString().trim());
      setShowCanvasTooltip(true);
    } else {
      setShowCanvasTooltip(false);
    }
  };

  const handleSendToNexus = () => {
    const formattedText = `USER DRAFT FOR REVIEW: \n\n'${selectedCanvasText}'\n\nTask Force: Do not rewrite this for me. Attack its assumptions, identify logical fallacies, and provide harsh, productive resistance.`;
    setChatInputValue(formattedText);
    setShowCanvasTooltip(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleTaskForceReview = async () => {
    if (!canvasText.trim()) return;
    setIsReviewingCanvas(true);
    setMarginNotes([]);

    try {
      const ai = getAI();
      const model = activeSettings?.synthesizer?.model || settings?.synthesizer?.model || 'gemini-3-flash-preview';
      
      const systemInstruction = `You are a ruthless Task Force of expert advisors reviewing a document. 
Review the following document. Do not rewrite it entirely. Return a JSON array of 'provocations'. Each object must contain 'quote' (the exact substring from the document you are critiquing), 'agent' (your persona name), 'comment' (your ruthless critique), and 'suggestion' (a concise, direct, improved rewrite of the quote that resolves the critique). Provide 3 to 5 critiques.`;

      const response = await ai.models.generateContent({
        model,
        contents: canvasText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                quote: { type: Type.STRING },
                agent: { type: Type.STRING },
                comment: { type: Type.STRING },
                suggestion: { type: Type.STRING }
              },
              required: ["quote", "agent", "comment", "suggestion"]
            }
          }
        }
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          const newNotes: MarginNote[] = parsed.map((item: any) => ({
            id: uuidv4(),
            quote: item.quote,
            agent: item.agent,
            comment: item.comment,
            suggestion: item.suggestion
          }));
          setMarginNotes(newNotes);
        }
      }
    } catch (error) {
      console.error("Failed to generate task force review:", error);
    } finally {
      setIsReviewingCanvas(false);
    }
  };

  // Group messages by user topic
  const groupedMessages: { userMsg: Message, agentMsgs: Message[], synthMsg: Message | null }[] = [];
  let currentGroup: { userMsg: Message, agentMsgs: Message[], synthMsg: Message | null } | null = null;
  
  for (const msg of messages) {
    if (msg.roleId === 'user') {
      if (currentGroup) groupedMessages.push(currentGroup);
      currentGroup = { userMsg: msg, agentMsgs: [], synthMsg: null };
    } else if (msg.roleId === 'synthesizer') {
      if (currentGroup) currentGroup.synthMsg = msg;
    } else {
      if (currentGroup) currentGroup.agentMsgs.push(msg);
    }
  }
  if (currentGroup) groupedMessages.push(currentGroup);

  const activeSettings = currentConv?.roleSettings || settings;

  const defaultOrder = [
    ...currentRoles.map(r => r.id),
    ...customAgents.map(a => a.id)
  ];
  
  let currentOrder = currentConv?.agentOrder || defaultOrder;
  const missingAgents = defaultOrder.filter(id => !currentOrder.includes(id));
  currentOrder = [...currentOrder, ...missingAgents];

  const allAvailableAgents = currentOrder
    .map(id => {
      if (id.startsWith('custom-')) {
        return customAgents.find(a => a.id === id);
      }
      const role = currentRoles.find(r => r.id === id);
      return role ? getActiveAgent(id, activeSettings, appMode) : undefined;
    })
    .filter(Boolean) as (CustomAgent | ReturnType<typeof getActiveAgent>)[];

  if (conversations.length === 0 || !currentId) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-zinc-500 font-mono text-sm tracking-widest uppercase">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-zinc-800 border-t-zinc-400 rounded-full animate-spin" />
          Loading Nodus...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-zinc-300 font-sans selection:bg-zinc-700 selection:text-[#F4F4F0] overflow-hidden" data-main-layout>
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 bg-zinc-950 border-r border-zinc-800 transform transition-all duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0 lg:ml-0' : '-translate-x-full lg:-ml-64 lg:border-r-0'} lg:static lg:translate-x-0`}>
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <h2 className="font-mono text-sm tracking-widest uppercase text-zinc-500">History</h2>
          <button onClick={createNewConversation} className="p-1 hover:text-[#F4F4F0] transition-colors" title="New Conversation">
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map(c => (
            <div key={c.id} className="relative group flex items-center">
              <button 
                onClick={() => { setCurrentId(c.id); setIsSidebarOpen(false); }}
                className={`w-full text-left p-3 pr-10 text-sm font-mono truncate transition-colors flex items-center gap-2 ${c.id === currentId ? 'bg-zinc-900 text-[#F4F4F0]' : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'}`}
              >
                {c.parentId && <GitBranch size={12} className="shrink-0 text-[#E03C31]" />}
                <span className="truncate">{c.title}</span>
                {c.retrospective && (
                  <div className="flex items-center gap-1 ml-auto shrink-0 mr-1" title="Resolution Recorded">
                    <Check size={12} className="text-green-500" />
                  </div>
                )}
              </button>
              <button
                onClick={(e) => handleDeleteConversation(c.id, e)}
                className="absolute right-2 p-1.5 text-zinc-600 hover:text-[#E03C31] hover:bg-zinc-800 rounded opacity-0 group-hover:opacity-100 transition-all"
                title="Delete Session"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-black">
        
        {/* Background Layers */}
        <div className="absolute inset-0 z-0 bg-black pointer-events-none"></div>
        <div className="absolute inset-0 z-0 ambient-glow pointer-events-none"></div>
        <div className="absolute inset-0 z-0 bg-dot-pattern pointer-events-none"></div>
        <div className="absolute inset-0 z-0 bg-grain mix-blend-overlay pointer-events-none"></div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 py-4 bg-[#09090b] border-b-4 border-[#E03C31] shrink-0 w-full overflow-x-auto whitespace-nowrap snap-x hide-scrollbar">
          
          {/* Left Side: Logo & Name */}
          <div className="flex items-center gap-4 snap-start shrink-0">
            <button className="p-2 -ml-2 text-[#F4F4F0] hover:text-[#FFD100]" onClick={() => setIsSidebarOpen(prev => !prev)}>
              <Menu size={20} />
            </button>
            <NodusLogo className="w-10 h-10 shrink-0" />
            <h1 className="text-3xl font-black uppercase tracking-tighter text-[#F4F4F0] leading-none">
              NODUS
            </h1>
            
            {/* Vertical Divider */}
            <div className="w-1 h-6 bg-[#005A9C] ml-4 shrink-0 hidden sm:block"></div>
            
            {/* Subtitle / Engine Status */}
            <span className="text-xs font-mono uppercase tracking-widest text-[#FFD100] ml-4 shrink-0 hidden sm:block">
              Strategic Dialectic Engine
            </span>
            
            {/* Mode Switcher */}
            <div className="ml-4 flex items-center bg-[#09090b] rounded-full p-1 border border-[#005A9C] shrink-0">
              <button
                onClick={() => handleModeChange('COUNCIL')}
                className={`px-3 py-1 text-xs font-mono font-bold tracking-widest uppercase rounded-full transition-colors ${appMode === 'COUNCIL' ? 'bg-[#F4F4F0] text-[#09090b]' : 'text-[#F4F4F0] hover:text-[#FFD100]'}`}
              >
                Council
              </button>
              <button
                onClick={() => handleModeChange('LAB')}
                className={`px-3 py-1 text-xs font-mono font-bold tracking-widest uppercase rounded-full transition-colors ${appMode === 'LAB' ? 'bg-[#FFD100] text-[#09090b]' : 'text-[#F4F4F0] hover:text-[#FFD100]'}`}
              >
                Lab
              </button>
            </div>
          </div>

          {/* Right Side: Global Controls */}
          <div className="flex items-center gap-2 shrink-0 snap-end ml-4">
            <button 
              onClick={() => handleExport()}
              className="p-2 text-[#F4F4F0] hover:text-[#FFD100] transition-colors shrink-0"
              title="Export Conversation"
            >
              <Download size={18} />
            </button>
            {appMode === 'COUNCIL' && (
              <button 
                onClick={() => setIsTaskForceGridOpen(true)}
                className="p-2 text-[#F4F4F0] hover:text-[#FFD100] transition-colors shrink-0"
                title="Select Task Force"
              >
                <Grid size={18} />
              </button>
            )}
            <button 
              onClick={() => setIsCustomAgentModalOpen(true)}
              className="p-2 text-[#F4F4F0] hover:text-[#FFD100] transition-colors shrink-0"
              title="Add Custom Thinker to Session"
            >
              <UserPlus size={18} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-[#F4F4F0] hover:text-[#FFD100] transition-colors shrink-0"
              title="Settings"
            >
              <Settings size={18} />
            </button>
            <button 
              onClick={handleClear}
              className="p-2 text-[#F4F4F0] hover:text-[#E03C31] transition-colors shrink-0"
              title="Clear All History"
            >
              <Trash2 size={18} />
            </button>
          </div>
          
        </header>

        {/* Split Screen Container */}
        <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden relative z-10">
          
          {/* Left Column: Chat */}
          <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-zinc-800">
            {/* Chat Area */}
            <main 
               className="flex-1 overflow-y-auto p-4 md:p-8 relative" 
               id="chat-messages-container"
               onMouseUp={handleChatSelection}
               onKeyUp={handleChatSelection}
            >

              {showExtractTooltip && (
                <div 
                  className="fixed z-50 transform -translate-x-1/2 -translate-y-full pb-2"
                  style={{ left: extractTooltipPos.x, top: extractTooltipPos.y }}
                >
                  <button 
                    onClick={handleSendSelectionToCanvas}
                    className="px-3 py-1.5 bg-[#F2A900] text-black text-[10px] font-mono font-bold uppercase tracking-widest rounded shadow-[0_0_15px_rgba(242,169,0,0.4)] hover:bg-[#FFD100] transition-colors whitespace-nowrap"
                  >
                    Extract to Canvas
                  </button>
                </div>
              )}

              {showQuotaError && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-full">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-400 uppercase tracking-wider">Quota Exceeded</p>
                  <p className="text-xs text-red-300/70">The shared API key has hit its limit. Connect your own key to continue.</p>
                </div>
              </div>
              <button 
                onClick={handleOpenKeyDialog}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-[#F4F4F0] text-xs font-bold uppercase tracking-widest transition-colors rounded"
              >
                Select API Key
              </button>
            </motion.div>
          )}

          {messages.length === 0 ? (
            <EmptyState>
              {appMode === 'COUNCIL' && (
                <div className="space-y-4 w-full text-left mt-6">
                  <details className="group border border-zinc-800/50 bg-[#09090b] open:bg-zinc-900/30 transition-colors">
                    <summary className="cursor-pointer p-3 flex items-center justify-between text-[10px] md:text-xs tracking-widest uppercase text-zinc-500 hover:text-zinc-300 list-none outline-none">
                      <span className="flex items-center gap-2">
                        <Settings2 size={14} />
                        Debate Configuration
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-600 hidden md:inline">
                          [{currentConv?.debateFormat || 'OPEN'} / {(currentConv?.pushbackLevel || 'BALANCED').replace('_', ' ')}]
                        </span>
                        <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                      </div>
                    </summary>
                    <div className="p-4 border-t border-zinc-800/50 space-y-6 text-xs md:text-sm font-mono tracking-wide text-zinc-300">
                      <div className="space-y-3">
                         <label className="text-zinc-500 uppercase text-[10px] tracking-widest">Format Protocol</label>
                         <select 
                           value={currentConv?.debateFormat || 'OPEN'} 
                           onChange={(e) => currentId && updateConv(currentId, c => ({ ...c, debateFormat: e.target.value as any }))}
                           className="w-full bg-black border border-zinc-800 p-2 text-zinc-300 outline-none focus:border-zinc-500 appearance-none rounded-none cursor-pointer"
                         >
                           <option value="OPEN">Standard Open Debate</option>
                           <option value="OXFORD">Oxford-Style (Structured)</option>
                           <option value="SOCRATIC">Socratic Questioning</option>
                         </select>
                      </div>
                      
                      <div className="space-y-3">
                         <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-500">
                           <label>Pushback Severity</label>
                           <span className="text-[#E03C31] font-bold">{
                             (currentConv?.pushbackLevel || 'BALANCED') === 'COLLABORATIVE' ? 'Collaborative' :
                             (currentConv?.pushbackLevel || 'BALANCED') === 'BALANCED' ? 'Balanced' : "Devil's Advocate"
                           }</span>
                         </div>
                         <input 
                           type="range" 
                           min="0" max="2" step="1"
                           value={
                             (currentConv?.pushbackLevel || 'BALANCED') === 'COLLABORATIVE' ? 0 :
                             (currentConv?.pushbackLevel || 'BALANCED') === 'BALANCED' ? 1 : 2
                           }
                           onChange={(e) => {
                             const val = e.target.value;
                             const level = val === '0' ? 'COLLABORATIVE' : val === '1' ? 'BALANCED' : 'DEVILS_ADVOCATE';
                             currentId && updateConv(currentId, c => ({ ...c, pushbackLevel: level as any }))
                           }}
                           className="w-full accent-[#E03C31] h-1 bg-zinc-800 rounded-none appearance-none cursor-pointer"
                         />
                         <div className="flex justify-between text-[9px] uppercase tracking-wider text-zinc-600">
                           <span>Synthesis</span>
                           <span>Balanced</span>
                           <span>Hostile</span>
                         </div>
                      </div>
                    </div>
                  </details>

                  <button
                    onClick={() => setIsTaskForceGridOpen(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#09090b] border-2 border-[#E03C31] hover:bg-[#E03C31] text-[#F4F4F0] transition-all font-mono text-xs uppercase tracking-widest w-full"
                  >
                    <Grid size={16} />
                    Select Task Force
                  </button>
                </div>
              )}
            </EmptyState>
          ) : (
            <div className="max-w-6xl mx-auto w-full space-y-16">
              
              {/* Active Protocol Header */}
              {appMode === 'COUNCIL' && currentConv && (
                <div className="flex items-center gap-4 border-b border-zinc-800/50 pb-4 mt-6">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    Protocol: <span className="text-[#F4F4F0] leading-none">{currentConv.debateFormat || 'OPEN'}</span>
                  </div>
                  <div className="text-zinc-800">/</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    Resistance: <span className="text-[#E03C31] leading-none">{(currentConv.pushbackLevel || 'BALANCED').replace('_', ' ')}</span>
                  </div>
                </div>
              )}

              {groupedMessages.map((group, i) => (
                <div key={group.userMsg.id} className="space-y-6">
                  {/* User Message */}
                  <div className="w-full">
                    <ChatMessage 
                      id={group.userMsg.id}
                      roleId={group.userMsg.roleId} 
                      text={group.userMsg.text} 
                      settings={activeSettings}
                      attachments={group.userMsg.attachments}
                      tokenCount={group.userMsg.tokenCount}
                    />
                  </div>

                  {/* Agent Grid */}
                  {group.agentMsgs.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      <AnimatePresence>
                        {group.agentMsgs.map((msg, index) => {
                          // Check if this is the start of a debate block
                          const isFirstDebateMsg = msg.isDebate && (index === 0 || !group.agentMsgs[index - 1]?.isDebate);
                          
                          return (
                            <React.Fragment key={msg.id}>
                              {isFirstDebateMsg && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="col-span-full flex items-center gap-4 py-8"
                                >
                                  <div className="h-px bg-red-900/50 flex-1"></div>
                                  <div className="flex items-center gap-2 text-red-500 font-mono text-sm tracking-widest uppercase">
                                    <RefreshCw size={16} className="animate-spin-slow" />
                                    <span>Debate Initiated</span>
                                  </div>
                                  <div className="h-px bg-red-900/50 flex-1"></div>
                                </motion.div>
                              )}
                              <ChatMessage 
                                id={msg.id}
                                roleId={msg.roleId} 
                                text={msg.text} 
                                isTyping={msg.isTyping} 
                                settings={activeSettings}
                                deepDives={msg.deepDives}
                                onDeepDive={handleDeepDive}
                                customAgents={customAgents}
                                onRetry={handleRetry}
                                onParameterChange={handleParameterChange}
                                fullAnalysis={msg.fullAnalysis}
                                tokenCount={msg.tokenCount}
                                onRebuttal={handleRebuttal}
                                availableAgents={activeAgentIds}
                                allAgentsList={allAvailableAgents}
                                rebuttals={msg.rebuttals}
                                imageUrl={msg.imageUrl}
                                onAppendToCanvas={handleAppendToCanvas}
                                isExtractMode={isExtractMode}
                                onExtractText={handleExtractTextToCanvas}
                                onExtractToBuffer={handleExtractToBuffer}
                              />
                            </React.Fragment>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Synthesizer */}
                  {group.synthMsg && (
                    <div className="w-full mt-8">
                      <ChatMessage 
                        id={group.synthMsg.id}
                        roleId={group.synthMsg.roleId} 
                        text={group.synthMsg.text} 
                        isTyping={group.synthMsg.isTyping}
                        settings={activeSettings}
                        factCheck={group.synthMsg.factCheck}
                        onRetry={handleRetry}
                        onRegenerateWithFactCheck={handleRegenerateWithFactCheck}
                        synthesizerData={group.synthMsg.synthesizerData}
                        fullAnalysis={group.synthMsg.fullAnalysis}
                        tokenCount={group.synthMsg.tokenCount}
                        sessionTokens={sessionTokens}
                        pendingInfographicPrompt={pendingInfographicPrompt}
                        isGeneratingImage={isGeneratingImage}
                        onGenerateInfographic={handleGenerateInfographic}
                        imageUrl={group.synthMsg.imageUrl}
                        onAppendToCanvas={handleAppendToCanvas}
                        isExtractMode={isExtractMode}
                        onExtractText={handleExtractTextToCanvas}
                        onExtractToBuffer={handleExtractToBuffer}
                        onActionClick={(q) => handleSend(q)}
                      />
                    {!group.synthMsg.isTyping && (
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-center">
                           <button 
                            onClick={() => setIsRetrospectiveModalOpen(true)}
                            className={`p-4 transition-all w-full max-w-sm flex items-center justify-center gap-3 border font-mono text-xs tracking-widest uppercase shadow-lg ${
                              currentConv.retrospective 
                              ? 'border-green-500/50 text-green-500 bg-green-500/5' 
                              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-[#F4F4F0] hover:border-zinc-400 hover:bg-zinc-800'
                            }`}
                            title="Resolve Session / Evaluate"
                          >
                            {currentConv.retrospective ? (
                                <Check size={16} className="animate-pulse" />
                            ) : (
                                <Star size={16} />
                            )}
                            {currentConv.retrospective ? 'Resolution Recorded' : 'Resolve Session & Evaluate'}
                          </button>
                        </div>
                        <ExportArtifactBlock 
                          conversation={currentConv} 
                          onExport={() => handleExport('md')} 
                          onExportHTML={handleExportHTML}
                          onCopyText={handleCopyText}
                          onExportCanvas={handleExportCanvas} 
                        />
                      </div>
                    )}
                    </div>
                  )}

                  {/* Synthesize and Debate Buttons */}
                  {i === groupedMessages.length - 1 && showSynthesize && !group.synthMsg && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center mt-8 gap-4"
                    >
                      <div className="flex gap-4">
                        <button
                          onClick={() => setIsBranchModalOpen(true)}
                          className="px-8 py-4 bg-zinc-900 border border-[#E03C31]/50 text-[#E03C31] font-mono font-bold uppercase tracking-widest hover:bg-[#E03C31]/20 transition-colors flex items-center gap-2"
                        >
                          <GitBranch size={18} />
                          Inject Black Swan
                        </button>
                        <button
                          onClick={handleDebate}
                          className="px-8 py-4 bg-zinc-900 border border-zinc-700 text-[#F4F4F0] font-mono font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        >
                          <RefreshCw size={18} />
                          Debate
                        </button>
                        <button
                          onClick={() => handleSynthesize('standard')}
                          className="px-8 py-4 bg-[#F4F4F0] text-black font-mono font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center gap-2"
                        >
                          <Download size={18} />
                          Synthesize
                        </button>
                      </div>
                      
                      {/* Pivot Chips */}
                      <div className="flex gap-6 mt-4">
                        <div className="flex flex-col items-center gap-2 max-w-[200px] text-center">
                          <button
                            onClick={() => handleSynthesize('conflict')}
                            className="px-4 py-2 rounded-full border border-[#E03C31]/50 text-[#E03C31] hover:bg-[#E03C31]/10 text-[10px] font-mono uppercase tracking-widest transition-colors"
                          >
                            Conflict
                          </button>
                          <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest leading-relaxed">
                            "AMPLIFY CONFLICT. Focus strictly on where the agents disagree."
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-2 max-w-[200px] text-center">
                          <button
                            onClick={() => handleSynthesize('consensus')}
                            className="px-4 py-2 rounded-full border border-[#005A9C]/50 text-[#005A9C] hover:bg-[#005A9C]/10 text-[10px] font-mono uppercase tracking-widest transition-colors"
                          >
                            Consensus
                          </button>
                          <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest leading-relaxed">
                            "FORCE CONSENSUS. Ruthlessly filter out fringe opinions."
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-2 max-w-[200px] text-center">
                          <button
                            onClick={() => handleSynthesize('executive')}
                            className="px-4 py-2 rounded-full border border-[#FFD100]/50 text-[#FFD100] hover:bg-[#FFD100]/10 text-[10px] font-mono uppercase tracking-widest transition-colors"
                          >
                            Executive
                          </button>
                          <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest leading-relaxed">
                            "EXECUTIVE BRIEF. Format as a cold, bulleted CEO briefing."
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Persistent Bottom Bar (Mobile Only) */}
        <div 
          className="lg:hidden sticky bottom-0 z-20 w-full bg-[#141414] border-t-2 border-[#005A9C] p-3 text-center cursor-pointer shadow-[0_-10px_20px_rgba(0,0,0,0.5)]"
          onClick={() => {
            if (canvasText.trim() === '' && artifactBuffer.length > 0) {
              setCanvasText(artifactBuffer.join('\n\n'));
              setArtifactBuffer([]);
            }
            setIsCanvasOpen(true);
          }}
        >
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#F4F4F0]">
            [ ARTIFACT BUFFER: {artifactBuffer.length} FRAGMENTS ]
          </span>
        </div>

        {/* Input Area */}
        <div className="relative z-10 shrink-0 w-full bg-black/70 backdrop-blur-md border-t border-[#F4F4F0]/5">
          <div className="max-w-6xl mx-auto">
            {/* Active Roster Button */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800/50 w-full overflow-hidden">
              
              {/* Left side wrapper - added w-full and flex-1 so it handles text overflow gracefully */}
              <div className="flex items-center gap-3 w-full flex-1 min-w-0">
                
                {/* Roster Button - added shrink-0 so it never squishes */}
                <button 
                  onClick={() => setIsRosterOpen(true)}
                  className="flex items-center gap-1.5 text-[10px] sm:text-xs font-mono uppercase tracking-widest text-zinc-400 hover:text-[#F4F4F0] transition-colors shrink-0"
                >
                  <Users size={14} />
                  <span className="hidden sm:inline">Thinkers</span> Active ({activeAgentIds.length})
                </button>
                
                {/* Active Task Force Indicator */}
                {appMode !== 'LAB' && currentConv?.taskForceName && (
                  <>
                    <div className="w-px h-3 bg-zinc-700 shrink-0"></div>
                    {/* Added truncate so long names end with '...' instead of wrapping to a new line */}
                    <span className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-[#005A9C] flex items-center gap-1.5 truncate min-w-0" title={currentConv.taskForceName}>
                      <Grid size={12} className="shrink-0" />
                      <span className="truncate">{currentConv.taskForceName}</span>
                    </span>
                  </>
                )}
                
              </div>
            </div>
<ChatInput 
  onSend={handleSend} 
  onSuggest={handleSuggestExperts}
  disabled={isProcessing} 
  isSuggesting={isSuggesting}
  // Visuals: If in LAB, force it to look enabled (green). Otherwise, use user preference.
  isNewsModeEnabled={appMode === 'LAB' || isNewsModeEnabled}
  // Action: Always pass a function so the button renders, but make it do nothing in LAB mode.
  onToggleNewsMode={() => {
    if (appMode === 'COUNCIL') setIsNewsModeEnabled(!isNewsModeEnabled);
  }}
  isExtractMode={isExtractMode}
  onToggleExtractMode={() => setIsExtractMode(!isExtractMode)}
  isDesktopCanvasOpen={isDesktopCanvasOpen}
  onToggleDesktopCanvas={() => setIsDesktopCanvasOpen(!isDesktopCanvasOpen)}
  appMode={appMode}
  value={chatInputValue}
  onChange={setChatInputValue}
/>
            </div>
          </div>
        </div>

        {/* Resizer Handle */}
        {isDesktopCanvasOpen && (
          <div
            className={`hidden lg:block w-2 cursor-col-resize z-20 shrink-0 transition-colors ${isDraggingCanvas ? 'bg-[#E03C31]' : 'bg-transparent hover:bg-zinc-800'}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingCanvas(true);
            }}
          />
        )}

        {/* Right Column: Canvas */}
        {isDesktopCanvasOpen && (
          <div 
             data-canvas-container="true"
             className={`hidden lg:flex flex-col h-full bg-[#F4F4F0] text-black relative ${isDraggingCanvas ? '' : 'transition-all duration-300'}`}
             style={{ width: `${canvasWidth}%` }}
          >
            <CanvasEditor
              text={canvasText}
              onChange={setCanvasText}
              onSelection={handleCanvasSelection}
              notes={marginNotes}
              isReviewing={isReviewingCanvas}
              onRequestReview={handleTaskForceReview}
              onUpdateNote={handleUpdateNote}
            />
            {showCanvasTooltip && (
              <div 
                className="fixed z-50 transform -translate-x-1/2 -translate-y-full pb-2"
                style={{ left: tooltipPos.x, top: tooltipPos.y }}
              >
                <button 
                  onClick={handleSendToNexus}
                  className="px-3 py-1.5 bg-black text-[#F4F4F0] text-[10px] font-mono font-bold uppercase tracking-widest rounded shadow-lg hover:bg-zinc-800 transition-colors whitespace-nowrap"
                >
                  Send to Nexus
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Branch Modal */}
      <BranchModal 
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        onBranch={handleBranchConversation}
        context={messages.map(m => `${m.roleId}: ${m.text}`).join('\n')}
        onTokenUsage={(usage) => setSessionTokens(prev => ({
          ...prev,
          agentInput: prev.agentInput + usage.input,
          agentOutput: prev.agentOutput + usage.output
        }))}
      />

      <RetrospectiveModal 
        isOpen={isRetrospectiveModalOpen}
        onClose={() => setIsRetrospectiveModalOpen(false)}
        onSave={handleSaveRetrospective}
        sessionTitle={currentConv?.title || 'Current Session'}
      />

      {/* Roster Modal */}
      {isRosterOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setIsRosterOpen(false)}>
          <div 
            className="bg-zinc-950 border border-zinc-800 w-full md:w-[400px] max-h-[80vh] flex flex-col shadow-2xl rounded-t-2xl md:rounded-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="font-mono text-sm tracking-widest uppercase text-[#F4F4F0]">Active Roster</h3>
              <button onClick={() => setIsRosterOpen(false)} className="text-zinc-500 hover:text-[#F4F4F0]"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto overflow-x-hidden flex flex-col gap-2">
              {allAvailableAgents.map((agent, index) => {
                const isActive = activeAgentIds.includes(agent.id);
                return (
                  <div key={agent.id} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex-1 min-w-0 text-left px-4 py-3 text-sm font-mono uppercase tracking-wider border transition-colors flex items-center gap-3 ${isActive ? 'bg-zinc-900 border-zinc-700 text-[#F4F4F0]' : 'bg-black border-zinc-900 text-zinc-600 hover:text-zinc-400'}`}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: isActive ? agent.color : '#333' }} />
                      <span className="truncate block w-full">{agent.name}</span>
                    </button>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveAgent(agent.id, 'left')}
                        disabled={index === 0}
                        className="p-1 bg-black border border-zinc-900 text-zinc-500 hover:text-[#F4F4F0] hover:bg-zinc-900 transition-colors disabled:opacity-30"
                        title="Move Up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => moveAgent(agent.id, 'right')}
                        disabled={index === allAvailableAgents.length - 1}
                        className="p-1 bg-black border border-zinc-900 text-zinc-500 hover:text-[#F4F4F0] hover:bg-zinc-900 transition-colors disabled:opacity-30"
                        title="Move Down"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => setEditingAgentId(agent.id)}
                      className="p-3 bg-black border border-zinc-900 text-zinc-500 hover:text-[#F4F4F0] hover:bg-zinc-900 transition-colors h-full flex items-center"
                      title="Edit Persona"
                    >
                      <Settings2 size={18} />
                    </button>
                    {agent.id.startsWith('custom-') && (
                      <button
                        onClick={() => handleDeleteCustomAgent(agent.id)}
                        className="p-3 bg-black border border-zinc-900 text-zinc-500 hover:text-red-500 hover:bg-zinc-900 transition-colors h-full flex items-center"
                        title="Delete Persona"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                );
              })}
              
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-left px-4 py-3 text-sm font-mono uppercase tracking-wider border bg-zinc-900 border-zinc-700 text-[#F4F4F0] flex items-center gap-3 opacity-80 cursor-not-allowed">
                    <div className="w-3 h-3 rounded-full bg-[#F4F4F0]" />
                    The Synthesizer (Always Active)
                  </div>
                  <button
                    onClick={() => setEditingAgentId('synthesizer')}
                    className="p-3 bg-black border border-zinc-900 text-zinc-500 hover:text-[#F4F4F0] hover:bg-zinc-900 transition-colors"
                    title="Edit Synthesizer"
                  >
                    <Settings2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Force Grid Modal */}
      {isTaskForceGridOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md overflow-y-auto p-4" onClick={() => setIsTaskForceGridOpen(false)}>
          <div 
            className="w-full max-w-7xl relative bg-black/50 rounded-xl p-4 max-h-[85vh] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8 px-4">
              <div>
                <h2 className="text-2xl font-mono font-bold uppercase tracking-widest text-[#F4F4F0]">Select Task Force</h2>
                <p className="text-zinc-500 font-mono text-sm mt-2">Choose a curated panel to analyze your problem.</p>
              </div>
              <button 
                onClick={() => setIsTaskForceGridOpen(false)}
                className="p-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-500 hover:text-[#F4F4F0] transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <TaskForceGrid 
              onSelect={handleSelectTaskForce} 
              onGenerate={handleGenerateCustomTaskForce} 
              customTaskForces={currentConv?.customTaskForces || []} 
            />
          </div>
        </div>
      )}


      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={activeSettings} 
        onSettingsChange={(newSettings) => {
          if (currentId) {
            updateConv(currentId, c => ({ ...c, roleSettings: newSettings }));
          } else {
            setSettings(newSettings);
          }
        }} 
        appMode={appMode}
      />

      <CustomAgentModal
        isOpen={isCustomAgentModalOpen}
        onClose={() => setIsCustomAgentModalOpen(false)}
        onAdd={handleAddCustomAgent}
      />

      <EditPersonaModal
        isOpen={!!editingAgentId}
        onClose={() => setEditingAgentId(null)}
        agentId={editingAgentId}
        roleSettings={activeSettings}
        customAgents={customAgents}
        appMode={appMode}
        onUpdateRole={(roleId, newRoleSettings) => {
          if (currentId) {
            updateConv(currentId, c => ({
              ...c,
              roleSettings: { ...(c.roleSettings || settings), [roleId]: newRoleSettings }
            }));
          }
        }}
        onUpdateCustomAgent={(agent) => {
          if (currentId) {
            updateConv(currentId, c => ({
              ...c,
              customAgents: c.customAgents.map(a => a.id === agent.id ? agent : a)
            }));
          }
        }}
      />

      {/* Canvas Modal (Mobile Only) */}
      <AnimatePresence>
        {isCanvasOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-[#09090b] flex flex-col lg:hidden"
          >
            {/* Brutalist Header */}
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-black">
              <button 
                onClick={() => setIsCanvasOpen(false)}
                className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 hover:text-[#F4F4F0] px-4 py-2 border border-zinc-800 transition-colors"
              >
                [ CLOSE ]
              </button>
              <button 
                onClick={() => {
                  const blob = new Blob([canvasText], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'nexus-draft.md';
                  a.click();
                }}
                className="text-[10px] font-mono font-bold uppercase tracking-widest text-black bg-[#F2A900] px-4 py-2 hover:bg-[#FFD100] transition-colors"
              >
                [ EXPORT .MD ]
              </button>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 relative">
              <CanvasEditor
                text={canvasText}
                onChange={setCanvasText}
                onSelection={handleCanvasSelection}
                notes={marginNotes}
                isReviewing={isReviewingCanvas}
                onRequestReview={handleTaskForceReview}
                onUpdateNote={handleUpdateNote}
                theme="dark"
              />
              {showCanvasTooltip && (
                <div 
                  className="absolute z-50 transform -translate-x-1/2 -translate-y-full pb-2"
                  style={{ left: tooltipPos.x, top: tooltipPos.y }}
                >
                  <button 
                    onClick={handleSendToNexus}
                    className="px-3 py-1.5 bg-black text-[#F4F4F0] text-[10px] font-mono font-bold uppercase tracking-widest rounded shadow-lg border border-zinc-700 hover:bg-zinc-800 transition-colors whitespace-nowrap"
                  >
                    Send to Nexus
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
 