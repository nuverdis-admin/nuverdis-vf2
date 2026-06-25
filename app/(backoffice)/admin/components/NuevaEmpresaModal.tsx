"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  crearEmpresa,
  editarEmpresa,
  subirIconoEmpresa,
  type EmpresaRow,
} from "@/app/actions/admin-empresas";

// Modal de alta/edición de empresa (tema oscuro God Mode).
// Creación → borde verde; edición → borde azul. Backdrop inerte.
// Permite subir o actualizar el icono al bucket público `icons` en ambos modos.

const PLANES = ["starter", "pro", "enterprise"] as const;
const INPUT =
  "w-full rounded-lg border border-[#2A2A2A] bg-[#202020] px-3 py-2 text-sm text-[#EDEDED] outline-none focus:border-primary-5";

interface Props {
  modo: "crear" | "editar";
  empresa?: EmpresaRow;
  onClose: () => void;
  onSaved: (empresa: EmpresaRow) => void;
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#A1A1A1]">
        {label}
      </label>
      {children}
    </div>
  );
}

export function NuevaEmpresaModal({ modo, empresa, onClose, onSaved }: Props) {
  const esEditar = modo === "editar";
  const [nombre, setNombre] = useState(empresa?.nombre ?? "");
  const [dominio, setDominio] = useState(empresa?.dominio_short ?? "");
  const [plan, setPlan] = useState<string>(empresa?.plan ?? "starter");
  const [activa, setActiva] = useState<boolean>(empresa?.activa ?? true);
  const [iconoFile, setIconoFile] = useState<File | null>(null);
  
  // SOLUCIÓN 1: Inicializa el preview con el icono existente de la empresa si estamos editando
  const [iconoPreview, setIconoPreview] = useState<string | null>(empresa?.icono ?? null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function onPickIcono(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setIconoFile(f);
    setIconoPreview(f ? URL.createObjectURL(f) : (empresa?.icono ?? null));
  }

async function handleSubmit() {
  setError(null);
  setGuardando(true); // Bloqueamos al iniciar

  try {
    let iconoUrl: string | undefined = empresa?.icono ?? undefined;
    
    if (iconoFile) {
      const formDataToSend = new FormData();
      formDataToSend.append("file", iconoFile);

      const up = await subirIconoEmpresa(formDataToSend);
      if (!up.ok) {
        // Errores controlados de lógica (ej: archivo muy grande)
        return setError(up.error); 
      }
      iconoUrl = up.url;
    }

    if (esEditar && empresa) {
      const res = await editarEmpresa({
        empresa_id: empresa.empresa_id,
        nombre,
        plan,
        activa,
        icono: iconoUrl ?? null,
      });
      if (!res.ok) return setError(res.error);
      toast.success("Empresa actualizada");
      onSaved(res.empresa);
      return onClose();
    } else {
      const res = await crearEmpresa({
        nombre,
        dominio_short: dominio,
        plan,
        ...(iconoUrl ? { icono: iconoUrl } : {}),
      });
      if (!res.ok) return setError(res.error);
      toast.success("Empresa creada");
      onSaved(res.empresa);
      onClose();
    }

  } catch (err) {
    // Si ocurre un error catastrófico (como el de React anterior), cae aquí
    console.error("Error crítico en el formulario:", err);
    setError("Ocurrió un error inesperado en la comunicación con el servidor.");
    toast.error("Error crítico en la operación");
  } finally {
    // LA MAGIA: No importa si entró por el try o por el catch...
    // esta línea SE EJECUTA SÍ O SÍ, desbloqueando la web siempre.
    setGuardando(false); 
  }
}

  const submitDeshabilitado =
    guardando || !nombre.trim() || (!esEditar && !dominio.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" />

      <div
        className={`relative w-full max-w-sm rounded-xl border-t-4 bg-[#161616] p-6 shadow-2xl ${
          esEditar ? "border-info-5" : "border-primary-5"
        }`}
      >
        <h2 className="text-lg font-bold text-[#EDEDED]">
          {esEditar ? "Editar empresa" : "Nueva empresa"}
        </h2>
        <p className="mt-1 text-xs text-[#8C8C8C]">
          {esEditar
            ? "Actualiza los datos del inquilino."
            : "Registra un nuevo inquilino en la plataforma."}
        </p>

        <div className="mt-5 space-y-4">
          <Campo label="Nombre">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
              placeholder="Acme S.A."
              className={INPUT}
            />
          </Campo>

          <Campo label="Dominio (subdominio)">
            <input
              value={dominio}
              onChange={(e) => setDominio(e.target.value.toLowerCase())}
              maxLength={63}
              disabled={esEditar}
              placeholder="acme"
              className={`${INPUT} disabled:cursor-not-allowed disabled:text-[#707070]`}
            />
          </Campo>

          <Campo label="Plan">
            <select
              aria-label="Plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className={INPUT}
            >
              {PLANES.map((p) => (
                <option key={p} value={p} className="bg-[#202020]">
                  {p}
                </option>
              ))}
            </select>
          </Campo>

          {/* SOLUCIÓN 3: Eliminado el condicional !esEditar. Ahora se renderiza SIEMPRE */}
          <Campo label="Icono de la empresa">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#202020]">
                {iconoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={iconoPreview}
                    alt="preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-[#707070]">IMG/SVG</span>
                                )}
              </div>
              <label className="cursor-pointer rounded-lg border border-[#2A2A2A] px-3 py-2 text-xs font-semibold text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED]">
                {iconoFile ? "Cambiar archivo" : esEditar && empresa?.icono ? "Actualizar icono" : "Subir icono"}
                <input
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg,.webp,image/*"
                  onChange={onPickIcono}
                  className="hidden"
                />
              </label>
            </div>
            <p className="mt-1 text-[11px] text-[#707070]">
              Se sube al bucket público <code>icons</code>. Máx. 2 MB.
            </p>
          </Campo>

          {esEditar && (
            <label className="flex items-center gap-2 text-sm text-[#D4D4D4]">
              <input
                type="checkbox"
                checked={activa}
                onChange={(e) => setActiva(e.target.checked)}
                className="h-4 w-4 rounded border-[#2A2A2A]"
              />
              Empresa activa
            </label>
          )}

          {error && (
            <p className="rounded-lg border border-critique-7 bg-critique-9 px-3 py-2 text-xs text-critique-3">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm font-semibold text-[#A1A1A1] hover:bg-[#202020] hover:text-[#EDEDED] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDeshabilitado}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              esEditar
                ? "bg-info-5 hover:bg-info-7"
                : "bg-primary-5 hover:bg-primary-6"
            }`}
          >
            {guardando ? "Guardando…" : esEditar ? "Guardar" : "Crear empresa"}
          </button>
        </div>
      </div>
    </div>
  );
}