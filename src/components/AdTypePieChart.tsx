"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

const COLORS: Record<string, string> = {
  SP: "#2a78d6",
  SB: "#eb6834",
  SD: "#1baf7a",
};

export function AdTypePieChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            label={({ name, value }) =>
              total > 0 ? `${name} ${((value / total) * 100).toFixed(0)}%` : name
            }
            labelLine={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] ?? "#898781"} stroke="#fcfcfb" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value))} />
          <Legend verticalAlign="bottom" height={28} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
