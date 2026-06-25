'server-only'
// lib/vf2/data.ts — Helpers server-side cacheados con React.cache para el módulo vf2_

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type {
  Vf2Coleccion,
  Vf2Tarea,
  Vf2TareaRolRow,
  Vf2Sheet,
  Vf2Cell,
  Vf2FactActual,
  Vf2Metric,
} from './types'

// Obtener colecciones de un proyecto
export const getColeccionesByProyecto = cache(async (proyectoId: number) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_coleccion')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[vf2/data] getColeccionesByProyecto:', error.message)
    return [] as Vf2Coleccion[]
  }
  return data as Vf2Coleccion[]
})

// Obtener colección por public_id
export const getColeccionByPublicId = cache(async (publicId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_coleccion')
    .select('*')
    .eq('public_id', publicId)
    .single()

  if (error) {
    console.error('[vf2/data] getColeccionByPublicId:', error.message)
    return null
  }
  return data as Vf2Coleccion
})

// Obtener tareas de una colección
export const getTareasByColeccion = cache(async (coleccionId: number) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_tarea')
    .select('*')
    .eq('coleccion_id', coleccionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[vf2/data] getTareasByColeccion:', error.message)
    return [] as Vf2Tarea[]
  }
  return data as Vf2Tarea[]
})

// Obtener tarea por public_id (con roles y sheets)
export const getTareaByPublicId = cache(async (publicId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_tarea')
    .select('*')
    .eq('public_id', publicId)
    .single()

  if (error) {
    console.error('[vf2/data] getTareaByPublicId:', error.message)
    return null
  }
  return data as Vf2Tarea
})

// Obtener roles de una tarea
export const getRolesByTarea = cache(async (tareaId: number) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_tarea_rol')
    .select('*')
    .eq('tarea_id', tareaId)
    .eq('activo', true)

  if (error) {
    console.error('[vf2/data] getRolesByTarea:', error.message)
    return [] as Vf2TareaRolRow[]
  }
  return data as Vf2TareaRolRow[]
})

// Obtener sheets de una tarea
export const getSheetsByTarea = cache(async (tareaId: number) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_sheet')
    .select('*')
    .eq('tarea_id', tareaId)
    .order('orden', { ascending: true })

  if (error) {
    console.error('[vf2/data] getSheetsByTarea:', error.message)
    return [] as Vf2Sheet[]
  }
  return data as Vf2Sheet[]
})

// Obtener sheet por public_id
export const getSheetByPublicId = cache(async (publicId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_sheet')
    .select('*')
    .eq('public_id', publicId)
    .single()

  if (error) {
    console.error('[vf2/data] getSheetByPublicId:', error.message)
    return null
  }
  return data as Vf2Sheet
})

// Obtener celdas de un sheet
export const getCeldasBySheet = cache(async (sheetId: number) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_cell')
    .select('*')
    .eq('sheet_id', sheetId)
    .order('row_key', { ascending: true })

  if (error) {
    console.error('[vf2/data] getCeldasBySheet:', error.message)
    return [] as Vf2Cell[]
  }
  return data as Vf2Cell[]
})

// Obtener Facts actuales (con revisión aprobada) de un proyecto
export const getFactsActualesByProyecto = cache(async (proyectoId: number) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_fact_actual')
    .select('*')
    .eq('proyecto_id', proyectoId)

  if (error) {
    console.error('[vf2/data] getFactsActualesByProyecto:', error.message)
    return [] as Vf2FactActual[]
  }
  return data as Vf2FactActual[]
})

// Obtener métricas de empresa
export const getMetricasByEmpresa = cache(async (empresaId: number) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vf2_metric')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .order('codigo', { ascending: true })

  if (error) {
    console.error('[vf2/data] getMetricasByEmpresa:', error.message)
    return [] as Vf2Metric[]
  }
  return data as Vf2Metric[]
})
