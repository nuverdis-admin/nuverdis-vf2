'use client'
// Vf2OverviewSection — Bento grid de KPIs para el overview del proyecto vf2_.
// Reemplaza OverviewSection legacy (GRI/NCG donut + barras de equipo).

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  CheckCircle2,
  Clock,
  FileSearch,
  AlertTriangle,
  Layers,
  TrendingUp,
  RotateCcw,
  Edit3,
} from 'lucide-react'

interface Stats {
  total: number
  borrador: number
  en_preparacion: number
  en_revision: number
  en_aprobacion: number
  aprobada: number
  devuelta: number
  colecciones: number
  facts_aprobados: number
  atrasadas: number
}

interface Props {
  stats: Stats | null
  proyectoRef: string
  proyectoNombre: string
}

interface KpiCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  href?: string
}

function KpiCard({ label, value, icon, color, href }: KpiCardProps) {
  const inner = (
    <div className={`bg-white rounded-xl border border-gray-2 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-9">{value}</p>
        <p className="text-xs text-gray-5 truncate">{label}</p>
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function Vf2OverviewSection({ stats, proyectoRef }: Props) {
  const base = `/dashboard/proyecto/${proyectoRef}`

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-2 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const pctAprobadas = stats.total > 0 ? Math.round((stats.aprobada / stats.total) * 100) : 0

  const kpis: KpiCardProps[] = [
    {
      label: 'Tareas totales',
      value: stats.total,
      icon: <Layers className="h-5 w-5 text-gray-6" />,
      color: 'bg-gray-1',
    },
    {
      label: 'Aprobadas',
      value: stats.aprobada,
      icon: <CheckCircle2 className="h-5 w-5 text-success-6" />,
      color: 'bg-success-1',
    },
    {
      label: 'Facts en registro',
      value: stats.facts_aprobados,
      icon: <TrendingUp className="h-5 w-5 text-primary-6" />,
      color: 'bg-primary-1',
    },
    {
      label: 'Atrasadas',
      value: stats.atrasadas,
      icon: <AlertTriangle className="h-5 w-5 text-warning-7" />,
      color: 'bg-warning-1',
    },
    {
      label: 'En revisión',
      value: stats.en_revision,
      icon: <FileSearch className="h-5 w-5 text-secondary-6" />,
      color: 'bg-secondary-1',
    },
    {
      label: 'En aprobación',
      value: stats.en_aprobacion,
      icon: <Clock className="h-5 w-5 text-info-6" />,
      color: 'bg-info-1',
    },
    {
      label: 'Devueltas',
      value: stats.devuelta,
      icon: <RotateCcw className="h-5 w-5 text-warning-7" />,
      color: 'bg-warning-1',
    },
    {
      label: 'En preparación',
      value: stats.en_preparacion,
      icon: <Edit3 className="h-5 w-5 text-gray-5" />,
      color: 'bg-gray-1',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Barra de progreso general */}
      <div className="bg-white rounded-xl border border-gray-2 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-7">Progreso general</p>
            <p className="text-xs text-gray-4">{stats.colecciones} colecciones · {stats.total} tareas totales</p>
          </div>
          <span className="text-3xl font-bold text-gray-9">{pctAprobadas}%</span>
        </div>
        <div className="h-3 bg-gray-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-5 rounded-full transition-all duration-500"
            style={{ width: `${pctAprobadas}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-5">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary-5" />
            Aprobadas ({stats.aprobada})
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-secondary-4" />
            En revisión ({stats.en_revision + stats.en_aprobacion})
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-gray-3" />
            Pendientes ({stats.borrador + stats.en_preparacion})
          </span>
        </div>
      </div>

      {/* Grid KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <KpiCard key={i} {...k} />
        ))}
      </div>
    </div>
  )
}
