import React from 'react';
import ReactECharts from 'echarts-for-react';
import Markdown from 'react-markdown';
import { motion } from 'framer-motion';
import { BrutalistHeatmap } from './BrutalistHeatmap';
import { SpectrumRadar } from './SpectrumRadar';
import { LAB_ROLES, ROLES } from '../agents';
import { ExtractableText } from './ExtractableText';

interface AlignmentQuote {
  agents: string[];
  type: 'friction' | 'consensus';
  quote: string;
}

interface FactCheckItem {
  agent: string;
  claim: string;
  verdict: 'VERIFIED' | 'DEBUNKED' | 'NEEDS CONTEXT';
  context: string;
}

interface HeatmapDataPoint {
  agent1: string;
  agent2: string;
  score: number;
}

interface RadarDataPoint {
  axis: string;
  [agentName: string]: string | number;
}

interface SynthesizerData {
  // New 4-part dashboard format
  heatmap_data?: HeatmapDataPoint[];
  radar_data?: RadarDataPoint[];
  alignment_quotes?: AlignmentQuote[];
  fact_check?: FactCheckItem[];
  whitepaper_markdown?: string;
  grounding_sources?: { title: string, url: string }[];
  suggested_next_questions?: string[];
  
  // Legacy formats (kept for safety)
  echarts_heatmap?: any;
  echarts_config?: any;
  whitepaper?: string;
  echartsData?: any; 
  graphData?: any[]; 
  ui_text_insights?: any;
}

interface SynthesizerProps {
  data: SynthesizerData;
  sessionTokens?: { agentInput: number, agentOutput: number, synthInput: number, synthOutput: number };
  isExtractMode?: boolean;
  onExtractText?: (text: string) => void;
  onActionClick?: (question: string) => void;
}

export function Synthesizer({ data, sessionTokens, isExtractMode, onExtractText, onActionClick }: SynthesizerProps) {
  if (!data) return null;

  // Extract unique agents for the heatmap if data exists
  const heatmapAgents = React.useMemo(() => {
    if (!data.heatmap_data) return [];
    const agents = new Set<string>();
    data.heatmap_data.forEach(d => {
      agents.add(d.agent1);
      agents.add(d.agent2);
    });
    return Array.from(agents).sort();
  }, [data.heatmap_data]);

  // Extract agent colors for the radar chart
  const agentColors = React.useMemo(() => {
    const colors: Record<string, string> = {};
    const allRoles = [...ROLES, ...LAB_ROLES];
    allRoles.forEach(role => {
      role.thinkers.forEach(thinker => {
        colors[thinker.name] = role.color;
      });
    });
    return colors;
  }, []);

  // ---------------------------------------------------------------------------
  // NEW: 4-Part Dashboard (Heatmap, Quotes, Fact Check, Whitepaper)
  // ---------------------------------------------------------------------------
  if (data.heatmap_data || data.radar_data || data.echarts_heatmap || data.fact_check || data.alignment_quotes) {
    return (
      <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto p-6 bg-[#0a0a0a] text-[#F4F4F0] rounded-xl shadow-2xl border border-[#F4F4F0]/10 font-mono">
        
        {/* Header Section */}
        <div className="border-b border-[#F4F4F0]/20 pb-6 relative mb-8">
          {/* Status Indicator */}
          <div className="text-xs font-mono text-[#BFFF00] mb-2 md:mb-0 md:absolute md:top-0 md:right-0 text-left md:text-right">
            [ SYSTEM STATUS: ONLINE ]
          </div>

          {/* Title */}
          <h2 className="text-3xl font-black uppercase tracking-tighter text-[#F4F4F0] mb-2">
            <span className="text-[#BFFF00] mr-4">///</span>
            Synthesizer Dashboard
          </h2>
          <div className="text-xs text-gray-400 uppercase tracking-widest">
            Meta-Analysis // Verification // Topology
          </div>
        </div>

        {/* TOP SECTION: Spectrum Radar */}
        {data.radar_data && data.radar_data.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            className="mb-8"
          >
            <SpectrumRadar data={data.radar_data} agentColors={agentColors} />
          </motion.div>
        )}

        {/* MIDDLE SECTION: The Synthesis (Whitepaper) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          className="mb-8"
        >
          <h3 className="text-xs font-bold text-[#33FFFF] uppercase tracking-widest mb-4 border-l-2 border-[#33FFFF] pl-3">
            [ 01 ] Final Synthesis
          </h3>
          <div className="prose prose-invert prose-lg max-w-none text-gray-300">
            {isExtractMode && onExtractText ? (
              <ExtractableText text={data.whitepaper_markdown || data.whitepaper || ''} isExtractMode={isExtractMode} onExtract={onExtractText} />
            ) : (
              <Markdown>{data.whitepaper_markdown || data.whitepaper || ''}</Markdown>
            )}
          </div>
          
          {/* Grounding Source Analysis */}
          {data.grounding_sources && data.grounding_sources.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[#F4F4F0]/10">
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                 Grounded Ledger 
               </h4>
               <ul className="flex flex-col gap-2">
                 {data.grounding_sources.map((src, idx) => {
                   const siteName = src.url ? new URL(src.url).hostname.replace('www.', '') : 'External Source';
                   const faviconUrl = src.url ? `https://www.google.com/s2/favicons?domain=${siteName}&sz=16` : '';
                   return (
                     <li key={idx} className="flex items-center gap-2 text-xs">
                       {faviconUrl && <img src={faviconUrl} alt="" className="w-4 h-4 grayscale opacity-70" />}
                       <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[#33FFFF] hover:underline truncate max-w-[80%]">
                         [{(idx + 1).toString()}] {src.title || src.url}
                       </a>
                       <span className="text-gray-600 text-[10px]">({siteName})</span>
                     </li>
                   );
                 })}
               </ul>
            </div>
          )}

          {/* Suggested Next Questions */}
          {data.suggested_next_questions && data.suggested_next_questions.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[#F4F4F0]/10">
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                 Strategic Vectors (Suggested Next Actions)
               </h4>
               <div className="flex flex-col md:flex-row flex-wrap gap-3">
                 {data.suggested_next_questions.map((q, idx) => (
                   <button
                     key={idx}
                     onClick={() => onActionClick && onActionClick(q)}
                     className="px-4 py-2 border border-white hover:bg-white hover:text-black bg-transparent text-white text-xs font-mono transition-colors text-left flex items-start gap-2"
                   >
                     <span className="font-bold opacity-50">&gt;</span>
                     <span className="flex-1">{q}</span>
                   </button>
                 ))}
               </div>
            </div>
          )}
        </motion.div>

        {/* MIDDLE SECTION: Fact Checker (High Contrast Ledger) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          className="border border-[#F4F4F0]/10 rounded-xl overflow-hidden mb-8"
        >
          <div className="bg-[#F4F4F0]/5 p-3 border-b border-[#F4F4F0]/10 flex justify-between items-center">
            <h3 className="text-xs font-bold text-[#F4F4F0] uppercase tracking-widest">
              [ 02 ] Fact_Verification_Audit
            </h3>
            <span className="text-[10px] text-gray-500">AUTO-GENERATED</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-gray-500 text-[10px] uppercase font-bold">
                <tr>
                  <th className="p-4 w-32">Agent</th>
                  <th className="p-4 w-24">Verdict</th>
                  <th className="p-4">Claim & Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F4F0]/10">
                {data.fact_check?.map((fact, idx) => (
                  <tr key={idx} className="hover:bg-[#F4F4F0]/5 transition-colors">
                    <td className="p-4 font-bold text-[#F4F4F0]">{fact.agent}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${
                        fact.verdict === 'VERIFIED' ? 'bg-[#BFFF00]/20 text-[#BFFF00]' :
                        fact.verdict === 'DEBUNKED' ? 'bg-[#FF003C]/20 text-[#FF003C]' :
                        'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {fact.verdict}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-gray-300 mb-1">"{fact.claim}"</div>
                      <div className="text-xs text-gray-500 font-mono">{">>"} {fact.context}</div>
                    </td>
                  </tr>
                ))}
                 {(!data.fact_check || data.fact_check.length === 0) && (
                   <tr>
                     <td colSpan={3} className="p-8 text-center text-gray-600 text-xs uppercase">
                       [ No Factual Claims Detected for Verification ]
                     </td>
                   </tr>
                 )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* BOTTOM SECTION: Heatmap & Evidence (Sequential) */}
        <div className="flex flex-col gap-8">
          
          {/* Heatmap (Fallback if radar data is missing) */}
          {data.heatmap_data && heatmapAgents.length > 0 && (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true, amount: 0.3 }}
               className="hidden md:flex bg-[#050505] border border-[#F4F4F0]/10 rounded-xl p-4 relative flex-col"
            >
              <div className="absolute top-4 left-4 text-[10px] text-gray-500 uppercase tracking-widest z-10">
                [ 03 ] Interaction_Heatmap_v2.0
              </div>
              <div className="flex-1 flex items-center justify-center mt-8">
                <BrutalistHeatmap data={data.heatmap_data} agents={heatmapAgents} />
              </div>
            </motion.div>
          )}

          {/* Alignment Quotes */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            className={`flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar`}
          >
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest sticky top-0 bg-[#0a0a0a] py-2 z-10 border-b border-[#F4F4F0]/10">
              [ 04 ] Alignment_Log
            </h3>
            {data.alignment_quotes?.map((item, idx) => (
              <div 
                key={idx} 
                className={`p-4 border-l-2 bg-[#F4F4F0]/5 ${
                  item.type === 'friction' 
                    ? 'border-[#FF003C] hover:bg-[#FF003C]/5' 
                    : 'border-[#BFFF00] hover:bg-[#BFFF00]/5'
                } transition-colors`}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex gap-2">
                    {item.agents && item.agents.map((agent, i) => (
                      <span key={i} className="text-[10px] bg-[#F4F4F0]/10 px-2 py-1 rounded uppercase text-gray-300">
                        {agent}
                      </span>
                    ))}
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${
                    item.type === 'friction' ? 'text-[#FF003C]' : 'text-[#BFFF00]'
                  }`}>
                    {item.type}
                  </span>
                </div>
                <p className="text-sm text-gray-300 italic">"{item.quote}"</p>
              </div>
            ))}
             {(!data.alignment_quotes || data.alignment_quotes.length === 0) && (
               <div className="text-gray-600 text-xs uppercase p-4 text-center border border-dashed border-[#F4F4F0]/10">
                 [ No Alignment Data Logged ]
               </div>
             )}
          </motion.div>
        </div>

        {sessionTokens && (
          <div className="mt-12 border-t border-gray-800 pt-4 text-xs font-mono text-gray-500 tracking-widest uppercase">
            <div className="text-[#F4F4F0] font-bold">[ SYSTEM TELEMETRY ]</div>
            <div className="flex justify-between mt-2">
              <span>COUNCIL INPUT (PROMPT): {sessionTokens.agentInput} T</span>
              <span>COUNCIL OUTPUT: {sessionTokens.agentOutput} T</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>SYNTHESIZER INPUT (CONTEXT): {sessionTokens.synthInput} T</span>
              <span>SYNTHESIZER OUTPUT: {sessionTokens.synthOutput} T</span>
            </div>
            <div className="flex justify-between mt-4 text-lime-400 font-bold border-t border-gray-800 pt-2">
              <span>TOTAL SESSION USAGE:</span>
              <span>{sessionTokens.agentInput + sessionTokens.agentOutput + sessionTokens.synthInput + sessionTokens.synthOutput} TOKENS</span>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // LEGACY FALLBACK (Previous Implementation)
  // ---------------------------------------------------------------------------
  // ... (Keep existing fallback logic for safety if needed, or simplify)
  
  // Adapt legacy graphData to ECharts format if necessary
  let echartsOption = data.echarts_config || {};

  if (!echartsOption.series && data.echartsData) {
    echartsOption = {
      title: {
        text: 'Conversation Network Graph',
        textStyle: { color: '#374151' }
      },
      tooltip: {},
      legend: [{
        data: data.echartsData.categories?.map((a: any) => a.name)
      }],
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: data.echartsData.nodes,
          links: data.echartsData.links,
          categories: data.echartsData.categories,
          roam: true,
          label: {
            show: true,
            position: 'right',
            formatter: '{b}'
          },
          labelLayout: {
            hideOverlap: true
          },
          scaleLimit: {
            min: 0.4,
            max: 2
          },
          lineStyle: {
            color: 'source',
            curveness: 0.3
          },
          force: {
            repulsion: 200,
            edgeLength: 100
          }
        }
      ]
    };
  } else if (!echartsOption.series && data.graphData) {
      // Fallback for legacy data structure
      const nodes = data.graphData.map(n => ({
          id: n.id,
          name: n.name,
          symbolSize: n.type === 'agent' ? 20 : 10,
          itemStyle: { color: n.type === 'agent' ? '#3b82f6' : '#10b981' },
          category: n.type === 'agent' ? 0 : 1
      }));
      
      const links: any[] = [];
      const nodeIds = new Set(data.graphData.map(n => n.id));
      data.graphData.forEach(node => {
          if (node.linksTo && Array.isArray(node.linksTo)) {
              node.linksTo.forEach((targetId: string) => {
                  if (nodeIds.has(targetId)) {
                      links.push({ source: node.id, target: targetId });
                  }
              });
          }
      });

      echartsOption = {
        title: { text: 'Conversation Network Graph' },
        tooltip: {},
        series: [{
            type: 'graph',
            layout: 'force',
            data: nodes,
            links: links,
            roam: true,
            label: { show: true, position: 'right' },
            force: { repulsion: 100 }
        }]
      };
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto p-6 bg-[#F4F4F0] rounded-xl shadow-sm border border-gray-100">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1 w-full md:w-1/2">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Meta-Analysis Whitepaper</h2>
          <div className="prose prose-slate max-w-none">
            {isExtractMode && onExtractText ? (
              <ExtractableText text={data.whitepaper_markdown || data.whitepaper || ''} isExtractMode={isExtractMode} onExtract={onExtractText} />
            ) : (
              <Markdown>{data.whitepaper_markdown || data.whitepaper || ''}</Markdown>
            )}
          </div>
        </div>
        <div className="flex-1 w-full md:w-1/2 bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h2 className="text-xl font-medium text-gray-800 mb-2">Concept Network</h2>
          <div className="w-full h-[400px]">
            <ReactECharts
              option={echartsOption}
              style={{ height: '400px', width: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
