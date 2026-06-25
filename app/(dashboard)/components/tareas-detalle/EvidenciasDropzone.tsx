"use client";

import { useCallback, useRef, useState } from "react";
import { isFakeBucket } from "@/lib/tareas/evidencias-path";
import type { UploadInProgress } from "@/hooks/useEvidencias";

interface Props {
  disabled: boolean;
  uploads: UploadInProgress[];
  onFiles: (files: File[]) => void;
}

export function EvidenciasDropzone({ disabled, uploads, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const fake = isFakeBucket();

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;
      setDragActive(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [disabled, onFiles]
  );

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFiles(files);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed border-gray-2 bg-gray-1 text-gray-4"
            : dragActive
            ? "border-primary-5 bg-primary-1 text-primary-7"
            : "border-gray-3 bg-white text-gray-6 hover:border-primary-4 hover:bg-primary-0"
        }`}
      >
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm font-medium">
          {disabled
            ? "No puedes subir evidencias en este estado"
            : "Arrastra archivos aquí o haz click para seleccionar"}
        </p>
        {fake && !disabled && (
          <p className="text-[11px] italic text-warning-7">
            Modo bucket fake: archivos registrados sin subida real.
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={disabled}
          onChange={handlePick}
          className="hidden"
        />
      </div>

      {uploads.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-md border border-gray-2 bg-white px-3 py-2"
            >
              <p className="flex-1 truncate text-xs text-gray-7">{u.nombre}</p>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-2">
                <div
                  className="h-full rounded-full bg-primary-5 transition-all"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
              <span className="w-8 text-right text-[10px] text-gray-5">{u.progress}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
