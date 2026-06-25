"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Settings, Eye } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { NuevaEmpresaModal } from "./NuevaEmpresaModal";
import { VerDatosModal, type DatoItem } from "./VerDatosModal";
import {
  activarPausaEmpresa,
  reactivarPausaEmpresa,
  type EmpresasListResult,
  type EmpresaRow,
} from "@/app/actions/admin-empresas";

const PLAN_STYLE: Record<string, string> = {
  starter: "bg-[#2A2A2A] text-[#A1A1A1]",
  pro: "bg-info-7 text-info-1",
  enterprise: "bg-primary-7 text-primary-1",
};

type ModalState =
  | { tipo: "crear" }
  | { tipo: "editar"; empresa: EmpresaRow }
  | { tipo: "ver"; empresa: EmpresaRow }
  | null;

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function datosEmpresa(e: EmpresaRow): DatoItem[] {
  return [
    { label: "ID", valor: e.empresa_id },
    { label: "Nombre", valor: e.nombre },
    { label: "Dominio", valor: e.dominio_short },
    { label: "Plan", valor: e.plan },
    { label: "Estado", valor: e.activa ? "Activa" : "Inactiva" },
    { label: "Ref", valor: e.ref },
    { label: "Usuarios activos", valor: e.total_usuarios ?? 0 },
    {
      label: "Pausa desde",
      valor: e.pausa_activada_at ? fecha(e.pausa_activada_at) : "—",
    },
    {
      label: "Membresía vence",
      valor: e.membresia_vence_at ? fecha(e.membresia_vence_at) : "—",
    },
    {
      label: "Icono",
      valor: e.icono ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={e.icono}
          alt={e.nombre}
          className="inline-block h-8 w-8 rounded object-contain"
        />
      ) : (
        "—"
      ),
    },
    { label: "Creada", valor: fecha(e.created_at) },
    { label: "Actualizada", valor: fecha(e.updated_at) },
  ];
}

export function EmpresasPanel({ empresasRes }: { empresasRes: EmpresasListResult }) {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>(
    empresasRes.ok ? empresasRes.empresas : []
  );
  const [modal, setModal] = useState<ModalState>(null);
  const [pausando, setPausando] = useState<number | null>(null);

  async function handleTogglePausa(e: EmpresaRow) {
    setPausando(e.empresa_id);
    const enPausa = !!e.pausa_activada_at;
    const res = enPausa
      ? await reactivarPausaEmpresa(e.empresa_id)
      : await activarPausaEmpresa(e.empresa_id);
    setPausando(null);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(res.mensaje);
    setEmpresas((prev) =>
      prev.map((emp) =>
        emp.empresa_id === e.empresa_id
          ? {
              ...emp,
              activa: enPausa ? true : false,
              pausa_activada_at: enPausa ? null : new Date().toISOString(),
            }
          : emp
      )
    );
  }

  function handleSaved(empresa: EmpresaRow) {
    setEmpresas((prev) => {
      const i = prev.findIndex((e) => e.empresa_id === empresa.empresa_id);
      if (i === -1) return [empresa, ...prev];
      const copia = [...prev];
      copia[i] = empresa;
      return copia;
    });
  }

  if (!empresasRes.ok) {
    return (
      <div className="rounded-xl border border-critique-7 bg-critique-9 p-4 text-sm text-critique-3">
        {empresasRes.error}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-5 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#EDEDED]">Empresas</h1>
          <p className="text-xs text-[#707070]">
            {empresas.length} empresa{empresas.length === 1 ? "" : "s"} registrada
            {empresas.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ tipo: "crear" })}
          className="rounded-lg bg-primary-5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-6"
        >
          + Nueva empresa
        </button>
      </div>

      {/* Tabla */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#2A2A2A] bg-[#161616]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Dominio</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-center">Usuarios</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-[#707070]" colSpan={6}>
                  Aún no hay empresas registradas.
                </TableCell>
              </TableRow>
            ) : (
              empresas.map((e) => (
                <TableRow key={e.empresa_id}>
                  {/* Nombre + icono */}
                  <TableCell className="font-medium text-[#EDEDED]">
                    <span className="flex items-center gap-2">
                      {e.icono ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.icono} alt="" className="h-5 w-5 rounded object-contain" />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-[#2A2A2A] text-[9px] font-bold text-[#707070]">
                          {e.nombre.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {e.nombre}
                    </span>
                  </TableCell>

                  {/* Dominio */}
                  <TableCell className="text-[#8C8C8C]">{e.dominio_short}</TableCell>

                  {/* Plan */}
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        PLAN_STYLE[e.plan] ?? "bg-[#2A2A2A] text-[#A1A1A1]"
                      }`}
                    >
                      {e.plan}
                    </span>
                  </TableCell>

                  {/* Usuarios */}
                  <TableCell className="text-center text-sm font-semibold text-[#EDEDED]">
                    {e.total_usuarios ?? 0}
                  </TableCell>

                  {/* Estado */}
                  <TableCell>
                    {e.pausa_activada_at ? (
                      <span className="text-xs font-medium text-warning-4">En pausa</span>
                    ) : e.activa ? (
                      <span className="text-xs font-medium text-primary-4">Activa</span>
                    ) : (
                      <span className="text-xs font-medium text-[#707070]">Inactiva</span>
                    )}
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Ver datos */}
                      <button
                        type="button"
                        title="Ver registro completo"
                        onClick={() => setModal({ tipo: "ver", empresa: e })}
                        className="flex items-center gap-1 rounded-lg border border-[#2A2A2A] px-2.5 py-1 text-xs font-semibold text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED]"
                      >
                        <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                        Ver
                      </button>

                      {/* Pausa / Reactivar */}
                      <button
                        type="button"
                        disabled={pausando === e.empresa_id}
                        onClick={() => handleTogglePausa(e)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          e.pausa_activada_at
                            ? "border-primary-6 text-primary-4 hover:bg-primary-9"
                            : "border-warning-6 text-warning-4 hover:bg-[#2A2218]"
                        }`}
                      >
                        {pausando === e.empresa_id
                          ? "…"
                          : e.pausa_activada_at
                          ? "Reactivar"
                          : "Pausar"}
                      </button>

                      {/* Panel detalle (tuerca) */}
                      <Link
                        href={`/admin/empresas/${e.ref}`}
                        title="Panel de empresa"
                        className="flex items-center justify-center rounded-lg border border-[#2A2A2A] p-1.5 text-[#A1A1A1] transition-colors hover:bg-[#202020] hover:text-[#EDEDED]"
                      >
                        <Settings className="h-3.5 w-3.5" strokeWidth={2} />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modales */}
      {(modal?.tipo === "crear" || modal?.tipo === "editar") && (
        <NuevaEmpresaModal
          modo={modal.tipo}
          empresa={modal.tipo === "editar" ? modal.empresa : undefined}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.tipo === "ver" && (
        <VerDatosModal
          titulo={modal.empresa.nombre}
          subtitulo="Registro completo · tabla empresas"
          datos={datosEmpresa(modal.empresa)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
