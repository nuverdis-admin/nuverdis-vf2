import { create } from "zustand";

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface Empresa {
  empresa_id: string;
  ref: string;
  nombre: string;
  plan: string;
  icono: string;
}

export interface AppConfig {
  empresa: Empresa;
  dominioShort: string;
  isDev: boolean;
}

export interface UsuarioActual {
  uid: string;
  email: string;
  nombreCompleto: string;
  empresaId: string;
  rol: string;
  activo: boolean;
}

export interface Proyecto {
  proyecto_id: string;
  ref: string;
  nombre_proyecto: string;
  anio_reporte: number;
  estado: string;
  archivado_at: string | null;
  empresa_id: string;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export interface AsignacionFoco {
  tareaId: string;
  jerarquia1: string;  // NCG: estandar; GRI: jerarquia_1
  j1Group?: string;    // NCG: jerarquia_1 del grupo del acordeón
}

interface AuthState {
  appConfig: AppConfig | null;
  usuarioActual: UsuarioActual | null;
  proyectos: Proyecto[];
  setAppConfig: (config: AppConfig) => void;
  setUsuario: (usuario: UsuarioActual) => void;
  setProyectos: (proyectos: Proyecto[]) => void;
  reset: () => void;
  // Filtro pre-aplicado desde overview → TareasTable
  tareasFiltroOverview: string[] | null;
  setTareasFiltroOverview: (estados: string[] | null) => void;
  // Foco pre-aplicado desde seguimiento → AsignacionesView
  asignacionFoco: AsignacionFoco | null;
  setAsignacionFoco: (foco: AsignacionFoco | null) => void;
}

const initialState = {
  appConfig: null,
  usuarioActual: null,
  proyectos: [] as Proyecto[],
  tareasFiltroOverview: null as string[] | null,
  asignacionFoco: null as AsignacionFoco | null,
};

export const useAuthStore = create<AuthState>()((set) => ({
  ...initialState,
  setAppConfig: (config) => set({ appConfig: config }),
  setUsuario: (usuario) => set({ usuarioActual: usuario }),
  setProyectos: (proyectos) => set({ proyectos }),
  reset: () => set(initialState),
  setTareasFiltroOverview: (estados) => set({ tareasFiltroOverview: estados }),
  setAsignacionFoco: (foco) => set({ asignacionFoco: foco }),
}));
