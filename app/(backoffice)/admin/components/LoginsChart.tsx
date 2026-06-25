"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { LoginDia } from "@/app/actions/admin-stats";

// Gráfico de barras — inicios de sesión por día (últimos 7 días). Tema oscuro.

export function LoginsChart({ data }: { data: LoginDia[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#8C8C8C" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#8C8C8C" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "#202020" }}
          contentStyle={{
            background: "#161616",
            border: "1px solid #2A2A2A",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#8C8C8C" }}
          itemStyle={{ color: "#EDEDED" }}
        />
        <Bar
          dataKey="logins"
          fill="#66BC9F"
          radius={[6, 6, 0, 0]}
          name="Inicios de sesión"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
