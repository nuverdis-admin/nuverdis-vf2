"use client";

import { useState } from "react";
import { toast } from "sonner";
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

// Tabla de empresas (tema oscuro) — alta/edición vía modal + ver registro completo.
// h-full: la tabla scrollea dentro de la sección de altura fija del panel.

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

export function InquilinosTab({
  empresasRes,
}: {
  empresasRes: EmpresasListResult;
}) {
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
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
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
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <p className="text-xs text-[#8C8C8C]">
          {empresas.length} empresa{empresas.length === 1 ? "" : "s"} registrada
          {empresas.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setModal({ tipo: "crear" })}
          className="rounded-lg bg-primary-5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-6"
        >
          + Nueva empresa
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#2A2A2A] bg-[#161616]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Dominio</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-[#707070]" colSpan={5}>
                  Aún no hay empresas registradas.
                </TableCell>
              </TableRow>
            ) : (
              empresas.map((e) => (
                <TableRow key={e.empresa_id}>
                  <TableCell className="font-medium text-[#EDEDED]">
                    <span className="flex items-center gap-2">
                      {e.icono && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.icono}
                          alt=""
                          className="h-5 w-5 rounded object-contain"
                        />
                      )}
                      {e.nombre}
                    </span>
                  </TableCell>
                  <TableCell className="text-[#8C8C8C]">
                    {e.dominio_short}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        PLAN_STYLE[e.plan] ?? "bg-[#2A2A2A] text-[#A1A1A1]"
                      }`}
                    >
                      {e.plan}
                    </span>
                  </TableCell>
                  <TableCell>
                    {e.pausa_activada_at ? (
                      <span className="text-xs font-medium text-warning-4">
                        En pausa
                      </span>
                    ) : e.activa ? (
                      <span className="text-xs font-medium text-primary-4">
                        Activa
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#707070]">
                        Inactiva
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModal({ tipo: "ver", empresa: e })}
                        className="rounded-lg border border-[#2A2A2A] px-2.5 py-1 text-xs font-semibold text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED]"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ tipo: "editar", empresa: e })}
                        className="rounded-lg border border-[#2A2A2A] px-2.5 py-1 text-xs font-semibold text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED]"
                      >
                        Editar
                      </button>
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
