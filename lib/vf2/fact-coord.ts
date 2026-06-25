// lib/vf2/fact-coord.ts — Canonicalización de coordenadas dimensionales de Facts

// Calcula el dims_hash canónico del lado del cliente (espejo de vf2_dims_hash en SQL).
// Usa md5 de forma determinista: keys ordenadas, concatenadas como "k=v,k=v".
// NOTA: en el servidor el hash lo calcula el RPC SQL. Este helper se usa solo
// en el cliente para comparar coordenadas antes de llamar al servidor.
export function dimsHash(dims: Record<string, string>): string {
  const sorted = Object.keys(dims)
    .sort()
    .map(k => `${k}=${dims[k]}`)
    .join(',')
  return sorted === '' ? dimsHashEmpty() : sorted
}

// Hash de dims vacío (equivale a md5('') en el servidor)
// Devolvemos la cadena vacía como marcador; el servidor usará md5('')
export function dimsHashEmpty(): string {
  return ''
}

// Normaliza dims: quita valores vacíos/nulos, ordena claves
export function normalizeDims(dims: Record<string, string | null | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dims)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => [k, v as string])
      .sort(([a], [b]) => a.localeCompare(b))
  )
}

// Genera el yjs_doc_name canónico para un sheet
// Formato: vf2:{empresaId}:{sheetPublicId}
export function yjsDocName(empresaId: number, sheetPublicId: string): string {
  return `vf2:${empresaId}:${sheetPublicId}`
}

// Genera un row_key para una fila dada su índice (ej. "r0", "r1", ...)
export function rowKey(idx: number): string {
  return `r${idx}`
}

// Genera un col_key para una columna dada (ej. "c0", "c1", ...)
export function colKey(idx: number): string {
  return `c${idx}`
}
