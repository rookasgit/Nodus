import React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface RadarDataPoint {
  axis: string;
  [agentName: string]: string | number;
}

interface SpectrumRadarProps {
  data: RadarDataPoint[];
  agentColors: Record<string, string>;
}

export const SpectrumRadar: React.FC<SpectrumRadarProps> = ({
  data,
  agentColors,
}) => {
  if (!data || data.length === 0) return null;

  // Extract agent names from the first data point, excluding 'axis'
  const agents = Object.keys(data[0]).filter((key) => key !== "axis");
  const BRUTALIST_PALETTE = [
    "#84cc16",
    "#06b6d4",
    "#d946ef",
    "#f59e0b",
    "#f43f5e",
    "#ffffff",
  ];

  return (
    <div className="w-full bg-[#050505] rounded-xl p-0 mb-6 relative [&_.recharts-surface]:outline-none [&_.recharts-surface]:focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-wrapper]:focus:outline-none">
      <div className="h-[320px] md:h-[400px] w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
          className="outline-none focus:outline-none"
        >
          <RadarChart cx="50%" cy="50%" outerRadius="60%" data={data}>
            <PolarGrid stroke="#3f3f46" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{
                fill: "#e4e4e7",
                fontSize: 11,
                fontWeight: "bold",
                fontFamily: "monospace",
              }}
              tickFormatter={(value) => value.toString().toUpperCase()}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 10]}
              tick={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#09090b",
                borderColor: "#27272a",
                color: "#e4e4e7",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
              itemStyle={{ color: "#e4e4e7" }}
              cursor={{ stroke: "#52525b", strokeWidth: 1 }}
            />

            {agents.map((agent, index) => {
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

      <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 pb-6 px-4">
        {agents.map((agent, index) => {
          const color = BRUTALIST_PALETTE[index % BRUTALIST_PALETTE.length];
          return (
            <div key={`legend-${index}`} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]"
                style={{ backgroundColor: color, color }}
              />
              <span className="text-[10px] md:text-xs font-mono uppercase tracking-wider text-zinc-400">
                {agent}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
