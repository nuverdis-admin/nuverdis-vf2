import { griConfig } from "./gri.config";
import { ncgConfig } from "./ncg.config";
import type { ReporteConfig, TipoReporte } from "./types";

export const REPORTE_CONFIG: Partial<Record<TipoReporte, ReporteConfig>> = {
  GRI: griConfig,
  NCG: ncgConfig,
};

export const TIPOS_REPORTE: TipoReporte[] = ["GRI", "NCG", "SASB"];

export function getReporteConfig(tipo: string): ReporteConfig | null {
  const upper = tipo.toUpperCase() as TipoReporte;
  return REPORTE_CONFIG[upper] ?? null;
}

export function getEstadoBadge(config: ReporteConfig, estado: string) {
  return config.estados[estado] ?? { label: estado, badgeClass: "badge" };
}

export type {
  ReporteConfig,
  TipoReporte,
  EstadoConfig,
  TareaRow,
  TareaAsignacionRow,
  EquipoItem,
  OverviewStats,
} from "./types";
