"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { UsuarioAccionModal } from "./UsuarioAccionModal";
import { VerDatosModal, type DatoItem } from "./VerDatosModal";
import type {
  UsuariosGlobalResult,
  UsuarioGlobalRow,
} from "@/app/actions/admin-usuarios";
import type { EmpresaRow } from "@/app/actions/admin-empresas";

// Tabla global de usuarios (tema oscuro) — ver registro completo + comando.
// h-full: la tabla scrollea dentro de la sección de altura fija del panel.

function formatFecha(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diasDesde(iso: string | null): string {
  if (!iso) return "";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} d`;
}

function datosUsuario(u: UsuarioGlobalRow): DatoItem[] {
  return [
    { label: "UID", valor: u.uid },
    { label: "Email", valor: u.email },
    { label: "Rol", valor: u.rol ?? "—" },
    { label: "Rol global", valor: u.rolGlobal ?? "—" },
    { label: "Empresa", valor: u.empresaNombre },
    { label: "Empresa ID", valor: u.empresaId ?? "—" },
    { label: "Última conexión", valor: formatFecha(u.lastSignInAt) },
    { label: "Creado", valor: formatFecha(u.createdAt) },
  ];
}

type ModalState =
  | { tipo: "ver"; usuario: UsuarioGlobalRow }
  | { tipo: "gestionar"; usuario: UsuarioGlobalRow }
  | null;

export function UsuariosTab({
  usuariosRes,
  empresas,
}: {
  usuariosRes: UsuariosGlobalResult;
  empresas: EmpresaRow[];
}) {
  const [usuarios, setUsuarios] = useState<UsuarioGlobalRow[]>(
    usuariosRes.ok ? usuariosRes.usuarios : []
  );
  const [modal, setModal] = useState<ModalState>(null);

  function handleSaved(uid: string, cambios: Partial<UsuarioGlobalRow>) {
    setUsuarios((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, ...cambios } : u))
    );
  }

  if (!usuariosRes.ok) {
    return (
      <div className="rounded-xl border border-critique-7 bg-critique-9 p-4 text-sm text-critique-3">
        {usuariosRes.error}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <p className="mb-3 shrink-0 text-xs text-[#8C8C8C]">
        {usuarios.length} usuario{usuarios.length === 1 ? "" : "s"} en toda la
        plataforma
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#2A2A2A] bg-[#161616]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Última conexión</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-[#707070]" colSpan={5}>
                  Sin usuarios.
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((u) => (
                <TableRow key={u.uid}>
                  <TableCell className="font-medium text-[#EDEDED]">
                    {u.email}
                    {u.rolGlobal === "superadmin" && (
                      <span className="ml-2 rounded-full bg-primary-7 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-1">
                        superadmin
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-[#8C8C8C]">
                    {u.empresaNombre}
                  </TableCell>
                  <TableCell className="text-[#A1A1A1]">
                    {u.rol ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className="text-[#D4D4D4]">
                      {formatFecha(u.lastSignInAt)}
                    </span>
                    {u.lastSignInAt && (
                      <span className="ml-2 text-xs text-[#707070]">
                        {diasDesde(u.lastSignInAt)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModal({ tipo: "ver", usuario: u })}
                        className="rounded-lg border border-[#2A2A2A] px-2.5 py-1 text-xs font-semibold text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED]"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setModal({ tipo: "gestionar", usuario: u })
                        }
                        className="rounded-lg border border-[#2A2A2A] px-2.5 py-1 text-xs font-semibold text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED]"
                      >
                        Gestionar
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {modal?.tipo === "gestionar" && (
        <UsuarioAccionModal
          usuario={modal.usuario}
          empresas={empresas}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.tipo === "ver" && (
        <VerDatosModal
          titulo={modal.usuario.email}
          subtitulo="Registro completo · usuario"
          datos={datosUsuario(modal.usuario)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
