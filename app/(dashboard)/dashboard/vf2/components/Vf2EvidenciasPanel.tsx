'use client'
// app/(dashboard)/dashboard/vf2/components/Vf2EvidenciasPanel.tsx
// Panel de evidencias: subida directa XHR al bucket + lista + descarga via signed URL + eliminar

import { useState, useRef, useCallback } from 'react'
import { Paperclip, Upload, Download, Trash2, FileText, Loader2, AlertCircle } from 'lucide-react'
import { vf2RegistrarEvidencia, vf2GetEvidenciaUrl, vf2EliminarEvidencia } from '@/app/actions/vf2-evidencias'
import type { Vf2Evidencia } from '@/lib/vf2/types'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB
const BUCKET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object'

interface Props {
  tareaPublicId: string
  empresaId: number
  evidenciasInit: Vf2Evidencia[]
  puedeSubir: boolean
  actorUid: string
  esAdmin: boolean
  tareaAprobada: boolean
}

interface UploadState {
  file: File
  progress: number
  error: string | null
  done: boolean
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExt(name: string) {
  const parts = name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '?'
}

export default function Vf2EvidenciasPanel({
  tareaPublicId,
  empresaId,
  evidenciasInit,
  puedeSubir,
  actorUid,
  esAdmin,
  tareaAprobada,
}: Props) {
  const [evidencias, setEvidencias] = useState<Vf2Evidencia[]>(evidenciasInit)
  const [uploads, setUploads] = useState<UploadState[]>([])
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const updateUpload = useCallback((idx: number, patch: Partial<UploadState>) => {
    setUploads(prev => prev.map((u, i) => i === idx ? { ...u, ...patch } : u))
  }, [])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const newUploads: UploadState[] = Array.from(files).map(f => ({
      file: f,
      progress: 0,
      error: null,
      done: false,
    }))

    setUploads(prev => [...prev, ...newUploads])
    const startIdx = uploads.length

    await Promise.all(
      newUploads.map(async (u, i) => {
        const idx = startIdx + i

        if (u.file.size > MAX_BYTES) {
          updateUpload(idx, { error: 'El archivo supera 50 MB', progress: 0 })
          return
        }

        // Ruta: empresaId/tareaPublicId/nombreArchivo
        const safeName = u.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${empresaId}/${tareaPublicId}/${Date.now()}_${safeName}`

        // Subida directa XHR con progreso
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const uploadUrl = `${supabaseUrl}/storage/v1/object/vf2-evidencias/${storagePath}`

        await new Promise<void>((resolve) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              updateUpload(idx, { progress: Math.round((e.loaded / e.total) * 90) })
            }
          }
          xhr.onload = async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              updateUpload(idx, { progress: 95 })
              const res = await vf2RegistrarEvidencia({
                tareaPublicId,
                storagePath,
                nombreArchivo: u.file.name,
                mimeType: u.file.type || undefined,
                tamanoBytes: u.file.size,
              })
              if (res.ok) {
                setEvidencias(prev => [...prev, res.evidencia])
                updateUpload(idx, { progress: 100, done: true })
              } else {
                updateUpload(idx, { error: res.error, progress: 0 })
              }
            } else {
              updateUpload(idx, { error: 'Error al subir el archivo', progress: 0 })
            }
            resolve()
          }
          xhr.onerror = () => {
            updateUpload(idx, { error: 'Error de red', progress: 0 })
            resolve()
          }
          xhr.open('POST', uploadUrl)
          xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`)
          xhr.setRequestHeader('Content-Type', u.file.type || 'application/octet-stream')
          xhr.send(u.file)
        })
      })
    )
  }

  async function handleDownload(ev: Vf2Evidencia) {
    setDownloadingId(ev.public_id)
    try {
      const res = await vf2GetEvidenciaUrl({ evidenciaPublicId: ev.public_id })
      if (res.ok) {
        const a = document.createElement('a')
        a.href = res.url
        a.download = ev.nombre_archivo
        a.click()
      }
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleEliminar(ev: Vf2Evidencia) {
    if (!confirm(`¿Eliminar "${ev.nombre_archivo}"?`)) return
    setDeletingId(ev.public_id)
    try {
      const res = await vf2EliminarEvidencia({ evidenciaPublicId: ev.public_id })
      if (res.ok) {
        setEvidencias(prev => prev.filter(e => e.public_id !== ev.public_id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  const puedeEliminarEv = (ev: Vf2Evidencia) =>
    !tareaAprobada && (esAdmin || ev.subido_por_uid === actorUid)

  const activeUploads = uploads.filter(u => !u.done && !u.error)

  return (
    <div className="border-t border-gray-3 bg-gray-1 px-4 md:px-8 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-7">
          <Paperclip className="h-4 w-4" />
          Evidencias
          {evidencias.length > 0 && (
            <span className="text-xs font-normal text-gray-4">({evidencias.length})</span>
          )}
        </div>

        {puedeSubir && !tareaAprobada && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs text-primary-6 hover:text-primary-7 border border-primary-3 bg-white px-2.5 py-1 rounded-lg hover:border-primary-5 transition-colors"
            >
              <Upload className="h-3 w-3" />
              Subir archivo
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </>
        )}
      </div>

      {/* Lista de evidencias */}
      <div className="space-y-1.5">
        {evidencias.length === 0 && activeUploads.length === 0 && (
          <p className="text-xs text-gray-4">
            {tareaAprobada ? 'Sin evidencias adjuntas.' : 'Sube archivos de respaldo para esta tarea.'}
          </p>
        )}

        {evidencias.map(ev => (
          <div
            key={ev.public_id}
            className="flex items-center gap-2 bg-white border border-gray-2 rounded-lg px-3 py-2 text-xs"
          >
            <span className="shrink-0 text-[10px] font-bold text-gray-4 bg-gray-2 px-1.5 py-0.5 rounded">
              {fileExt(ev.nombre_archivo)}
            </span>
            <span className="flex-1 truncate text-gray-7 min-w-0">{ev.nombre_archivo}</span>
            {ev.tamano_bytes && (
              <span className="shrink-0 text-gray-4">{formatBytes(ev.tamano_bytes)}</span>
            )}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleDownload(ev)}
                disabled={downloadingId === ev.public_id}
                className="p-1 text-gray-4 hover:text-primary-6 rounded disabled:opacity-50"
                title="Descargar"
              >
                {downloadingId === ev.public_id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />
                }
              </button>
              {puedeEliminarEv(ev) && (
                <button
                  onClick={() => handleEliminar(ev)}
                  disabled={deletingId === ev.public_id}
                  className="p-1 text-gray-4 hover:text-critique-6 rounded disabled:opacity-50"
                  title="Eliminar"
                >
                  {deletingId === ev.public_id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Uploads en progreso */}
        {uploads.map((u, idx) => (
          !u.done && (
            <div key={idx} className="flex items-center gap-2 bg-white border border-gray-2 rounded-lg px-3 py-2 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-gray-4" />
              <span className="flex-1 truncate text-gray-7">{u.file.name}</span>
              {u.error ? (
                <span className="flex items-center gap-1 text-critique-7 shrink-0">
                  <AlertCircle className="h-3 w-3" />
                  {u.error}
                </span>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 h-1.5 bg-gray-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-5 rounded-full transition-all duration-200"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                  <span className="text-gray-4 w-8">{u.progress}%</span>
                </div>
              )}
            </div>
          )
        ))}
      </div>
    </div>
  )
}
