"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/lib/store/auth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { crearUsuario, editarUsuario, eliminarUsuario } from "@/lib/supabase/usuarios";
import { ActivityDrawer } from "@/app/(dashboard)/components/ActivityDrawer";

// NO TOCAR JOYRIDE
import dynamic from "next/dynamic";
import type { Step } from "react-joyride";

const Joyride = dynamic(
  () =>
    import("react-joyride").then((mod: any) => {
      return mod.Joyride;
    }),
  {
    ssr: false,
  }
) as any;

// --- Tipos ---
interface Usuario {
  uid: string;
  nombre_completo: string;
  email: string;
  activo: boolean;
  rol: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  motivo_baja?: string | null;
}

interface UsuarioRaw {
  uid: string;
  nombre_completo: string;
  activo: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  motivo_baja?: string | null;
}

interface RolRow {
  user_id: string;
  roles: { name: string } | null;
}

interface Equipo {
  equipo_id: number;
  nombre: string;
}

interface Asignacion {
  equipo_id: number;
  user_id: string;
}

interface CsvUsuarioFila {
  nombre_completo: string;
  email: string;
  rol: string;
}

interface CsvEquipoFila {
  nombre_equipo: string;
}

interface CsvEquipoUsuarioFila {
  equipo: string;
  nombre_completo: string;
  email: string;
  rol: string;
}

interface CsvError {
  fila: number;
  error: string;
}

interface BulkFallido {
  email?: string;
  nombre?: string;
  error: string;
}

interface BulkResponse {
  exitosos: number;
  fallidos: BulkFallido[];
  equipos_creados?: number;
}

// --- CSV Helpers (module-level) ---
function leerArchivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function parsearCSVUsuarios(texto: string): { validos: CsvUsuarioFila[]; errores: CsvError[] } {
  const lineas = texto.trim().split(/\r?\n/);
  const validos: CsvUsuarioFila[] = [];
  const errores: CsvError[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < lineas.length; i++) {
    if (!lineas[i].trim()) continue;
    const cols = lineas[i].split(",").map((c) => c.trim());
    const [nombre_completo, email, rol] = cols;

    if (!nombre_completo || !email || !rol) {
      errores.push({ fila: i + 1, error: "Datos incompletos" });
      continue;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      errores.push({ fila: i + 1, error: `Email inválido: "${email}"` });
      continue;
    }

    if (!["encargado", "revisor"].includes(rol)) {
      errores.push({ fila: i + 1, error: `Rol inválido: "${rol}". Use "encargado" o "revisor"` });
      continue;
    }

    const emailLower = email.toLowerCase();
    if (seenEmails.has(emailLower)) {
      errores.push({ fila: i + 1, error: "Email duplicado en el CSV" });
      continue;
    }
    seenEmails.add(emailLower);

    validos.push({ nombre_completo, email, rol });
  }

  return { validos, errores };
}

function parsearCSVEquipos(texto: string): { validos: CsvEquipoFila[]; errores: CsvError[] } {
  const lineas = texto.trim().split(/\r?\n/);
  const validos: CsvEquipoFila[] = [];
  const errores: CsvError[] = [];
  const seenEquipos = new Set<string>();

  for (let i = 1; i < lineas.length; i++) {
    if (!lineas[i].trim()) continue;
    const nombre_equipo = lineas[i].split(",")[0]?.trim();
    if (!nombre_equipo) {
      errores.push({ fila: i + 1, error: "Nombre vacío" });
      continue;
    }

    const nombreLower = nombre_equipo.toLowerCase();
    if (seenEquipos.has(nombreLower)) {
      errores.push({ fila: i + 1, error: "Nombre de equipo duplicado en el CSV" });
      continue;
    }
    seenEquipos.add(nombreLower);

    validos.push({ nombre_equipo });
  }
  return { validos, errores };
}

function parsearCSVEquiposUsuarios(texto: string): { validos: CsvEquipoUsuarioFila[]; errores: CsvError[] } {
  const lineas = texto.trim().split(/\r?\n/);
  const validos: CsvEquipoUsuarioFila[] = [];
  const errores: CsvError[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < lineas.length; i++) {
    if (!lineas[i].trim()) continue;
    const cols = lineas[i].split(",").map((c) => c.trim());
    const [equipo, nombre_completo, email, rol] = cols;

    if (!equipo || !nombre_completo || !email || !rol) {
      errores.push({ fila: i + 1, error: "Datos incompletos" });
      continue;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      errores.push({ fila: i + 1, error: `Email inválido: "${email}"` });
      continue;
    }

    if (!["encargado", "revisor"].includes(rol)) {
      errores.push({ fila: i + 1, error: `Rol inválido: "${rol}". Use "encargado" o "revisor"` });
      continue;
    }

    const emailLower = email.toLowerCase();
    if (seenEmails.has(emailLower)) {
      errores.push({ fila: i + 1, error: "Email duplicado en el CSV" });
      continue;
    }
    seenEmails.add(emailLower);

    validos.push({ equipo, nombre_completo, email, rol });
  }
  return { validos, errores };
}

export default function UsuariosPage() {
  const usuarioActual = useAuthStore((s) => s.usuarioActual);
  const supabase = createClient();

  // --- Estado Global ---
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);

  // --- Estado de la UI ---
  const [isLoading, setIsLoading] = useState(true); // Inicia en true
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [equiposColapsados, setEquiposColapsados] = useState<
    Record<number, boolean>
  >({});

  // --- Estado de Modales ---
  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalEquipo, setModalEquipo] = useState(false);
  const [equipoAEliminar, setEquipoAEliminar] = useState<number | null>(null);
  const [nuevoEquipoNombre, setNuevoEquipoNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [usuarioARemover, setUsuarioARemover] = useState<{
    equipoId: number;
    userId: string;
  } | null>(null);
  const [modalEditar, setModalEditar] = useState(false);
  const [usuarioAEditar, setUsuarioAEditar] = useState<Usuario | null>(null);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<Usuario | null>(null);
  const [dropdownUserId, setDropdownUserId] = useState<string | null>(null);
  const [formCrear, setFormCrear] = useState<{
    email: string;
    nombre_completo: string;
    rol: string;
    activo: boolean;
  }>({ email: "", nombre_completo: "", rol: "encargado", activo: true });
  const [formEditar, setFormEditar] = useState<{
    nombre_completo: string;
    rol: string;
    activo: boolean;
  }>({ nombre_completo: "", rol: "encargado", activo: true });
  const [submitting, setSubmitting] = useState(false);

  // --- Estado Carga Masiva ---
  const [tabUsuario, setTabUsuario] = useState<"individual" | "masivo">("individual");
  const [tabEquipo, setTabEquipo] = useState<"individual" | "solo_equipos" | "equipos_usuarios">("individual");
  const [csvUsuariosData, setCsvUsuariosData] = useState<{ validos: CsvUsuarioFila[]; errores: CsvError[] } | null>(null);
  const [csvEquiposData, setCsvEquiposData] = useState<{ validos: CsvEquipoFila[]; errores: CsvError[] } | null>(null);
  const [csvEqUsuData, setCsvEqUsuData] = useState<{ validos: CsvEquipoUsuarioFila[]; errores: CsvError[] } | null>(null);
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // --- JOYRIDE (NO TOCAR) ---
  const [runTour, setRunTour] = useState(false);

  const steps: Step[] = [
    {
      target: "#lista-usuarios",
      content: "Aquí tienes la lista de todos tus colaboradores.",
      placement: "right",
    },
    {
      target: ".user-item",
      content: "Arrastra un usuario hacia un equipo.",
    },
    {
      target: ".equipo-card",
      content: "Suéltalo aquí para asignarlo a un equipo.",
      placement: "left",
    },
  ];

  // --- Carga Inicial ---
  useEffect(() => {
    if (!usuarioActual?.empresaId) return;

    cargarDatos();
  }, [usuarioActual]);

// --- JOYRIDE (Lógica Inteligente) ---
  useEffect(() => {
    // 1. Verificamos si el usuario ya terminó o saltó el tour antes
    const tourCompletado = localStorage.getItem("tour-usuarios-completed") === "true";
    
    // 2. Comprobamos si hay CUALQUIER modal abierto en la pantalla
    const algunModalAbierto = modalUsuario || modalEquipo || (equipoAEliminar !== null) || usuarioAEditar !== null || usuarioAEliminar !== null || isActivityOpen;

    // 3. Evaluamos si debemos mostrar el tour
    if (usuarios.length > 0 && equipos.length > 0) {
      if (!tourCompletado && !algunModalAbierto) {
        // Pantalla limpia y no lo ha hecho: ¡Arranca el tour!
        setRunTour(true);
      } else if (algunModalAbierto) {
        // Si el usuario abre un modal (ej. hace clic en "Crear equipo" a mitad del tour),
        // pausamos/ocultamos el tour inmediatamente para que no se superponga.
        setRunTour(false);
      }
    }
  }, [usuarios, equipos, modalUsuario, modalEquipo, equipoAEliminar, usuarioAEliminar, usuarioAEditar]);

  async function cargarDatos() {
  const empresa_id = usuarioActual!.empresaId;

  try {
    setIsLoading(true);

    const [{ data: usuData }, { data: eqData }, { data: asigData }] =
      await Promise.all([
        // ✅ Sin .eq("empresa_id") — RLS lo valida automáticamente
        supabase
          .from("usuarios")
          .select("uid, nombre_completo, activo")
          .eq("activo", true)
          .order("nombre_completo"),

        // ✅ Sin .eq("empresa_id") — RLS lo valida automáticamente
        supabase
          .from("equipos")
          .select("equipo_id, nombre")
          .order("nombre"),

        // ✅ Sin filtro (es tabla junction, no tiene RLS directa)
        supabase
          .from("equipo_miembros")
          .select("equipo_id, user_id"),
      ]);

    const uids = (usuData as UsuarioRaw[] | null ?? []).map((u) => u.uid);

    const { data: rolesData } = uids.length > 0
      ? await supabase
          .from("user_roles")
          .select("user_id, roles(name)")
          .in("user_id", uids)
      : { data: [] as RolRow[] };

    setUsuarios(
      (usuData as UsuarioRaw[] | null ?? []).map((u) => {
        const rolRow = (rolesData as RolRow[] | null ?? []).find(
          (r) => r.user_id === u.uid
        );
        return {
          uid: u.uid,
          nombre_completo: u.nombre_completo,
          email: "",
          activo: u.activo,
          rol: rolRow?.roles?.name ?? null,
        };
      })
    );

    setEquipos(eqData ?? []);
    setAsignaciones(asigData ?? []);
  } catch (error) {
    console.error("Error cargando datos:", error);
  } finally {
    setIsLoading(false);
  }
}


  // --- Helpers ---
  const iniciales = (n: string) =>
    n
      ? n
          .split(" ")
          .slice(0, 2)
          .map((p) => p[0])
          .join("")
          .toUpperCase()
      : "?";

  const toggleEquipo = (id: number) => {
    setEquiposColapsados((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // --- Lógica de Filtros (Derivada y Reactiva) ---
  const usuariosFiltrados = useMemo(() => {
    const q = filtroUsuario.toLowerCase();

    return usuarios.filter(
      (u) =>
        u.nombre_completo.toLowerCase().includes(q) ||
        (u.rol && u.rol.toLowerCase().includes(q))
    );
  }, [usuarios, filtroUsuario]);

  const equiposFiltrados = useMemo(() => {
    const q = filtroEquipo.toLowerCase();

    return equipos.filter((eq) => {
      const matchNombre = eq.nombre.toLowerCase().includes(q);

      const miembros = asignaciones
        .filter((a) => a.equipo_id === eq.equipo_id)
        .map((a) => usuarios.find((u) => u.uid === a.user_id))
        .filter(Boolean) as Usuario[];

      const matchMiembro = miembros.some((u) =>
        u.nombre_completo.toLowerCase().includes(q)
      );

      return matchNombre || matchMiembro;
    });
  }, [equipos, asignaciones, usuarios, filtroEquipo]);

  // --- Acciones Drag & Drop ---
  async function handleDrop(equipo_id: number) {
    if (!draggedUserId) return;

    const user_id = draggedUserId;
    setDraggedUserId(null);

    console.log("[handleDrop] equipoId:", equipo_id, "userId:", user_id);

    // Validación: usuario ya en equipo
    if (asignaciones.some((a) => a.equipo_id === equipo_id && a.user_id === user_id)) {
      console.log("[Validación] Usuario ya en equipo → error");
      toast.error("El usuario ya pertenece a este equipo");
      return;
    }

    // Validación: usuario activo
    const usuario = usuarios.find((u) => u.uid === user_id);
    if (!usuario?.activo) {
      console.log("[Validación] Usuario inactivo → warning");
      toast.warning("No puedes asignar usuarios inactivos");
      return;
    }

    const nuevaAsignacion = { equipo_id, user_id };

    // Optimistic update
    setAsignaciones((prev) => [...prev, nuevaAsignacion]);

    const insertPromise = (async () => {
      const { error } = await supabase
        .from("equipo_miembros")
        .insert(nuevaAsignacion);
      if (error) {
        setAsignaciones((prev) =>
          prev.filter(
            (a) => !(a.equipo_id === equipo_id && a.user_id === user_id)
          )
        );
        console.error("[Usuarios] Error al asignar usuario: userId=", user_id);
        throw error;
      }
      supabase.rpc("log_usuario_accion", {
        p_accion: "ASSIGN_USUARIO_EQUIPO",
        p_tabla: "equipo_miembros",
        p_registro_id: user_id,
        p_datos_prev: null,
        p_datos_new: {
          usuario_nombre: usuarios.find((u) => u.uid === user_id)?.nombre_completo ?? user_id,
          equipo_nombre: equipos.find((e) => e.equipo_id === equipo_id)?.nombre ?? String(equipo_id),
          equipo_id: String(equipo_id),
        },
      }).then((res: any) => {
        if (res.error) console.error("[handleDrop] log error:", res.error.message);
      });
    })();

    toast.promise(insertPromise, {
      loading: "Asignando usuario...",
      success: "Usuario asignado correctamente",
      error: "Error al asignar usuario",
    });
  }

  function removerUsuario(equipo_id: number, user_id: string) {
    console.log("[removerUsuario] equipoId:", equipo_id, "userId:", user_id);

    const usuario = usuarios.find((u) => u.uid === user_id);
    const nombre = usuario?.nombre_completo ?? "Usuario";

    const deletePromise = (async () => {
      const { error } = await supabase
        .from("equipo_miembros")
        .delete()
        .eq("equipo_id", equipo_id)
        .eq("user_id", user_id);
      if (error) throw error;
      setAsignaciones((prev) =>
        prev.filter(
          (a) => !(a.equipo_id === equipo_id && a.user_id === user_id)
        )
      );
      supabase.rpc("log_usuario_accion", {
        p_accion: "REMOVE_USUARIO_EQUIPO",
        p_tabla: "equipo_miembros",
        p_registro_id: user_id,
        p_datos_prev: {
          usuario_nombre: usuarios.find((u) => u.uid === user_id)?.nombre_completo ?? user_id,
          equipo_nombre: equipos.find((e) => e.equipo_id === equipo_id)?.nombre ?? String(equipo_id),
          equipo_id: String(equipo_id),
        },
        p_datos_new: null,
      }).then(({ error: logErr }: { error: { message: string } | null }) => {
        if (logErr) console.error("[removerUsuario] log error:", logErr.message);
      });
    })();

    toast.promise(deletePromise, {
      loading: `Removiendo a ${nombre}...`,
      success: () => {
        setTimeout(() => {
          toast(`${nombre} removido del equipo`, {
            description: "Deshacer en 5 segundos",
            action: {
              label: "Deshacer",
              onClick: () => handleUndo({ equipo_id, user_id }),
            },
            duration: 5000,
          });
        }, 500);
        return `${nombre} removido`;
      },
      error: "Error al remover usuario",
    });
  }

  function handleUndo(datos: { equipo_id: number; user_id: string }) {
    const undoPromise = (async () => {
      const { error } = await supabase
        .from("equipo_miembros")
        .insert(datos);
      if (error) throw error;
      setAsignaciones((prev) => [...prev, datos]);
    })();

    toast.promise(undoPromise, {
      loading: "Restaurando...",
      success: "Usuario restaurado al equipo",
      error: "Error al restaurar usuario",
    });
  }

  // --- Acciones de Usuarios ---
  async function handleCrearUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const result = await crearUsuario(formCrear);
    setSubmitting(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Usuario creado correctamente");
    cerrarModalUsuario();
    await cargarDatos();
  }

  function abrirEditar(u: Usuario) {
    const rol =
      u.rol === "encargado" || u.rol === "revisor" ? u.rol : "encargado";
    setUsuarioAEditar(u);
    setFormEditar({ nombre_completo: u.nombre_completo, rol, activo: u.activo });
    setModalEditar(true);
    setDropdownUserId(null);
  }

  async function handleEditarUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioAEditar || submitting) return;
    setSubmitting(true);
    const result = await editarUsuario(usuarioAEditar.uid, formEditar);
    setSubmitting(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Usuario actualizado");
    setModalEditar(false);
    setUsuarioAEditar(null);
    await cargarDatos();
  }

  async function handleEliminarUsuario() {
    if (!usuarioAEliminar || submitting) return;
    if (usuarioAEliminar.uid === usuarioActual!.uid) {
      toast.error("No puedes eliminarte a ti mismo");
      return;
    }
    setSubmitting(true);
    const result = await eliminarUsuario(usuarioAEliminar.uid);
    setSubmitting(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Usuario desactivado correctamente");
    setUsuarioAEliminar(null);
    await cargarDatos();
  }

  // --- Helpers de Cierre ---
  function cerrarModalUsuario() {
    setModalUsuario(false);
    setFormCrear({ email: "", nombre_completo: "", rol: "encargado", activo: true });
    setTabUsuario("individual");
    setCsvUsuariosData(null);
  }

  function cerrarModalEquipo() {
    setModalEquipo(false);
    setNuevoEquipoNombre("");
    setTabEquipo("individual");
    setCsvEquiposData(null);
    setCsvEqUsuData(null);
  }

  // --- Carga Masiva ---
  async function handleFileDrop(file: File, tipo: "usuarios" | "equipos" | "equipos_usuarios") {
    try {
      const texto = await leerArchivo(file);
      if (tipo === "usuarios") setCsvUsuariosData(parsearCSVUsuarios(texto));
      else if (tipo === "equipos") setCsvEquiposData(parsearCSVEquipos(texto));
      else setCsvEqUsuData(parsearCSVEquiposUsuarios(texto));
    } catch {
      toast.error("Error al leer el archivo");
    }
  }

  async function callBulkEdgeFunction(
    path: string,
    body: Record<string, unknown>
  ): Promise<BulkResponse | null> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { toast.error("Sesión expirada"); return null; }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json() as BulkResponse & { error?: string };

    if (!res.ok) {
      toast.error(data.error ?? "Error del servidor");
      return null;
    }

    return data;
  }

  async function handleBulkCrearUsuarios() {
    if (!csvUsuariosData?.validos.length || submittingBulk) return;
    setSubmittingBulk(true);
    const data = await callBulkEdgeFunction("bulk-crear-usuarios", {
      usuarios: csvUsuariosData.validos,
    });
    setSubmittingBulk(false);
    if (!data) return;

    if (data.fallidos.length > 0) {
      const detalle = data.fallidos.map((f) => f.email ?? f.nombre ?? "").join(", ");
      toast.warning(`${data.exitosos} creados, ${data.fallidos.length} fallidos: ${detalle}`);
    } else {
      toast.success(`${data.exitosos} usuarios creados correctamente`);
    }
    cerrarModalUsuario();
    await cargarDatos();
  }

  
  async function handleBulkCrearEquipos() {
    if (!csvEquiposData?.validos.length || submittingBulk) return;
    setSubmittingBulk(true);
    const data = await callBulkEdgeFunction("bulk-crear-equipos", {
      equipos: csvEquiposData.validos.map((e) => ({ nombre: e.nombre_equipo })),
    });
    setSubmittingBulk(false);
    if (!data) return;

    if (data.fallidos.length > 0) {
      const detalle = data.fallidos.map((f) => f.nombre ?? f.email ?? "").join(", ");
      toast.warning(`${data.exitosos} creados, ${data.fallidos.length} fallidos: ${detalle}`);
    } else {
      toast.success(`${data.exitosos} equipos creados correctamente`);
    }
    cerrarModalEquipo();
    await cargarDatos();
  }

  async function handleBulkCrearEquiposUsuarios() {
    if (!csvEqUsuData?.validos.length || submittingBulk) return;
    setSubmittingBulk(true);
    const data = await callBulkEdgeFunction("bulk-crear-equipos-usuarios", {
      registros: csvEqUsuData.validos,
    });
    setSubmittingBulk(false);
    if (!data) return;

    if (data.fallidos.length > 0) {
      const detalle = data.fallidos.map((f) => f.email ?? "").join(", ");
      toast.warning(
        `${data.exitosos} creados, ${data.fallidos.length} fallidos: ${detalle}` +
        (data.equipos_creados ? ` | ${data.equipos_creados} equipos nuevos` : "")
      );
    } else {
      toast.success(
        `${data.exitosos} registros creados` +
        (data.equipos_creados ? ` | ${data.equipos_creados} equipos nuevos` : "")
      );
    }
    cerrarModalEquipo();
    await cargarDatos();
  }

  // --- Acciones de Equipos ---
  async function crearEquipo(e: React.FormEvent) {
    e.preventDefault();

    if (!nuevoEquipoNombre.trim() || creando) return;

    setCreando(true);

    const { data: nuevo, error } = await supabase
      .from("equipos")
      .insert({
        nombre: nuevoEquipoNombre,
        empresa_id: usuarioActual!.empresaId,
      })
      .select("equipo_id, nombre")
      .single();

    setCreando(false);

    if (error) {
      toast.error("Error al crear equipo");
      return;
    }

    setEquipos((prev) => [...prev, nuevo]);
    toast.success("Equipo creado correctamente");

    supabase.rpc("log_usuario_accion", {
      p_accion: "CREATE_EQUIPO",
      p_tabla: "equipos",
      p_registro_id: String(nuevo.equipo_id),
      p_datos_prev: null,
      p_datos_new: { nombre: nuevo.nombre },
    }).then(({ error: logErr }: { error: { message: string } | null }) => {
      if (logErr) console.error("[crearEquipo] log error:", logErr.message);
    });

    cerrarModalEquipo();
  }

  async function eliminarEquipo() {
    if (!equipoAEliminar) return;

    setCreando(true);

    const eqId = equipoAEliminar;
    const eqNombre = equipos.find((e) => e.equipo_id === eqId)?.nombre ?? "";

    const eqBackup = equipos;
    const asigBackup = asignaciones;

    setEquipos((prev) => prev.filter((e) => e.equipo_id !== eqId));
    setAsignaciones((prev) => prev.filter((a) => a.equipo_id !== eqId));
    setModalEliminarCerrar();
    toast.success("Equipo eliminado");

    const { error } = await supabase
      .from("equipos")
      .delete()
      .eq("equipo_id", eqId);

    setCreando(false);

    if (error) {
      setEquipos(eqBackup);
      setAsignaciones(asigBackup);
      toast.error("Error al eliminar equipo");
      return;
    }

    supabase.rpc("log_usuario_accion", {
      p_accion: "DELETE_EQUIPO",
      p_tabla: "equipos",
      p_registro_id: String(eqId),
      p_datos_prev: { equipo_id: eqId, nombre: eqNombre },
      p_datos_new: null,
    }).then(({ error: logErr }: { error: { message: string } | null }) => {
      if (logErr) console.error("[eliminarEquipo] log error:", logErr.message);
    });
  }

  const setModalEliminarCerrar = () => {
    setEquipoAEliminar(null);
  };

  // --- Render Protection ---
  if (!usuarioActual) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-5">
        Cargando…
      </div>
    );
  }

  if (usuarioActual.rol !== "administrador") {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-5">
        Sin permisos
      </div>
    );
  }

  return (
    <>
      {dropdownUserId && (
        <div
          className="fixed inset-0 z-[9]"
          onClick={() => setDropdownUserId(null)}
        />
      )}

      {/* JOYRIDE (NO TOCAR) */}
      <Joyride
        steps={steps}
        run={runTour}
        continuous
        showProgress
        showSkipButton
        disableScrolling={false}
        styles={{
          options: {
            primaryColor: "#22c55e",
            textColor: "#111827",
            zIndex: 9999,
          },
        }}
        callback={(data: any) => {
          const { status } = data;

          if (
            status === "finished" ||
            status === "skipped"
          ) {
            setRunTour(false);

            localStorage.setItem(
              "tour-usuarios-completed",
              "true"
            );
          }
        }}
      />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        {/* Header Clásico */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-9">
              Usuarios y Equipos
            </h1>
            <p className="mt-1 text-sm text-gray-5">
              Arrastra a los usuarios para asignarlos a un equipo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsActivityOpen(true)}
            className="flex items-center gap-2 text-sm font-medium text-gray-7 hover:text-primary-7 transition-colors"
            title="Ver actividad de usuarios"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Actividad
          </button>
        </div>

        {/* Workspace Principal */}
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[500px]">
          {/* ==================================
              COLUMNA 1: USUARIOS
              ================================== */}
          <div className="flex flex-1 flex-col overflow-hidden min-h-0 rounded-xl border border-gray-2 bg-white shadow-sm">
            {/* Header del Panel */}
            <div className="flex items-center justify-between border-b border-gray-2 bg-gray-0 p-4">
              <div className="flex items-center gap-2 font-bold text-gray-9">
                <svg
                  className="h-5 w-5 text-primary-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>

                Usuarios

                <span className="ml-1 rounded-full bg-primary-1 px-2 py-0.5 text-xs text-primary-7">
                  {usuarios.length}
                </span>
              </div>

              <button
                onClick={() => setModalUsuario(true)}
                className="btn btn-primary h-8 px-3 text-xs shadow-none"
              >
                Crear usuario
              </button>
            </div>

            {/* Buscador */}
            <div className="border-b border-gray-2 p-3">
              <input
                type="text"
                placeholder="Buscar por nombre o rol..."
                value={filtroUsuario}
                onChange={(e) =>
                  setFiltroUsuario(e.target.value)
                }
                className="w-full rounded-md border border-gray-3 bg-gray-0 px-3 py-1.5 text-sm outline-none focus:border-primary-5"
              />
            </div>

            {/* Lista Scrolleable USUARIOS */}
            <div
              id="lista-usuarios"
              className="flex-1 overflow-y-auto p-3 flex flex-col gap-2"
            >
              {isLoading ? (
                // 🔥 SKELETONS
                [...Array(6)].map((_, i) => (
                  <div
                    key={`skel-u-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-gray-2 p-2.5"
                  >
                    <div className="h-8 w-8 shrink-0 rounded-full bg-gray-2 animate-pulse" />

                    <div className="flex flex-1 flex-col gap-2">
                      <div className="h-3 w-32 rounded bg-gray-2 animate-pulse" />
                      <div className="h-2 w-20 rounded bg-gray-2 animate-pulse" />
                    </div>

                    <div className="h-5 w-14 rounded-full bg-gray-2 animate-pulse" />
                  </div>
                ))
              ) : usuariosFiltrados.length === 0 ? (
                // EMPTY STATE
                <div className="flex flex-col items-center justify-center p-8 text-gray-5">
                  <p className="text-sm">No se encontraron usuarios</p>
                </div>
              ) : (
                // REAL DATA
                usuariosFiltrados.map((u) => (
                  <div
                    key={u.uid}
                    draggable
                    onDragStart={() => setDraggedUserId(u.uid)}
                    onDragEnd={() => setDraggedUserId(null)}
                    className={`user-item group flex cursor-grab active:cursor-grabbing items-center gap-3 rounded-lg border p-2.5 transition-all hover:shadow-card hover:border-primary-4 ${
                      u.activo
                        ? "border-gray-2 bg-white"
                        : "border-gray-2 bg-gray-1 opacity-70"
                    } ${
                      draggedUserId === u.uid
                        ? "opacity-50 ring-2 ring-primary-5"
                        : ""
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        u.activo
                          ? "bg-primary-1 text-primary-7"
                          : "bg-gray-2 text-gray-5"
                      }`}
                    >
                      {iniciales(u.nombre_completo)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`truncate text-sm font-semibold ${
                          u.activo ? "text-gray-9" : "text-gray-6"
                        }`}
                      >
                        {u.nombre_completo}
                      </p>

                      <p className="text-xs text-gray-5 capitalize flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            u.rol === "administrador"
                              ? "bg-info"
                              : u.rol === "encargado"
                              ? "bg-primary"
                              : "bg-warning"
                          }`}
                        />

                        {u.rol || "Sin rol"}
                      </p>
                    </div>

                    <span
                      className={`badge ${
                        u.activo
                          ? "badge-success"
                          : "bg-gray-2 text-gray-6"
                      }`}
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>

                    {/* Dropdown [⋮] */}
                    <div
                      className="relative"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropdownUserId(
                            dropdownUserId === u.uid ? null : u.uid
                          );
                        }}
                        className="relative z-10 rounded p-1 text-gray-5 hover:bg-gray-2 transition-colors"
                        aria-label="Acciones"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 -960 960 960"
                        >
                          <path d="M479.86-160Q460-160 446-174.14t-14-34Q432-228 446.14-242t34-14Q500-256 514-241.86t14 34Q528-188 513.86-174t-34 14Zm0-272Q460-432 446-446.14t-14-34Q432-500 446.14-514t34-14Q500-528 514-513.86t14 34Q528-460 513.86-446t-34 14Zm0-272Q460-704 446-718.14t-14-34Q432-772 446.14-786t34-14Q500-800 514-785.86t14 34Q528-732 513.86-718t-34 14Z" />
                        </svg>
                      </button>
                      {dropdownUserId === u.uid && (
                        <div className="absolute right-0 top-8 z-10 w-36 rounded-lg border border-gray-2 bg-white py-1 shadow-card">
                          <button
                            type="button"
                            onClick={() => abrirEditar(u)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-8 hover:bg-gray-1 transition-colors"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={u.rol === "administrador"}
                            title={u.rol === "administrador" ? "No se puede eliminar a un administrador" : undefined}
                            onClick={() => {
                              if (u.rol === "administrador") return;
                              setUsuarioAEliminar(u);
                              setDropdownUserId(null);
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors ${
                              u.rol === "administrador"
                                ? "text-gray-4 cursor-not-allowed"
                                : "text-critique-6 hover:bg-critique-1"
                            }`}
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* ==================================
              COLUMNA 2: EQUIPOS (Dropzones)
              ================================== */}
          <div className="flex flex-1 flex-col overflow-hidden min-h-0 max-h-full rounded-xl border border-gray-2 bg-white shadow-sm">
            {/* Header del Panel */}
            <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-2 bg-gray-0 p-4">
              <div className="flex items-center gap-2 font-bold text-gray-9">
                <svg
                  className="h-5 w-5 text-primary-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>

                Equipos

                <span className="ml-1 rounded-full bg-primary-1 px-2 py-0.5 text-xs text-primary-7">
                  {equipos.length}
                </span>
              </div>

              <button
                onClick={() => setModalEquipo(true)}
                className="btn btn-primary h-8 px-3 text-xs shadow-none"
              >
                Crear equipo
              </button>
            </div>

            {/* Buscador */}
            <div className="flex-shrink-0 border-b border-gray-2 p-3">
              <input
                type="text"
                placeholder="Buscar por equipo o miembro..."
                value={filtroEquipo}
                onChange={(e) =>
                  setFiltroEquipo(e.target.value)
                }
                className="w-full rounded-md border border-gray-3 bg-gray-0 px-3 py-1.5 text-sm outline-none focus:border-primary-5"
              />
            </div>

            {/* Lista Scrolleable Equipos */}
            <div className="flex-1 overflow-y-auto min-h-0 p-3 flex flex-col gap-3">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="flex flex-col rounded-lg border border-gray-2 overflow-hidden">
                    <div className="flex items-center justify-between bg-primary-0 p-3">
                      <div className="h-4 w-32 rounded bg-gray-2 animate-pulse" />
                      <div className="h-4 w-6 rounded-full bg-gray-2 animate-pulse" />
                    </div>
                    <div className="p-2 min-h-[60px] bg-white" />
                  </div>
                ))
              ) : equiposFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-5">
                  <p className="text-sm">No se encontraron equipos</p>
                </div>
              ) : (
                equiposFiltrados.map((eq) => {
                  const miembrosDelEquipo = asignaciones
                    .filter(
                      (a) =>
                        a.equipo_id === eq.equipo_id
                    )
                    .map((a) =>
                      usuarios.find(
                        (u) => u.uid === a.user_id
                      )
                    )
                    .filter(Boolean) as Usuario[];

                  const isCollapsed =
                    equiposColapsados[eq.equipo_id];

                  return (
                    <div
                      key={eq.equipo_id}
                      className="equipo-card shrink-0 flex flex-col rounded-lg border border-gray-2 bg-white overflow-hidden transition-all"
                    >
                      {/* Equipo Header */}
                      <div
                        className="flex cursor-pointer items-center justify-between bg-primary-0 p-3 transition-colors hover:bg-primary-1"
                        onClick={() =>
                          toggleEquipo(eq.equipo_id)
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary-7">
                            {eq.nombre}
                          </span>

                          <span className="rounded-full border border-gray-2 bg-white px-2 py-0.5 text-xs text-gray-6">
                            {miembrosDelEquipo.length}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEquipoAEliminar(
                                eq.equipo_id
                              );
                            }}
                            className="rounded p-1 text-gray-5 hover:bg-critique-1 hover:text-critique-6 transition-colors"
                            title="Eliminar Equipo"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>

                          <svg
                            className={`h-5 w-5 text-primary-5 transition-transform ${
                              isCollapsed
                                ? "-rotate-90"
                                : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* Dropzone */}
                      {!isCollapsed && (
                        <div
                          className={`p-2 min-h-[60px] flex flex-col gap-2 transition-colors ${
                            draggedUserId
                              ? "bg-primary-1 border-dashed border-2 border-primary-3"
                              : "bg-white"
                          }`}
                          onDragOver={(e) =>
                            e.preventDefault()
                          }
                          onDrop={() =>
                            handleDrop(eq.equipo_id)
                          }
                        >
                          {miembrosDelEquipo.length ===
                          0 ? (
                            <div className="flex h-full items-center justify-center rounded border border-dashed border-gray-3 py-4 text-xs text-gray-5 pointer-events-none">
                              Arrastra usuarios aquí
                            </div>
                          ) : (
                            miembrosDelEquipo.map((u) => (
                              <div key={u.uid}>
                                {usuarioARemover?.equipoId === eq.equipo_id &&
                                usuarioARemover?.userId === u.uid ? (
                                  <div className="flex items-center justify-between rounded-md border-2 border-critique-2 bg-critique-1 p-2">
                                    <span className="text-xs font-semibold text-critique-7">
                                      ¿Remover a {u.nombre_completo}?
                                    </span>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          removerUsuario(eq.equipo_id, u.uid);
                                          setUsuarioARemover(null);
                                        }}
                                        className="btn bg-critique-6 text-white hover:bg-critique-7 text-xs h-6 px-2"
                                      >
                                        Sí, remover
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setUsuarioARemover(null)}
                                        className="btn btn-outline text-xs h-6 px-2"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between rounded-md border border-gray-2 p-2 bg-gray-0">
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-1 text-[10px] font-bold text-primary-7">
                                        {iniciales(u.nombre_completo)}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-gray-9">
                                          {u.nombre_completo}
                                        </span>
                                        <span className="text-[10px] text-gray-5 capitalize">
                                          {u.rol}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      aria-label="Remover usuario del equipo"
                                      title="Remover usuario"
                                      onClick={() =>
                                        setUsuarioARemover({
                                          equipoId: eq.equipo_id,
                                          userId: u.uid,
                                        })
                                      }
                                      className="rounded p-1 text-gray-4 hover:bg-critique-1 hover:text-critique-6 transition-colors"
                                    >
                                      <svg
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M6 18L18 6M6 6l12 12"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ==================================
            MODALES
            ================================== */}

        {/* Modal Crear Usuario */}
        {modalUsuario && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className={`w-full rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5 transition-all ${tabUsuario === "masivo" ? "max-w-2xl" : "max-w-sm"}`}>
              <h2 className="mb-4 text-lg font-bold text-gray-9">Nuevo usuario</h2>

              {/* Tabs */}
              <div className="mb-5 flex gap-1 rounded-lg bg-gray-1 p-1">
                <button
                  type="button"
                  onClick={() => setTabUsuario("individual")}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${tabUsuario === "individual" ? "bg-white text-gray-9 shadow-sm" : "text-gray-5 hover:text-gray-7"}`}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setTabUsuario("masivo")}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${tabUsuario === "masivo" ? "bg-white text-gray-9 shadow-sm" : "text-gray-5 hover:text-gray-7"}`}
                >
                  Carga masiva
                </button>
              </div>

              {tabUsuario === "individual" ? (
                <form onSubmit={handleCrearUsuario}>
                  <div className="flex flex-col gap-4 mb-6">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-7">Email</label>
                      <input
                        type="email"
                        required
                        autoFocus
                        value={formCrear.email}
                        onChange={(e) => setFormCrear((f) => ({ ...f, email: e.target.value }))}
                        className="w-full rounded-md border border-gray-3 p-2 text-sm outline-none focus:border-primary-5 focus:ring-1 focus:ring-primary-5"
                        placeholder="juan@empresa.cl"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-7">Nombre completo</label>
                      <input
                        type="text"
                        required
                        value={formCrear.nombre_completo}
                        onChange={(e) => setFormCrear((f) => ({ ...f, nombre_completo: e.target.value }))}
                        className="w-full rounded-md border border-gray-3 p-2 text-sm outline-none focus:border-primary-5 focus:ring-1 focus:ring-primary-5"
                        placeholder="Juan García"
                      />
                    </div>
                    <div>
                      <label htmlFor="crear-rol" className="mb-1 block text-sm font-semibold text-gray-7">Rol</label>
                      <select
                        id="crear-rol"
                        title="Rol"
                        value={formCrear.rol}
                        onChange={(e) => setFormCrear((f) => ({ ...f, rol: e.target.value }))}
                        className="w-full rounded-md border border-gray-3 p-2 text-sm outline-none focus:border-primary-5 focus:ring-1 focus:ring-primary-5"
                      >
                        <option value="encargado">Encargado</option>
                        <option value="revisor">Revisor</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-gray-2 p-3">
                      <span className="text-sm font-semibold text-gray-7">Activo</span>
                      <button
                        type="button"
                        title="Activo"
                        aria-label={formCrear.activo ? "Activo: sí" : "Activo: no"}
                        onClick={() => setFormCrear((f) => ({ ...f, activo: !f.activo }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formCrear.activo ? "bg-primary-5" : "bg-gray-3"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formCrear.activo ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={cerrarModalUsuario} className="btn btn-outline text-xs">Cancelar</button>
                    <button type="submit" disabled={submitting} className="btn btn-primary text-xs">
                      {submitting ? "Creando..." : "Crear"}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  {!csvUsuariosData ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file?.name.endsWith(".csv")) void handleFileDrop(file, "usuarios");
                      }}
                      onClick={() => document.getElementById("csv-usuarios-input")?.click()}
                      className="mb-4 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-3 p-8 cursor-pointer hover:border-primary-4 transition-colors"
                    >
                      <svg className="h-8 w-8 text-gray-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm font-medium text-gray-7">Arrastra tu CSV aquí</p>
                      <p className="text-xs text-gray-5">o haz click para seleccionar</p>
                      <a
                        href="/templates/template_usuarios.csv"
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 text-xs text-primary-6 hover:underline"
                      >
                        Descargar plantilla (nombre_completo, email, rol)
                      </a>
                      <input
                        id="csv-usuarios-input"
                        type="file"
                        accept=".csv"
                        aria-label="Seleccionar archivo CSV de usuarios"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleFileDrop(file, "usuarios");
                          e.target.value = "";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex gap-3">
                          {csvUsuariosData.validos.length > 0 && (
                            <span className="text-xs font-medium text-success-7">✓ {csvUsuariosData.validos.length} válidos</span>
                          )}
                          {csvUsuariosData.errores.length > 0 && (
                            <span className="text-xs font-medium text-critique-6">✗ {csvUsuariosData.errores.length} con error</span>
                          )}
                        </div>
                        <button type="button" onClick={() => setCsvUsuariosData(null)} className="text-xs text-gray-5 hover:text-gray-7 underline">
                          Cambiar archivo
                        </button>
                      </div>
                      {csvUsuariosData.validos.length > 0 && (
                        <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-2 mb-2">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-gray-0 border-b border-gray-2">
                              <tr>
                                <th className="py-1.5 px-2 text-left font-semibold text-gray-6">Nombre</th>
                                <th className="py-1.5 px-2 text-left font-semibold text-gray-6">Email</th>
                                <th className="py-1.5 px-2 text-left font-semibold text-gray-6">Rol</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-1">
                              {csvUsuariosData.validos.map((fila, i) => (
                                <tr key={i} className="hover:bg-gray-0">
                                  <td className="py-1.5 px-2 text-gray-8">{fila.nombre_completo}</td>
                                  <td className="py-1.5 px-2 text-gray-6 truncate max-w-[160px]">{fila.email}</td>
                                  <td className="py-1.5 px-2 capitalize text-gray-6">{fila.rol}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {csvUsuariosData.errores.length > 0 && (
                        <div className="max-h-24 overflow-y-auto rounded-lg border border-critique-3 bg-critique-1 p-2">
                          {csvUsuariosData.errores.map((err, i) => (
                            <p key={i} className="text-xs text-critique-7">Fila {err.fila}: {err.error}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={cerrarModalUsuario} className="btn btn-outline text-xs">Cancelar</button>
                    <button
                      type="button"
                      onClick={handleBulkCrearUsuarios}
                      disabled={!csvUsuariosData?.validos.length || submittingBulk}
                      className="btn btn-primary text-xs"
                    >
                      {submittingBulk ? "Subiendo..." : `Subir ${csvUsuariosData?.validos.length ?? 0} usuarios`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Crear Equipo */}
        {modalEquipo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div
              className={`w-full rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5 transition-all ${
                tabEquipo === "individual"
                  ? "max-w-sm"
                  : "max-w-2xl"
              }`}
            >
              <h2 className="mb-4 text-lg font-bold text-gray-9">
                Nuevo equipo
              </h2>

              {/* Tabs */}
              <div className="mb-5 flex gap-1 rounded-lg bg-gray-1 p-1">
                <button
                  type="button"
                  onClick={() => setTabEquipo("individual")}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    tabEquipo === "individual"
                      ? "bg-white text-gray-9 shadow-sm"
                      : "text-gray-5 hover:text-gray-7"
                  }`}
                >
                  Individual
                </button>

                <button
                  type="button"
                  onClick={() => setTabEquipo("solo_equipos")}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    tabEquipo === "solo_equipos"
                      ? "bg-white text-gray-9 shadow-sm"
                      : "text-gray-5 hover:text-gray-7"
                  }`}
                >
                  Solo equipos
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTabEquipo("equipos_usuarios")
                  }
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    tabEquipo === "equipos_usuarios"
                      ? "bg-white text-gray-9 shadow-sm"
                      : "text-gray-5 hover:text-gray-7"
                  }`}
                >
                  Equipos + usuarios
                </button>
              </div>

              {/* ======================================
                  TAB INDIVIDUAL
                  ====================================== */}
              {tabEquipo === "individual" ? (
                <form onSubmit={crearEquipo}>
                  <div className="mb-4">
                    <label className="mb-1 block text-sm font-semibold text-gray-7">
                      Nombre del equipo
                    </label>

                    <input
                      type="text"
                      autoFocus
                      required
                      value={nuevoEquipoNombre}
                      onChange={(e) =>
                        setNuevoEquipoNombre(e.target.value)
                      }
                      className="w-full rounded-md border border-gray-3 p-2 text-sm outline-none focus:border-primary-5 focus:ring-1 focus:ring-primary-5"
                      placeholder="Ej: Equipo Alpha"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cerrarModalEquipo}
                      className="btn btn-outline text-xs"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={creando}
                      className="btn btn-primary text-xs"
                    >
                      {creando
                        ? "Creando..."
                        : "Crear"}
                    </button>
                  </div>
                </form>
              ) : tabEquipo === "solo_equipos" ? (
                /* ======================================
                    TAB SOLO EQUIPOS
                    ====================================== */
                <div>
                  {!csvEquiposData ? (
                    <div
                      onDragOver={(e) =>
                        e.preventDefault()
                      }
                      onDrop={(e) => {
                        e.preventDefault();

                        const file =
                          e.dataTransfer.files[0];

                        if (
                          file?.name.endsWith(".csv")
                        ) {
                          void handleFileDrop(
                            file,
                            "equipos"
                          );
                        }
                      }}
                      onClick={() =>
                        document
                          .getElementById(
                            "csv-equipos-input"
                          )
                          ?.click()
                      }
                      className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-3 p-8 transition-colors hover:border-primary-4"
                    >
                      <svg
                        className="h-8 w-8 text-gray-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        />
                      </svg>

                      <p className="text-sm font-medium text-gray-7">
                        Arrastra tu CSV aquí
                      </p>

                      <p className="text-xs text-gray-5">
                        o haz click para seleccionar
                      </p>

                      <a
                        href="/templates/template_equipos.csv"
                        download
                        onClick={(e) =>
                          e.stopPropagation()
                        }
                        className="mt-1 text-xs text-primary-6 hover:underline"
                      >
                        Descargar plantilla
                      </a>

                      <input
                        id="csv-equipos-input"
                        type="file"
                        accept=".csv"
                        aria-label="Seleccionar archivo CSV de equipos"
                        className="hidden"
                        onChange={(e) => {
                          const file =
                            e.target.files?.[0];

                          if (file) {
                            void handleFileDrop(
                              file,
                              "equipos"
                            );
                          }

                          e.target.value = "";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex gap-3">
                          {csvEquiposData.validos.length >
                            0 && (
                            <span className="text-xs font-medium text-success-7">
                              ✓{" "}
                              {
                                csvEquiposData.validos
                                  .length
                              }{" "}
                              válidos
                            </span>
                          )}

                          {csvEquiposData.errores.length >
                            0 && (
                            <span className="text-xs font-medium text-critique-6">
                              ✗{" "}
                              {
                                csvEquiposData.errores
                                  .length
                              }{" "}
                              con error
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setCsvEquiposData(null)
                          }
                          className="text-xs text-gray-5 underline hover:text-gray-7"
                        >
                          Cambiar archivo
                        </button>
                      </div>

                      {csvEquiposData.validos.length >
                        0 && (
                        <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-2">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 border-b border-gray-2 bg-gray-0">
                              <tr>
                                <th className="px-2 py-1.5 text-left font-semibold text-gray-6">
                                  Equipo
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-1">
                              {csvEquiposData.validos.map(
                                (fila, i) => (
                                  <tr
                                    key={i}
                                    className="hover:bg-gray-0"
                                  >
                                    <td className="px-2 py-1.5 text-gray-8">
                                      {
                                        fila.nombre_equipo
                                      }
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {csvEquiposData.errores.length >
                        0 && (
                        <div className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-critique-3 bg-critique-1 p-2">
                          {csvEquiposData.errores.map(
                            (err, i) => (
                              <p
                                key={i}
                                className="text-xs text-critique-7"
                              >
                                Fila {err.fila}:{" "}
                                {err.error}
                              </p>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cerrarModalEquipo}
                      className="btn btn-outline text-xs"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleBulkCrearEquipos
                      }
                      disabled={
                        !csvEquiposData?.validos
                          .length || submittingBulk
                      }
                      className="btn btn-primary text-xs"
                    >
                      {submittingBulk
                        ? "Subiendo..."
                        : `Subir ${
                            csvEquiposData?.validos
                              .length ?? 0
                          } equipos`}
                    </button>
                  </div>
                </div>
              ) : (
                /* ======================================
                    TAB EQUIPOS + USUARIOS
                    ====================================== */
                <div>
                  <div
                    onDragOver={(e) =>
                      e.preventDefault()
                    }
                    onDrop={(e) => {
                      e.preventDefault();

                      const file =
                        e.dataTransfer.files[0];

                      if (
                        file?.name.endsWith(".csv")
                      ) {
                        void handleFileDrop(
                          file,
                          "equipos_usuarios"
                        );
                      }
                    }}
                    onClick={() =>
                      document
                        .getElementById(
                          "csv-equipos-usuarios-input"
                        )
                        ?.click()
                    }
                    className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-3 p-8 transition-colors hover:border-primary-4"
                  >
                    <svg
                      className="h-8 w-8 text-gray-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>

                    <p className="text-sm font-medium text-gray-7">
                      Arrastra tu CSV aquí
                    </p>

                    <p className="text-xs text-gray-5">
                      equipo, nombre_completo,
                      email, rol
                    </p>

                    <input
                      id="csv-equipos-usuarios-input"
                      type="file"
                      accept=".csv"
                      aria-label="Seleccionar archivo CSV de equipos y usuarios"
                      className="hidden"
                      onChange={(e) => {
                        const file =
                          e.target.files?.[0];

                        if (file) {
                          void handleFileDrop(
                            file,
                            "equipos_usuarios"
                          );
                        }

                        e.target.value = "";
                      }}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cerrarModalEquipo}
                      className="btn btn-outline text-xs"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleBulkCrearEquiposUsuarios
                      }
                      disabled={
                        !csvEqUsuData?.validos.length ||
                        submittingBulk
                      }
                      className="btn btn-primary text-xs"
                    >
                      {submittingBulk
                        ? "Subiendo..."
                        : `Subir ${
                            csvEqUsuData?.validos
                              .length ?? 0
                          } registros`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Eliminar Equipo */}
        {equipoAEliminar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-critique-6">
              <h2 className="mb-2 text-lg font-bold text-critique-7">
                Eliminar equipo
              </h2>

              <p className="mb-6 text-sm text-gray-6">
                ¿Estás seguro? Se removerán todos sus
                miembros y esta acción no se puede deshacer.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={setModalEliminarCerrar}
                  className="btn btn-outline text-xs"
                >
                  Cancelar
                </button>

                <button
                  onClick={eliminarEquipo}
                  disabled={creando}
                  className="btn bg-critique-6 text-white hover:bg-critique-7 text-xs"
                >
                  {creando
                    ? "Eliminando..."
                    : "Sí, eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal Editar Usuario */}
        {modalEditar && usuarioAEditar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <form
              onSubmit={handleEditarUsuario}
              className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-primary-5"
            >
              <h2 className="mb-5 text-lg font-bold text-gray-9">
                Editar usuario
              </h2>

              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-7">
                    Email
                  </label>
                  <input
                    id="editar-email"
                    type="email"
                    disabled
                    title="Email"
                    value={usuarioAEditar.email}
                    className="w-full rounded-md border border-gray-2 bg-gray-1 p-2 text-sm text-gray-5 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label
                    htmlFor="editar-nombre"
                    className="mb-1 block text-sm font-semibold text-gray-7"
                  >
                    Nombre completo
                  </label>
                  <input
                    id="editar-nombre"
                    type="text"
                    required
                    autoFocus
                    placeholder="Nombre completo"
                    value={formEditar.nombre_completo}
                    onChange={(e) =>
                      setFormEditar((f) => ({
                        ...f,
                        nombre_completo: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-gray-3 p-2 text-sm outline-none focus:border-primary-5 focus:ring-1 focus:ring-primary-5"
                  />
                </div>

                <div>
                  <label
                    htmlFor="editar-rol"
                    className="mb-1 block text-sm font-semibold text-gray-7"
                  >
                    Rol
                  </label>
                  <select
                    id="editar-rol"
                    title="Rol"
                    value={formEditar.rol}
                    onChange={(e) =>
                      setFormEditar((f) => ({ ...f, rol: e.target.value }))
                    }
                    className="w-full rounded-md border border-gray-3 p-2 text-sm outline-none focus:border-primary-5 focus:ring-1 focus:ring-primary-5"
                  >
                    <option value="encargado">Encargado</option>
                    <option value="revisor">Revisor</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between rounded-md border border-gray-2 p-3">
                    <span className="text-sm font-semibold text-gray-7">
                      Activo
                    </span>
                    <button
                      type="button"
                      title="Activo"
                      aria-label={formEditar.activo ? "Activo: sí" : "Activo: no"}
                      onClick={() =>
                        setFormEditar((f) => ({ ...f, activo: !f.activo }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formEditar.activo ? "bg-primary-5" : "bg-gray-3"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          formEditar.activo ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {usuarioAEditar.activo && !formEditar.activo && (
                    <p className="text-xs text-warning-7 bg-warning-1 border border-warning-3 rounded-md px-3 py-2">
                      ⚠️ El usuario perderá acceso al sistema
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalEditar(false);
                    setUsuarioAEditar(null);
                  }}
                  className="btn btn-outline text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs"
                >
                  {submitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Eliminar Usuario */}
        {usuarioAEliminar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal border-t-4 border-critique-6">
              <h2 className="mb-2 text-lg font-bold text-critique-7">
                Eliminar usuario
              </h2>
              <p className="mb-1 text-sm font-semibold text-gray-8">
                {usuarioAEliminar.nombre_completo}
              </p>
              <p className="mb-6 text-sm text-gray-6">
                Se removerá de todos los equipos. Esta acción no se puede
                deshacer.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUsuarioAEliminar(null)}
                  className="btn btn-outline text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleEliminarUsuario}
                  className="btn bg-critique-6 text-white hover:bg-critique-7 text-xs"
                >
                  {submitting ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ActivityDrawer
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
      />
    </>
  );
}