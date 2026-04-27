import React from 'react';

interface HeatmapDataPoint {
  agent1: string;
  agent2: string;
  score: number;
}

interface BrutalistHeatmapProps {
  data: HeatmapDataPoint[];
  agents: string[];
}

export const BrutalistHeatmap: React.FC<BrutalistHeatmapProps> = ({ data, agents }) => {
  if (!data || data.length === 0) return null;

  // Helper to determine cell style based on score
  const getCellStyle = (score: number) => {
    if (score > 0.3) {
      return 'bg-lime-900/50 text-lime-400 border-lime-900';
    } else if (score < -0.3) {
      return 'bg-red-900/50 text-red-400 border-red-900';
    } else {
      return 'bg-zinc-800 text-zinc-500 border-zinc-700';
    }
  };

  const formatScore = (score: number) => {
    return score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  };

  // Sort data for mobile view (remove self-intersections and duplicates)
  const uniquePairs: HeatmapDataPoint[] = [];
  data.forEach(d => {
    if (d.agent1 !== d.agent2 && !uniquePairs.some(p => (p.agent1 === d.agent2 && p.agent2 === d.agent1))) {
      uniquePairs.push(d);
    }
  });
  
  const sortedByScore = [...uniquePairs].sort((a, b) => a.score - b.score);
  const topFriction = sortedByScore.slice(0, 3);
  const topConsensus = [...uniquePairs].sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <div className="w-full">
      {/* Mobile Text-Based Summary */}
      <div className="md:hidden flex flex-col gap-6 text-xs font-mono w-full px-2">
        {topFriction.length > 0 && (
          <div>
            <div className="text-[#FF003C] mb-2 uppercase font-bold tracking-widest border-b border-[#FF003C]/30 pb-1">Top Friction Vectors</div>
            {topFriction.map((item, idx) => (
              <div key={`fric-${idx}`} className="flex justify-between border-b border-zinc-900 py-2 items-center">
                <span className="text-zinc-300 truncate pr-2" title={`${item.agent1} vs ${item.agent2}`}>
                  {item.agent1} <span className="opacity-50 mx-1">x</span> {item.agent2}
                </span>
                <span className="text-[#FF003C] font-bold bg-[#FF003C]/10 px-2 py-0.5 rounded shrink-0">{formatScore(item.score)}</span>
              </div>
            ))}
          </div>
        )}
        {topConsensus.length > 0 && (
          <div>
            <div className="text-[#BFFF00] mb-2 uppercase font-bold tracking-widest border-b border-[#BFFF00]/30 pb-1">Top Consensus Vectors</div>
            {topConsensus.map((item, idx) => (
              <div key={`cons-${idx}`} className="flex justify-between border-b border-zinc-900 py-2 items-center">
                <span className="text-zinc-300 truncate pr-2" title={`${item.agent1} vs ${item.agent2}`}>
                  {item.agent1} <span className="opacity-50 mx-1">x</span> {item.agent2}
                </span>
                <span className="text-[#BFFF00] font-bold bg-[#BFFF00]/10 px-2 py-0.5 rounded shrink-0">{formatScore(item.score)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Visual Grid */}
      <div className="hidden md:block w-full overflow-x-auto pt-8 pb-6 custom-scrollbar" data-heatmap-container="true">
      <div className="min-w-max pr-32">
        {/* Grid Container */}
        <div 
          className="grid gap-1"
          style={{ 
            gridTemplateColumns: `minmax(120px, auto) repeat(${agents.length}, 42px)` 
          }}
        >
          {/* Header Row */}
          <div className="h-20"></div> {/* Empty top-left corner */}
          {agents.map((agent, i) => (
            <div key={`col-${i}`} className="h-20 flex items-end justify-center mb-1 relative">
              <span className="absolute bottom-0 left-1/2 transform -rotate-45 origin-bottom-left text-sm font-mono font-bold uppercase tracking-tighter text-zinc-300 whitespace-nowrap pl-2">
                {agent}
              </span>
            </div>
          ))}

          {/* Data Rows */}
          {agents.map((rowAgent, rowIndex) => (
            <React.Fragment key={`row-${rowIndex}`}>
              {/* Row Label */}
              <div className="flex items-center justify-end pr-3 h-8">
                <span className="text-sm font-mono font-bold uppercase tracking-tighter text-zinc-300 text-right leading-tight whitespace-nowrap" title={rowAgent}>
                  {rowAgent}
                </span>
              </div>

              {/* Cells */}
              {agents.map((colAgent, colIndex) => {
                // Find data point for this pair
                const point = data.find(
                  d => (d.agent1 === rowAgent && d.agent2 === colAgent) || 
                       (d.agent1 === colAgent && d.agent2 === rowAgent)
                );

                // Self-intersection is always neutral/empty
                if (rowAgent === colAgent) {
                  return (
                    <div key={`${rowIndex}-${colIndex}`} className="w-full h-8 bg-[#0a0a0a] border border-zinc-800/50 rounded-sm" />
                  );
                }

                const score = point ? point.score : 0;
                const style = getCellStyle(score);

                return (
                  <div 
                    key={`${rowIndex}-${colIndex}`} 
                    className={`w-full h-8 flex items-center justify-center border rounded-sm text-xs font-mono font-bold ${style}`}
                    title={`${rowAgent} vs ${colAgent}: ${score}`}
                  >
                    {point ? formatScore(score) : '-'}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
};
