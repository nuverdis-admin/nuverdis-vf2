"use server";

// ── Types públicos ────────────────────────────────────────────────────────────

export interface DayPoint {
  date: string;
  value: number;
}

export interface CommandPoint {
  time: string;
  SET: number;
  GET: number;
  SCAN: number;
  DEL: number;
}

export interface ConnectionPoint {
  time: string;
  tcp: number;
  rest: number;
}

export interface HitPoint {
  time: string;
  hits: number;
  misses: number;
}

export interface SinglePoint {
  time: string;
  value: number;
}

export interface UpstashMetrics {
  db: {
    name: string;
    region: string;
    plan: string;
    monthlyCommands: number;
    commandsLimit: number;
    writes: number;
    reads: number;
    bandwidthBytes: number;
    bandwidthLimit: number;
    storageBytes: number;
    storageLimit: number;
    cost: number;
  };
  dailyCommands: DayPoint[];
  dailyBandwidth: DayPoint[];
  commandsTs: CommandPoint[];
  throughputTs: SinglePoint[];
  latencyTs: SinglePoint[];
  dataSizeTs: SinglePoint[];
  connectionsTs: ConnectionPoint[];
  keyspaceTs: SinglePoint[];
  hitsMissesTs: HitPoint[];
  source: "api" | "mock";
}

// ── Tipos internos de la API ──────────────────────────────────────────────────

interface Point {
  x: string;
  y: number;
  regional_details?: Record<string, number>;
}

interface CommandCount {
  metric_identifier: string;
  data_points: Point[];
}

interface UpstashDbResponse {
  database_id: string;
  database_name: string;
  region: string;
  type: string;
  state: string;
  monthly_commands?: number;
  total_monthly_storage?: number;
  total_monthly_cost?: number;
  monthly_bandwidth?: number;
}

interface UpstashStatsResponse {
  daily_net_commands?: number;
  daily_read_requests?: number;
  daily_write_requests?: number;
  total_monthly_bandwidth?: number;
  total_monthly_storage?: number;
  dailyrequests?: Point[];
  bandwidths?: Point[];
  throughput?: Point[];
  latencymean?: Point[];
  diskusage?: Point[];
  connection_count?: Point[];
  rest_conn_count?: Point[];
  keyspace?: Point[];
  hits?: Point[];
  misses?: Point[];
  command_counts?: CommandCount[];
}

// ── Helpers de transformación ─────────────────────────────────────────────────

// "2026-05-25 08:23:00.000 +0000 UTC" → "08:23"
function parseTime(x: string): string {
  // Extraer HH:MM directamente del string para evitar ambigüedades de zona
  const match = x.match(/\d{2}:\d{2}/);
  return match ? match[0] : x;
}

function toSinglePoints(arr: Point[] | undefined): SinglePoint[] {
  if (!arr || arr.length === 0) return [];
  return arr.map((p) => ({ time: parseTime(p.x), value: p.y }));
}

function toDayPoints(arr: Point[] | undefined): DayPoint[] {
  if (!arr || arr.length === 0) return [];
  return arr.map((p) => ({
    // "2026-05-25 ..." → "2026-05-25"
    date: p.x.split(" ")[0],
    value: p.y,
  }));
}

function toCommandPoints(counts: CommandCount[] | undefined): CommandPoint[] {
  if (!counts || counts.length === 0) return [];

  // Alinear todos los comandos en el mismo eje de tiempo usando el primero como referencia
  const byId: Record<string, Record<string, number>> = {};
  const times = new Set<string>();

  for (const cmd of counts) {
    byId[cmd.metric_identifier] = {};
    for (const dp of cmd.data_points) {
      const t = parseTime(dp.x);
      byId[cmd.metric_identifier][t] = dp.y;
      times.add(t);
    }
  }

  return Array.from(times)
    .sort()
    .map((time) => ({
      time,
      SET: byId["SET"]?.[time] ?? 0,
      GET: byId["GET"]?.[time] ?? 0,
      SCAN: byId["SCAN"]?.[time] ?? 0,
      DEL: byId["DEL"]?.[time] ?? 0,
    }));
}

function toConnectionPoints(
  tcpArr: Point[] | undefined,
  restArr: Point[] | undefined
): ConnectionPoint[] {
  const base = tcpArr ?? restArr ?? [];
  if (base.length === 0) return [];

  const restMap: Record<string, number> = {};
  for (const p of restArr ?? []) restMap[parseTime(p.x)] = p.y;

  return base.map((p) => {
    const t = parseTime(p.x);
    return { time: t, tcp: p.y, rest: restMap[t] ?? 0 };
  });
}

function toHitPoints(
  hitsArr: Point[] | undefined,
  missesArr: Point[] | undefined
): HitPoint[] {
  const base = hitsArr ?? missesArr ?? [];
  if (base.length === 0) return [];

  const missMap: Record<string, number> = {};
  for (const p of missesArr ?? []) missMap[parseTime(p.x)] = p.y;

  return base.map((p) => {
    const t = parseTime(p.x);
    return { time: t, hits: p.y, misses: missMap[t] ?? 0 };
  });
}

// ── Fallback vacío (sin datos falsos) ────────────────────────────────────────

function emptyMetrics(): UpstashMetrics {
  return {
    db: {
      name: "—",
      region: "—",
      plan: "—",
      monthlyCommands: 0,
      commandsLimit: 500_000,
      writes: 0,
      reads: 0,
      bandwidthBytes: 0,
      bandwidthLimit: 50 * 1024 * 1024 * 1024,
      storageBytes: 0,
      storageLimit: 256 * 1024 * 1024,
      cost: 0,
    },
    dailyCommands: [],
    dailyBandwidth: [],
    commandsTs: [],
    throughputTs: [],
    latencyTs: [],
    dataSizeTs: [],
    connectionsTs: [],
    keyspaceTs: [],
    hitsMissesTs: [],
    source: "mock",
  };
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchManagement<T>(path: string): Promise<T | null> {
  const email = process.env.UPSTASH_EMAIL;
  const apiKey = process.env.NUVERDIS_UPSTASH_MONITOREO_READONLY;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[UPSTASH] FETCH START");
  console.log("[UPSTASH] PATH:", path);

  if (!email || !apiKey) {
    console.log("[UPSTASH] MISSING EMAIL OR API KEY");
    return null;
  }

  try {
    const basicAuth = Buffer.from(`${email}:${apiKey}`).toString("base64");

    const res = await fetch(`https://api.upstash.com${path}`, {
      headers: { Authorization: `Basic ${basicAuth}` },
      next: { revalidate: 60 },
    });

    console.log("[UPSTASH] STATUS:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.log("[UPSTASH] ERROR:", text);
      return null;
    }

    const json = await res.json();
    console.log("[UPSTASH] SUCCESS");
    return json as T;
  } catch (err) {
    console.error("[UPSTASH] FETCH ERROR:", err);
    return null;
  }
}

// ── Main action ───────────────────────────────────────────────────────────────

export async function getUpstashMetrics(): Promise<UpstashMetrics> {
  try {
    console.log("");
    console.log("════════════════════════════");
    console.log("[UPSTASH] METRICS START");
    console.log("════════════════════════════");

    const dbId = process.env.UPSTASH_DATABASE_ID;
    if (!dbId) throw new Error("UPSTASH_DATABASE_ID no está configurado");

    console.log("[UPSTASH] DATABASE ID:", dbId);

    const [detail, stats] = await Promise.all([
      fetchManagement<UpstashDbResponse>(`/v2/redis/database/${dbId}`),
      fetchManagement<UpstashStatsResponse>(`/v2/redis/stats/${dbId}`),
    ]);

    console.log("[UPSTASH] DETAIL name:", detail?.database_name);
    console.log("[UPSTASH] STATS keys:", Object.keys(stats ?? {}).join(", "));

    console.log("[UPSTASH] USING REAL API DATA");

    return {
      db: {
        name: detail?.database_name ?? "—",
        region: detail?.region ?? "—",
        plan: detail?.type ?? "—",
        monthlyCommands: detail?.monthly_commands ?? 0,
        commandsLimit: 500_000,
        writes: stats?.daily_write_requests ?? 0,
        reads: stats?.daily_read_requests ?? 0,
        bandwidthBytes:
          stats?.total_monthly_bandwidth ?? detail?.monthly_bandwidth ?? 0,
        bandwidthLimit: 50 * 1024 * 1024 * 1024,
        storageBytes:
          stats?.total_monthly_storage ?? detail?.total_monthly_storage ?? 0,
        storageLimit: 256 * 1024 * 1024,
        cost: detail?.total_monthly_cost ?? 0,
      },

      dailyCommands: toDayPoints(stats?.dailyrequests),
      dailyBandwidth: toDayPoints(stats?.bandwidths),

      commandsTs: toCommandPoints(stats?.command_counts),
      throughputTs: toSinglePoints(stats?.throughput),
      latencyTs: toSinglePoints(stats?.latencymean),
      dataSizeTs: toSinglePoints(stats?.diskusage),
      connectionsTs: toConnectionPoints(
        stats?.connection_count,
        stats?.rest_conn_count
      ),
      keyspaceTs: toSinglePoints(stats?.keyspace),
      hitsMissesTs: toHitPoints(stats?.hits, stats?.misses),

      source: "api",
    };
  } catch (err) {
    console.log("════════════════════════════");
    console.log("[UPSTASH] FATAL ERROR");
    console.error(err);
    console.log("════════════════════════════");

    return emptyMetrics();
  }
}
