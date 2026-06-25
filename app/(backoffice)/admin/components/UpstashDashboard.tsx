"use client";

import { useState } from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type {
  UpstashMetrics,
  DayPoint,
  CommandPoint,
  SinglePoint,
  ConnectionPoint,
  HitPoint,
} from "@/app/actions/upstash-metrics";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0A0A0A",
  card: "#111111",
  border: "#2A2A2A",
  text: "#EDEDED",
  sub: "#8C8C8C",
  green: "#22C55E",
  blue: "#3B82F6",
  amber: "#F59E0B",
  red: "#EF4444",
  purple: "#A855F7",
  cyan: "#06B6D4",
};

const TOOLTIP_STYLE = {
  background: "#161616",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 11,
  color: C.text,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function pct(value: number, limit: number): number {
  return Math.min(100, Math.round((value / limit) * 100));
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function DarkCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border bg-[#111111] p-5 ${className}`} style={{ borderColor: C.border }}>
      {children}
    </div>
  );
}

function ChartTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: C.sub }}>
      {children}
    </p>
  );
}

function Badge({ children, color = C.sub }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {children}
    </span>
  );
}

function ProgressBar({ value, limit, color }: { value: number; limit: number; color: string }) {
  const p = pct(value, limit);
  return (
    <div className="mt-2 h-1 w-full overflow-hidden rounded-full" style={{ background: C.border }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: color }} />
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function KpiCard({
  title, main, sub, detail, limit, color,
}: {
  title: string;
  main: string;
  sub: string;
  detail?: string;
  limit?: number;
  color: string;
}) {
  return (
    <DarkCard>
      <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: C.sub }}>
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color }}>
        {main}
      </p>
      <p className="mt-0.5 text-xs" style={{ color: C.sub }}>{sub}</p>
      {detail && (
        <p className="mt-1.5 text-xs font-medium" style={{ color: C.sub }}>
          {detail}
        </p>
      )}
      {limit !== undefined && <ProgressBar value={parseInt(main)} limit={limit} color={color} />}
    </DarkCard>
  );
}

// ── Bar Charts ────────────────────────────────────────────────────────────────
function DailyCommandsChart({ data }: { data: DayPoint[] }) {
  return (
    <DarkCard>
      <ChartTitle>Daily Commands by Region · Last 5 days</ChartTitle>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.sub }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.sub }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#202020" }} />
          <Bar dataKey="value" name="Commands" fill={C.green} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </DarkCard>
  );
}

function DailyBandwidthChart({ data }: { data: DayPoint[] }) {
  return (
    <DarkCard>
      <ChartTitle>Daily Bandwidth by Region · Last 5 days</ChartTitle>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.sub }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.sub }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#202020" }} formatter={(v) => [`${v ?? 0} B`, "Bandwidth"]} />
          <Bar dataKey="value" name="Bandwidth" fill={C.blue} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </DarkCard>
  );
}

// ── Line Charts ───────────────────────────────────────────────────────────────
const LINE_PROPS = {
  dot: false as const,
  strokeWidth: 1.5,
  activeDot: { r: 3 },
};

const AXIS_PROPS = {
  tick: { fontSize: 10, fill: C.sub },
  axisLine: false as const,
  tickLine: false as const,
};

function CommandsLineChart({ data }: { data: CommandPoint[] }) {
  return (
    <DarkCard>
      <ChartTitle>Top Commands Usage</ChartTitle>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
          <XAxis dataKey="time" {...AXIS_PROPS} interval={8} />
          <YAxis {...AXIS_PROPS} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: C.sub }} />
          <Line dataKey="SET" stroke={C.green} {...LINE_PROPS} />
          <Line dataKey="GET" stroke={C.blue} {...LINE_PROPS} />
          <Line dataKey="SCAN" stroke={C.amber} {...LINE_PROPS} />
          <Line dataKey="DEL" stroke={C.red} {...LINE_PROPS} />
        </LineChart>
      </ResponsiveContainer>
    </DarkCard>
  );
}

function ThroughputChart({ data }: { data: SinglePoint[] }) {
  return (
    <DarkCard>
      <ChartTitle>Throughput (commands / sec)</ChartTitle>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
          <XAxis dataKey="time" {...AXIS_PROPS} interval={8} />
          <YAxis {...AXIS_PROPS} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line dataKey="value" name="cmd/s" stroke={C.purple} {...LINE_PROPS} />
        </LineChart>
      </ResponsiveContainer>
    </DarkCard>
  );
}

function LatencyChart({ data }: { data: SinglePoint[] }) {
  return (
    <DarkCard>
      <ChartTitle>Service Time Latency (msec)</ChartTitle>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
          <XAxis dataKey="time" {...AXIS_PROPS} interval={8} />
          <YAxis {...AXIS_PROPS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v ?? 0} ms`, "Latency"]} />
          <Line dataKey="value" name="ms" stroke={C.cyan} {...LINE_PROPS} />
        </LineChart>
      </ResponsiveContainer>
    </DarkCard>
  );
}

function DataSizeChart({ data }: { data: SinglePoint[] }) {
  return (
    <DarkCard>
      <ChartTitle>Data Size (bytes)</ChartTitle>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
          <XAxis dataKey="time" {...AXIS_PROPS} interval={8} />
          <YAxis {...AXIS_PROPS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatBytes(typeof v === "number" ? v : 0), "Size"]} />
          <Line dataKey="value" name="size" stroke={C.amber} {...LINE_PROPS} />
        </LineChart>
      </ResponsiveContainer>
    </DarkCard>
  );
}

function ConnectionsChart({ data }: { data: ConnectionPoint[] }) {
  return (
    <DarkCard>
      <ChartTitle>Connections</ChartTitle>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
          <XAxis dataKey="time" {...AXIS_PROPS} interval={8} />
          <YAxis {...AXIS_PROPS} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: C.sub }} />
          <Line dataKey="tcp" name="TCP" stroke={C.blue} {...LINE_PROPS} />
          <Line dataKey="rest" name="REST" stroke={C.green} {...LINE_PROPS} />
        </LineChart>
      </ResponsiveContainer>
    </DarkCard>
  );
}

function KeyspaceChart({ data }: { data: SinglePoint[] }) {
  return (
    <DarkCard>
      <ChartTitle>Keyspace</ChartTitle>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
          <XAxis dataKey="time" {...AXIS_PROPS} interval={8} />
          <YAxis {...AXIS_PROPS} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line dataKey="value" name="keys" stroke={C.red} {...LINE_PROPS} />
        </LineChart>
      </ResponsiveContainer>
    </DarkCard>
  );
}

function HitsMissesChart({ data }: { data: HitPoint[] }) {
  return (
    <DarkCard>
      <ChartTitle>Hits / Misses</ChartTitle>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
          <XAxis dataKey="time" {...AXIS_PROPS} interval={4} />
          <YAxis {...AXIS_PROPS} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: C.sub }} />
          <Line dataKey="hits" name="Hits / sec" stroke={C.green} {...LINE_PROPS} strokeWidth={2} />
          <Line dataKey="misses" name="Misses / sec" stroke={C.red} {...LINE_PROPS} />
        </LineChart>
      </ResponsiveContainer>
    </DarkCard>
  );
}

// ── Filter selector ───────────────────────────────────────────────────────────
const FILTERS = ["Past 1 hour", "Past 3 hours", "Past 24 hours", "Past 7 days"] as const;
type Filter = (typeof FILTERS)[number];

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function UpstashDashboard({ metrics }: { metrics: UpstashMetrics }) {
  const [filter, setFilter] = useState<Filter>("Past 3 hours");
  const { db } = metrics;

  return (
    <div className="h-full overflow-y-auto" style={{ background: C.bg }}>
      <div className="mx-auto max-w-7xl space-y-6 p-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "#00C951" }}>
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 4a1 1 0 110 2 1 1 0 010-2zm-1 4h2v8h-2v-8z" />
                </svg>
              </div>
              <h1 className="text-lg font-bold" style={{ color: C.text }}>
                Redis ·{" "}
                <span style={{ color: C.sub }} className="font-normal">
                  {db.name}
                </span>
              </h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge color={C.green}>{db.plan} Tier</Badge>
              <Badge color={C.blue}>AWS</Badge>
              <Badge color={C.sub}>Sao Paulo</Badge>
              <Badge color={C.sub}>{db.region}</Badge>
              {metrics.source === "mock" && (
                <Badge color={C.amber}>Demo data</Badge>
              )}
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DarkCard>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: C.sub }}>
              Commands
            </p>
            <p className="mt-2 text-2xl font-bold" style={{ color: C.green }}>
              {db.monthlyCommands.toLocaleString()}
              <span className="ml-1 text-sm font-normal" style={{ color: C.sub }}>
                / {(db.commandsLimit / 1000).toFixed(0)}k per month
              </span>
            </p>
            <div className="mt-3 flex gap-4 text-xs" style={{ color: C.sub }}>
              <span>Writes: <span style={{ color: C.text }}>{db.writes}</span></span>
              <span>Reads: <span style={{ color: C.text }}>{db.reads}</span></span>
            </div>
            <ProgressBar value={db.monthlyCommands} limit={db.commandsLimit} color={C.green} />
          </DarkCard>

          <DarkCard>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: C.sub }}>
              Bandwidth
            </p>
            <p className="mt-2 text-2xl font-bold" style={{ color: C.blue }}>
              {formatBytes(db.bandwidthBytes)}
              <span className="ml-1 text-sm font-normal" style={{ color: C.sub }}>
                / {formatBytes(db.bandwidthLimit)}
              </span>
            </p>
            <p className="mt-1 text-xs" style={{ color: C.green }}>It&apos;s all right.</p>
            <ProgressBar value={db.bandwidthBytes} limit={db.bandwidthLimit} color={C.blue} />
          </DarkCard>

          <DarkCard>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: C.sub }}>
              Storage
            </p>
            <p className="mt-2 text-2xl font-bold" style={{ color: C.purple }}>
              {formatBytes(db.storageBytes)}
              <span className="ml-1 text-sm font-normal" style={{ color: C.sub }}>
                / {formatBytes(db.storageLimit)}
              </span>
            </p>
            <p className="mt-1 text-xs" style={{ color: C.green }}>It&apos;s all right.</p>
            <ProgressBar value={db.storageBytes} limit={db.storageLimit} color={C.purple} />
          </DarkCard>

          <DarkCard>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: C.sub }}>
              Cost
            </p>
            <p className="mt-2 text-2xl font-bold" style={{ color: C.text }}>
              ${db.cost.toFixed(2)}
            </p>
            <p className="mt-1 text-xs" style={{ color: C.sub }}>Este mes</p>
            <div className="mt-3 h-1 w-full rounded-full" style={{ background: C.border }} />
          </DarkCard>
        </div>

        {/* Bar Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DailyCommandsChart data={metrics.dailyCommands} />
          <DailyBandwidthChart data={metrics.dailyBandwidth} />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: C.sub }}>Filter Data</span>
          <div className="flex rounded-lg border p-0.5" style={{ borderColor: C.border, background: "#161616" }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                style={
                  filter === f
                    ? { background: "#2A2A2A", color: C.text }
                    : { color: C.sub }
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Line Charts grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CommandsLineChart data={metrics.commandsTs} />
          <ThroughputChart data={metrics.throughputTs} />
          <LatencyChart data={metrics.latencyTs} />
          <DataSizeChart data={metrics.dataSizeTs} />
          <ConnectionsChart data={metrics.connectionsTs} />
          <KeyspaceChart data={metrics.keyspaceTs} />
        </div>

        {/* Hits / Misses — full width */}
        <HitsMissesChart data={metrics.hitsMissesTs} />

      </div>
    </div>
  );
}
