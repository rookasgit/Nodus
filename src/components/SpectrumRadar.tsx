import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

interface RadarDataPoint {
  axis: string;
  [agentName: string]: string | number;
}

interface SpectrumRadarProps {
  data: RadarDataPoint[];
  agentColors: Record<string, string>;
}

const renderLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 px-4">
      {payload.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" 
            style={{ backgroundColor: entry.color, color: entry.color }} 
          />
          <span className="text-[10px] md:text-xs font-mono uppercase tracking-wider text-zinc-400">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const SpectrumRadar: React.FC<SpectrumRadarProps> = ({ data, agentColors }) => {
  if (!data || data.length === 0) return null;

  // Extract agent names from the first data point, excluding 'axis'
  const agents = Object.keys(data[0]).filter(key => key !== 'axis');

  return (
    <div className="w-full bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 mb-6">
      <h3 className="text-sm font-mono text-zinc-400 mb-4 uppercase tracking-wider text-center">Spectrum Radar</h3>
      <ResponsiveContainer width="100%" height={450}>
        <RadarChart cx="50%" cy="45%" outerRadius="65%" data={data}>
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#e4e4e7', fontFamily: 'monospace', fontSize: '12px' }}
            itemStyle={{ color: '#e4e4e7' }}
            cursor={{ stroke: '#52525b', strokeWidth: 1 }}
          />
          
          <Legend content={renderLegend} />
          
          {agents.map((agent, index) => {
            const BRUTALIST_PALETTE = ['#84cc16', '#06b6d4', '#d946ef', '#f59e0b', '#f43f5e', '#ffffff'];
            const color = BRUTALIST_PALETTE[index % BRUTALIST_PALETTE.length];
            
            return (
              <Radar
                key={agent}
                name={agent}
                dataKey={agent}
                stroke={color}
                fill={color}
                fillOpacity={0.1}
              />
            );
          })}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
