-- =============================================================================
-- MIGRACIÓN: vf2_a0_a1
-- Proyecto: sghnfhrrrjgfbtxvqymh
-- Fecha: 2026-06-27
--
-- A0: Seguridad
--   1. Fijar security_invoker=true en vistas NCG legacy (C-01: RLS bypass)
--   2. Doble muralla ya existe en el RPC; este commit la refuerza
--
-- A1: Hecho por celda (modelo correcto Workiva)
--   Reescribir vf2_aprobar_tarea para leer metric_id desde
--   v_cell.validation->>'metric_id' por celda, con fallback al metric_id
--   del item GRI/NCG de la tarea.
--   Resultado: cada coordenada (metric, periodo, dims) produce su propio Fact
--   en lugar de que todas las celdas de una misma tarea colisionen en el mismo.
-- =============================================================================

-- =============================================================================
-- A0-1. Fix security_invoker en vistas NCG legacy (C-01)
--   Estas vistas usan security_invoker=false (propietario): bypassean RLS
--   → riesgo de fuga cross-tenant. Corregir con ALTER VIEW si existen.
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'v_ncg_derivaciones_proyecto'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_ncg_derivaciones_proyecto SET (security_invoker = true)';
    RAISE NOTICE 'v_ncg_derivaciones_proyecto → security_invoker=true';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'v_ncg_equipos_proyecto_tab'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_ncg_equipos_proyecto_tab SET (security_invoker = true)';
    RAISE NOTICE 'v_ncg_equipos_proyecto_tab → security_invoker=true';
  END IF;
END;
$$;

-- =============================================================================
-- A1. vf2_aprobar_tarea — modelo de Hecho por celda
--
-- Cambio respecto a la versión anterior (20260626140000):
--   Paso 6a (dentro del loop de celdas), cuando fact_ref_id IS NULL:
--   ANTES: metric_id se resolvía de v_tarea.gri_item_id / ncg_item_id
--          → todas las celdas de la misma tarea usaban el mismo metric_id
--          → colisión en ON CONFLICT → solo se creaba 1 Fact por tarea.
--   AHORA: metric_id se lee de v_cell.validation->>'metric_id' (por celda).
--          Fallback: si la celda no tiene metric_id, se intenta el item
--          GRI o NCG de la tarea (comportamiento previo).
--          → cada (metric_id, periodo, dims) distintos produce su propio Fact.
--
-- Todo lo demás (guards de auth, manejo de superseded, bindings_live,
-- log de auditoría, error genérico) permanece idéntico.
-- =============================================================================
CREATE OR REPLACE FUNCTION vf2_aprobar_tarea(
  p_tarea_public_id  text,
  p_notas            text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_uid     uuid;
  v_empresa_id    integer;
  v_tarea         vf2_tarea%ROWTYPE;
  v_tarea_rol     vf2_tarea_rol%ROWTYPE;
  v_cell          vf2_cell%ROWTYPE;
  v_sheet         vf2_sheet%ROWTYPE;
  v_fact          vf2_fact%ROWTYPE;
  v_prev_rev_id   uuid;
  v_new_rev_id    uuid;
  v_dims_hash     text;
  v_metric_id     bigint;
  v_proyecto_id   integer;
  v_bindings_live jsonb := '[]';
  v_cells_count   integer := 0;
BEGIN
  -- 1. Identidad del actor (NUNCA de parámetros)
  v_actor_uid  := auth.uid();
  v_empresa_id := current_empresa_id();

  IF v_actor_uid IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- 2. Cargar tarea y verificar tenant
  SELECT * INTO v_tarea
  FROM vf2_tarea
  WHERE public_id = p_tarea_public_id
    AND empresa_id = v_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  -- 3. Verificar que el actor es el Approver asignado o administrador
  SELECT * INTO v_tarea_rol
  FROM vf2_tarea_rol
  WHERE tarea_id = v_tarea.tarea_id
    AND rol = 'approver'
    AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay approver asignado a esta tarea';
  END IF;

  -- Approver por usuario directo
  IF v_tarea_rol.asignado_user_id IS NOT NULL THEN
    IF v_tarea_rol.asignado_user_id <> v_actor_uid THEN
      IF current_rol() <> 'administrador' AND NOT is_superadmin() THEN
        RAISE EXCEPTION 'No tienes permisos de aprobación sobre esta tarea';
      END IF;
    END IF;
  END IF;

  -- Approver por equipo: verificar membresía
  IF v_tarea_rol.asignado_equipo_id IS NOT NULL THEN
    IF NOT is_miembro_equipo(v_tarea_rol.asignado_equipo_id) THEN
      IF current_rol() <> 'administrador' AND NOT is_superadmin() THEN
        RAISE EXCEPTION 'No eres miembro del equipo approver de esta tarea';
      END IF;
    END IF;
  END IF;

  -- 4. Verificar estado válido para aprobar
  IF v_tarea.estado NOT IN ('en_aprobacion','en_revision') THEN
    RAISE EXCEPTION 'La tarea debe estar en revisión o aprobación para aprobar';
  END IF;

  -- 5. Resolver proyecto_id de la colección
  SELECT proyecto_id INTO v_proyecto_id
  FROM vf2_coleccion
  WHERE coleccion_id = v_tarea.coleccion_id;

  -- 6. Por cada celda input con valor → materializar Hecho
  FOR v_sheet IN
    SELECT * FROM vf2_sheet
    WHERE tarea_id = v_tarea.tarea_id AND empresa_id = v_empresa_id
  LOOP
    FOR v_cell IN
      SELECT * FROM vf2_cell
      WHERE sheet_id = v_sheet.sheet_id
        AND empresa_id = v_empresa_id
        AND cell_kind = 'input'
        AND (value_num IS NOT NULL OR value_text IS NOT NULL OR value_json IS NOT NULL)
    LOOP
      -- 6a. Reusar Fact ya vinculado a esta celda (re-aprobación)
      IF v_cell.fact_ref_id IS NOT NULL THEN
        SELECT * INTO v_fact FROM vf2_fact
        WHERE fact_id = v_cell.fact_ref_id AND empresa_id = v_empresa_id;
      ELSE
        v_fact.fact_id := NULL;
      END IF;

      IF v_fact.fact_id IS NULL THEN
        -- ── Resolver metric_id: por celda primero (modelo Workiva real),
        --    fallback al item GRI/NCG de la tarea ──────────────────────────
        IF v_cell.validation IS NOT NULL
           AND (v_cell.validation->>'metric_id') IS NOT NULL
        THEN
          -- ← NUEVO: cada celda declara su propia métrica en validation
          v_metric_id := (v_cell.validation->>'metric_id')::bigint;

        ELSIF v_tarea.gri_item_id IS NOT NULL THEN
          SELECT metric_id INTO v_metric_id
          FROM vf2_metric
          WHERE empresa_id = v_empresa_id
            AND gri_item_id = v_tarea.gri_item_id
          LIMIT 1;

        ELSIF v_tarea.ncg_item_id IS NOT NULL THEN
          SELECT metric_id INTO v_metric_id
          FROM vf2_metric
          WHERE empresa_id = v_empresa_id
            AND ncg_item_id = v_tarea.ncg_item_id
          LIMIT 1;

        ELSE
          v_metric_id := NULL;
        END IF;
        -- ─────────────────────────────────────────────────────────────────

        IF v_metric_id IS NULL THEN
          CONTINUE; -- celda sin métrica → omitir
        END IF;

        v_dims_hash := COALESCE(
          vf2_dims_hash((v_cell.validation->>'dims')::jsonb),
          vf2_dims_hash('{}')
        );

        INSERT INTO vf2_fact (
          empresa_id, proyecto_id, metric_id,
          periodo_inicio, periodo_fin, periodo_tipo,
          dims, dims_hash
        )
        VALUES (
          v_empresa_id,
          v_proyecto_id,
          v_metric_id,
          COALESCE(
            (v_cell.validation->>'periodo_inicio')::date,
            date_trunc('year', now())::date
          ),
          COALESCE(
            (v_cell.validation->>'periodo_fin')::date,
            (date_trunc('year', now()) + interval '1 year' - interval '1 day')::date
          ),
          'anual',
          COALESCE((v_cell.validation->>'dims')::jsonb, '{}'),
          v_dims_hash
        )
        ON CONFLICT (empresa_id, metric_id, proyecto_id, periodo_inicio, periodo_fin, dims_hash)
        DO UPDATE SET updated_at = now()
        RETURNING * INTO v_fact;

        -- Vincular la celda con el Fact creado/reutilizado
        UPDATE vf2_cell SET fact_ref_id = v_fact.fact_id WHERE cell_id = v_cell.cell_id;
      END IF;

      -- 6b. Marcar revisión anterior como superseded
      v_prev_rev_id := v_fact.current_revision_id;
      IF v_prev_rev_id IS NOT NULL THEN
        UPDATE vf2_fact_revision
        SET is_current = false, status = 'superseded'
        WHERE revision_id = v_prev_rev_id;
      END IF;

      -- 6c. Crear nueva revisión aprobada (append-only)
      INSERT INTO vf2_fact_revision (
        fact_id, empresa_id, status,
        value_num, value_text, value_json,
        unidad,
        prev_revision_id, is_current,
        source_kind, source_cell_id,
        actor_uid, nota
      )
      VALUES (
        v_fact.fact_id, v_empresa_id, 'approved',
        v_cell.value_num, v_cell.value_text, v_cell.value_json,
        (SELECT unidad FROM vf2_metric WHERE metric_id = v_fact.metric_id),
        v_prev_rev_id, true,
        'manual', v_cell.cell_id,
        v_actor_uid, p_notas
      )
      RETURNING revision_id INTO v_new_rev_id;

      -- 6d. Actualizar puntero current_revision_id en el Fact
      UPDATE vf2_fact
      SET current_revision_id = v_new_rev_id, updated_at = now()
      WHERE fact_id = v_fact.fact_id;

      -- 6e. Marcar celda como aprobada
      UPDATE vf2_cell SET estado_celda = 'aprobada' WHERE cell_id = v_cell.cell_id;

      v_cells_count := v_cells_count + 1;
    END LOOP;
  END LOOP;

  -- 7. Recolectar bindings live para que Next.js invalide las rutas de consumidores
  SELECT jsonb_agg(jsonb_build_object(
    'binding_id', b.binding_id,
    'fact_id', b.fact_id,
    'consumer_kind', b.consumer_kind,
    'consumer_ref', b.consumer_ref
  ))
  INTO v_bindings_live
  FROM vf2_binding b
  WHERE b.fact_id IN (
    SELECT fact_ref_id FROM vf2_cell
    WHERE sheet_id IN (
      SELECT sheet_id FROM vf2_sheet WHERE tarea_id = v_tarea.tarea_id
    )
    AND fact_ref_id IS NOT NULL
  )
  AND b.binding_mode = 'live'
  AND b.empresa_id = v_empresa_id;

  -- 8. Actualizar estado de la tarea
  UPDATE vf2_tarea
  SET estado = 'aprobada', updated_at = now()
  WHERE tarea_id = v_tarea.tarea_id;

  -- 9. Log de auditoría
  PERFORM log_usuario_accion(
    p_accion      := 'VF2_APROBAR_TAREA',
    p_tabla       := 'vf2_tarea',
    p_registro_id := v_tarea.public_id,
    p_datos_prev  := NULL,
    p_datos_new   := jsonb_build_object(
      'estado', 'aprobada',
      'cells_materialized', v_cells_count,
      'tarea_public_id', p_tarea_public_id,
      'notas', p_notas
    ),
    p_proyecto_id := v_proyecto_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'cells_materialized', v_cells_count,
    'bindings_live', COALESCE(v_bindings_live, '[]')
  );

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'vf2_aprobar_tarea error — uid=%, tarea=%, detail=%',
    v_actor_uid, p_tarea_public_id, SQLERRM;
  RAISE EXCEPTION 'Error al procesar la aprobación';
END;
$$;

REVOKE EXECUTE ON FUNCTION vf2_aprobar_tarea(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vf2_aprobar_tarea(text, text) TO authenticated;

-- =============================================================================
-- FIN MIGRACIÓN vf2_a0_a1
-- =============================================================================
