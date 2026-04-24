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

  return (
    <div className="w-full overflow-x-auto pb-6 custom-scrollbar">
      <div className="min-w-max pr-4">
        {/* Grid Container */}
        <div 
          className="grid gap-1"
          style={{ 
            gridTemplateColumns: `minmax(120px, auto) repeat(${agents.length}, 1fr)` 
          }}
        >
          {/* Header Row */}
          <div className="h-32"></div> {/* Empty top-left corner */}
          {agents.map((agent, i) => (
            <div key={`col-${i}`} className="h-32 flex items-end justify-center mb-2 relative">
              <span className="absolute bottom-0 left-1/2 transform -rotate-45 origin-bottom-left text-[10px] font-mono uppercase tracking-tighter text-zinc-500 whitespace-nowrap">
                {agent}
              </span>
            </div>
          ))}

          {/* Data Rows */}
          {agents.map((rowAgent, rowIndex) => (
            <React.Fragment key={`row-${rowIndex}`}>
              {/* Row Label */}
              <div className="flex items-center justify-end pr-3 h-16">
                <span className="text-[10px] font-mono uppercase tracking-tighter text-zinc-500 text-right break-words" title={rowAgent}>
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
                    <div key={`${rowIndex}-${colIndex}`} className="w-full h-16 bg-zinc-900/50 border border-zinc-800/50" />
                  );
                }

                const score = point ? point.score : 0;
                const style = getCellStyle(score);

                return (
                  <div 
                    key={`${rowIndex}-${colIndex}`} 
                    className={`w-full h-16 flex items-center justify-center border text-[10px] font-mono font-bold ${style}`}
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
  );
};
