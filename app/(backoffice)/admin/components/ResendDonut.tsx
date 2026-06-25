"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

// Gráfico de dona (recharts) — entregados vs. rebotados. Tema oscuro.

export function ResendDonut({
  entregados,
  rebotados,
}: {
  entregados: number;
  rebotados: number;
}) {
  const total = entregados + rebotados;
  const data =
    total > 0
      ? [
          { name: "Entregados", value: entregados, color: "#40CE9D" },
          { name: "Rebotados", value: rebotados, color: "#E43B3B" },
        ]
      : [{ name: "Sin datos", value: 1, color: "#2A2A2A" }];

  return (
    <div className="relative h-44 w-44 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={total > 0 ? 2 : 0}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[#EDEDED]">{total}</span>
        <span className="text-[11px] text-[#8C8C8C]">enviados</span>
      </div>
    </div>
  );
}
