-- =============================================================================
-- MIGRACIÓN: vf2_hardening — Fase 0 del plan de migración
-- Proyecto: sghnfhrrrjgfbtxvqymh
-- Fecha: 2026-06-26
--
-- Cambios:
--   1. Recrear todas las policies RLS de vf2_* con TO authenticated (no TO public)
--   2. vf2_aprobar_tarea: error genérico al cliente + log server-side, soporte NCG,
--      validación approver-equipo con is_miembro_equipo()
--   3. vf2_cambiar_estado_tarea: guard de rol-en-tarea server-side por transición
--   4. REVOKE PUBLIC de vf2_dims_hash (helper helper inmutable)
--   5. Consolida el fix de fix_log_datos_prev (ya incluido en las nuevas versiones)
-- =============================================================================

-- =============================================================================
-- 1. RECREAR POLICIES RLS CON TO authenticated
--    (las policies sin TO <role> aplican a PUBLIC por defecto en PostgreSQL)
-- =============================================================================

-- ── vf2_metric ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_metric_select ON vf2_metric;
DROP POLICY IF EXISTS vf2_metric_insert ON vf2_metric;
DROP POLICY IF EXISTS vf2_metric_update ON vf2_metric;
DROP POLICY IF EXISTS vf2_metric_delete ON vf2_metric;

CREATE POLICY vf2_metric_select ON vf2_metric
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_metric_insert ON vf2_metric
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_metric_update ON vf2_metric
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_metric_delete ON vf2_metric
  FOR DELETE TO authenticated
  USING (empresa_id = current_empresa_id() AND current_rol() = 'administrador');

-- ── vf2_fact ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_fact_select ON vf2_fact;
DROP POLICY IF EXISTS vf2_fact_insert ON vf2_fact;
DROP POLICY IF EXISTS vf2_fact_update ON vf2_fact;

CREATE POLICY vf2_fact_select ON vf2_fact
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_fact_insert ON vf2_fact
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_fact_update ON vf2_fact
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());

-- ── vf2_fact_revision ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_fact_revision_select ON vf2_fact_revision;
DROP POLICY IF EXISTS vf2_fact_revision_insert ON vf2_fact_revision;
DROP POLICY IF EXISTS vf2_fact_revision_update ON vf2_fact_revision;

CREATE POLICY vf2_fact_revision_select ON vf2_fact_revision
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_fact_revision_insert ON vf2_fact_revision
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
-- Solo is_current y status pueden cambiar (via RPC); valores son inmutables
CREATE POLICY vf2_fact_revision_update ON vf2_fact_revision
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id());

-- ── vf2_binding ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_binding_select ON vf2_binding;
DROP POLICY IF EXISTS vf2_binding_insert ON vf2_binding;
DROP POLICY IF EXISTS vf2_binding_update ON vf2_binding;
DROP POLICY IF EXISTS vf2_binding_delete ON vf2_binding;

CREATE POLICY vf2_binding_select ON vf2_binding
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_binding_insert ON vf2_binding
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_binding_update ON vf2_binding
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_binding_delete ON vf2_binding
  FOR DELETE TO authenticated
  USING (empresa_id = current_empresa_id());

-- ── vf2_coleccion ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_coleccion_select ON vf2_coleccion;
DROP POLICY IF EXISTS vf2_coleccion_insert ON vf2_coleccion;
DROP POLICY IF EXISTS vf2_coleccion_update ON vf2_coleccion;

CREATE POLICY vf2_coleccion_select ON vf2_coleccion
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_coleccion_insert ON vf2_coleccion
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_coleccion_update ON vf2_coleccion
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());

-- ── vf2_tarea ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_tarea_select ON vf2_tarea;
DROP POLICY IF EXISTS vf2_tarea_insert ON vf2_tarea;
DROP POLICY IF EXISTS vf2_tarea_update ON vf2_tarea;

CREATE POLICY vf2_tarea_select ON vf2_tarea
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_tarea_insert ON vf2_tarea
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_tarea_update ON vf2_tarea
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());

-- ── vf2_tarea_rol ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_tarea_rol_select ON vf2_tarea_rol;
DROP POLICY IF EXISTS vf2_tarea_rol_insert ON vf2_tarea_rol;
DROP POLICY IF EXISTS vf2_tarea_rol_update ON vf2_tarea_rol;
DROP POLICY IF EXISTS vf2_tarea_rol_delete ON vf2_tarea_rol;

CREATE POLICY vf2_tarea_rol_select ON vf2_tarea_rol
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_tarea_rol_insert ON vf2_tarea_rol
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_tarea_rol_update ON vf2_tarea_rol
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_tarea_rol_delete ON vf2_tarea_rol
  FOR DELETE TO authenticated
  USING (empresa_id = current_empresa_id());

-- ── vf2_sheet ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_sheet_select ON vf2_sheet;
DROP POLICY IF EXISTS vf2_sheet_insert ON vf2_sheet;
DROP POLICY IF EXISTS vf2_sheet_update ON vf2_sheet;

CREATE POLICY vf2_sheet_select ON vf2_sheet
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_sheet_insert ON vf2_sheet
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_sheet_update ON vf2_sheet
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());

-- ── vf2_cell ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_cell_select ON vf2_cell;
DROP POLICY IF EXISTS vf2_cell_insert ON vf2_cell;
DROP POLICY IF EXISTS vf2_cell_update ON vf2_cell;

CREATE POLICY vf2_cell_select ON vf2_cell
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_cell_insert ON vf2_cell
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_cell_update ON vf2_cell
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());

-- ── vf2_evidencia ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_evidencia_select ON vf2_evidencia;
DROP POLICY IF EXISTS vf2_evidencia_insert ON vf2_evidencia;
DROP POLICY IF EXISTS vf2_evidencia_update ON vf2_evidencia;

CREATE POLICY vf2_evidencia_select ON vf2_evidencia
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_evidencia_insert ON vf2_evidencia
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_evidencia_update ON vf2_evidencia
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());

-- ── vf2_comentario ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_comentario_select ON vf2_comentario;
DROP POLICY IF EXISTS vf2_comentario_insert ON vf2_comentario;
DROP POLICY IF EXISTS vf2_comentario_update ON vf2_comentario;

CREATE POLICY vf2_comentario_select ON vf2_comentario
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_comentario_insert ON vf2_comentario
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_comentario_update ON vf2_comentario
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());

-- ── vf2_yjs_snapshot ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vf2_yjs_snapshot_select ON vf2_yjs_snapshot;
DROP POLICY IF EXISTS vf2_yjs_snapshot_upsert ON vf2_yjs_snapshot;
DROP POLICY IF EXISTS vf2_yjs_snapshot_update ON vf2_yjs_snapshot;

CREATE POLICY vf2_yjs_snapshot_select ON vf2_yjs_snapshot
  FOR SELECT TO authenticated
  USING (is_superadmin() OR empresa_id = current_empresa_id());
-- El servicio Hocuspocus escribe con service_role → no necesita esta policy,
-- pero la dejamos para upserts desde server actions si aplica en el futuro
CREATE POLICY vf2_yjs_snapshot_insert ON vf2_yjs_snapshot
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_yjs_snapshot_update ON vf2_yjs_snapshot
  FOR UPDATE TO authenticated
  USING (empresa_id = current_empresa_id() AND is_activo());

-- =============================================================================
-- 2. REVOKE PUBLIC de vf2_dims_hash (helper inmutable, no debe ser público)
-- =============================================================================
REVOKE EXECUTE ON FUNCTION vf2_dims_hash(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vf2_dims_hash(jsonb) TO authenticated;

-- =============================================================================
-- 3. vf2_aprobar_tarea — reescritura completa con:
--    a) Error genérico al cliente + RAISE LOG del detalle (DIRECTRICES §5.5)
--    b) Resolución metric_id para NCG (gri_item_id OR ncg_item_id)
--    c) Validación approver-equipo con is_miembro_equipo()
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
  -- 1. Identidad del actor
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

  -- 5. Resolver proyecto_id de la colección (para el fact)
  SELECT proyecto_id INTO v_proyecto_id
  FROM vf2_coleccion
  WHERE coleccion_id = v_tarea.coleccion_id;

  -- 6. Por cada celda input de cada sheet de la tarea → materializar Fact
  FOR v_sheet IN
    SELECT * FROM vf2_sheet WHERE tarea_id = v_tarea.tarea_id AND empresa_id = v_empresa_id
  LOOP
    FOR v_cell IN
      SELECT * FROM vf2_cell
      WHERE sheet_id = v_sheet.sheet_id
        AND empresa_id = v_empresa_id
        AND cell_kind = 'input'
        AND (value_num IS NOT NULL OR value_text IS NOT NULL OR value_json IS NOT NULL)
    LOOP
      -- 6a. Buscar o crear el Fact para esta celda
      IF v_cell.fact_ref_id IS NOT NULL THEN
        SELECT * INTO v_fact FROM vf2_fact
        WHERE fact_id = v_cell.fact_ref_id AND empresa_id = v_empresa_id;
      ELSE
        v_fact.fact_id := NULL; -- forzar NOT FOUND
      END IF;

      IF v_fact.fact_id IS NULL THEN
        -- Resolver metric_id: GRI tiene precedencia, luego NCG
        IF v_tarea.gri_item_id IS NOT NULL THEN
          SELECT metric_id INTO v_metric_id
          FROM vf2_metric
          WHERE empresa_id = v_empresa_id AND gri_item_id = v_tarea.gri_item_id
          LIMIT 1;
        ELSIF v_tarea.ncg_item_id IS NOT NULL THEN
          SELECT metric_id INTO v_metric_id
          FROM vf2_metric
          WHERE empresa_id = v_empresa_id AND ncg_item_id = v_tarea.ncg_item_id
          LIMIT 1;
        ELSE
          v_metric_id := NULL;
        END IF;

        -- metric_id puede ser NULL si la tarea no tiene métrica vinculada aún;
        -- en ese caso el fact no se crea (se salta la celda para este slot)
        IF v_metric_id IS NULL THEN
          CONTINUE;
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
          COALESCE((v_cell.validation->>'periodo_inicio')::date, date_trunc('year', now())::date),
          COALESCE((v_cell.validation->>'periodo_fin')::date,    (date_trunc('year', now()) + interval '1 year' - interval '1 day')::date),
          'anual',
          COALESCE((v_cell.validation->>'dims')::jsonb, '{}'),
          v_dims_hash
        )
        ON CONFLICT (empresa_id, metric_id, proyecto_id, periodo_inicio, periodo_fin, dims_hash)
        DO UPDATE SET updated_at = now()
        RETURNING * INTO v_fact;

        -- Actualizar la celda con el fact_ref_id
        UPDATE vf2_cell SET fact_ref_id = v_fact.fact_id WHERE cell_id = v_cell.cell_id;
      END IF;

      -- 6b. Marcar revisión anterior como superseded
      v_prev_rev_id := v_fact.current_revision_id;
      IF v_prev_rev_id IS NOT NULL THEN
        UPDATE vf2_fact_revision
        SET is_current = false, status = 'superseded'
        WHERE revision_id = v_prev_rev_id;
      END IF;

      -- 6c. Crear nueva revisión aprobada
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

  -- 7. Recolectar bindings live afectados para revalidación en Next.js
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
    WHERE sheet_id IN (SELECT sheet_id FROM vf2_sheet WHERE tarea_id = v_tarea.tarea_id)
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
  -- Error genérico al cliente; detalle solo en los logs del servidor
  RAISE LOG 'vf2_aprobar_tarea error — uid=%, tarea=%, detail=%',
    v_actor_uid, p_tarea_public_id, SQLERRM;
  RAISE EXCEPTION 'Error al procesar la aprobación';
END;
$$;

REVOKE EXECUTE ON FUNCTION vf2_aprobar_tarea(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vf2_aprobar_tarea(text, text) TO authenticated;

-- =============================================================================
-- 4. vf2_cambiar_estado_tarea — añade guard de rol-en-tarea server-side
--    Matriz espejo de lib/vf2/permisos.ts:VF2_TRANSICIONES:
--      preparer : en_preparacion→en_revision, devuelta→en_preparacion
--      reviewer : en_revision→en_aprobacion, en_revision→devuelta
--      approver : en_aprobacion→devuelta
--      admin/superadmin: cualquier transición válida
--    borrador→en_preparacion lo puede hacer cualquier miembro (admin asigna y activa)
-- =============================================================================
CREATE OR REPLACE FUNCTION vf2_cambiar_estado_tarea(
  p_tarea_public_id text,
  p_nuevo_estado    text,
  p_nota            text DEFAULT NULL
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
  v_rol_actor     text;
  v_es_admin      boolean;
  v_proyecto_id   integer;
  -- rol asignado en la tarea
  v_es_preparer   boolean := false;
  v_es_reviewer   boolean := false;
  v_es_approver   boolean := false;
BEGIN
  v_actor_uid  := auth.uid();
  v_empresa_id := current_empresa_id();
  v_rol_actor  := current_rol();

  IF v_actor_uid IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_tarea
  FROM vf2_tarea
  WHERE public_id = p_tarea_public_id AND empresa_id = v_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  v_es_admin := (v_rol_actor = 'administrador' OR is_superadmin());

  -- Resolver si el actor tiene algún rol en la tarea
  SELECT
    bool_or(rol = 'preparer' AND (
      asignado_user_id = v_actor_uid OR
      (asignado_equipo_id IS NOT NULL AND is_miembro_equipo(asignado_equipo_id))
    )) AS es_preparer,
    bool_or(rol = 'reviewer' AND (
      asignado_user_id = v_actor_uid OR
      (asignado_equipo_id IS NOT NULL AND is_miembro_equipo(asignado_equipo_id))
    )) AS es_reviewer,
    bool_or(rol = 'approver' AND (
      asignado_user_id = v_actor_uid OR
      (asignado_equipo_id IS NOT NULL AND is_miembro_equipo(asignado_equipo_id))
    )) AS es_approver
  INTO v_es_preparer, v_es_reviewer, v_es_approver
  FROM vf2_tarea_rol
  WHERE tarea_id = v_tarea.tarea_id AND activo = true;

  -- Validar transición de estado
  IF NOT (
    (v_tarea.estado = 'borrador'        AND p_nuevo_estado = 'en_preparacion') OR
    (v_tarea.estado = 'en_preparacion'  AND p_nuevo_estado = 'en_revision')    OR
    (v_tarea.estado = 'en_revision'     AND p_nuevo_estado = 'en_aprobacion')  OR
    (v_tarea.estado = 'en_revision'     AND p_nuevo_estado = 'devuelta')       OR
    (v_tarea.estado = 'en_aprobacion'   AND p_nuevo_estado = 'devuelta')       OR
    (v_tarea.estado = 'devuelta'        AND p_nuevo_estado = 'en_preparacion')
  ) THEN
    RAISE EXCEPTION 'Transición de estado no permitida: % → %', v_tarea.estado, p_nuevo_estado;
  END IF;

  -- Guard de rol: si no es admin, solo puede hacer su transición correspondiente
  IF NOT v_es_admin THEN
    IF v_tarea.estado = 'borrador' AND p_nuevo_estado = 'en_preparacion' THEN
      -- Cualquier miembro asignado puede iniciar
      IF NOT (v_es_preparer OR v_es_reviewer OR v_es_approver) THEN
        RAISE EXCEPTION 'No tienes un rol asignado en esta tarea';
      END IF;
    ELSIF v_tarea.estado = 'en_preparacion' AND p_nuevo_estado = 'en_revision' THEN
      IF NOT v_es_preparer THEN
        RAISE EXCEPTION 'Solo el Preparer puede enviar a revisión';
      END IF;
    ELSIF v_tarea.estado = 'devuelta' AND p_nuevo_estado = 'en_preparacion' THEN
      IF NOT v_es_preparer THEN
        RAISE EXCEPTION 'Solo el Preparer puede reactivar una tarea devuelta';
      END IF;
    ELSIF v_tarea.estado = 'en_revision' AND p_nuevo_estado = 'en_aprobacion' THEN
      IF NOT v_es_reviewer THEN
        RAISE EXCEPTION 'Solo el Reviewer puede enviar a aprobación';
      END IF;
    ELSIF v_tarea.estado = 'en_revision' AND p_nuevo_estado = 'devuelta' THEN
      IF NOT v_es_reviewer THEN
        RAISE EXCEPTION 'Solo el Reviewer puede devolver desde revisión';
      END IF;
    ELSIF v_tarea.estado = 'en_aprobacion' AND p_nuevo_estado = 'devuelta' THEN
      IF NOT v_es_approver THEN
        RAISE EXCEPTION 'Solo el Approver puede devolver desde aprobación';
      END IF;
    ELSE
      RAISE EXCEPTION 'No tienes permisos para esta transición';
    END IF;
  END IF;

  -- Actualizar estado
  UPDATE vf2_tarea
  SET estado = p_nuevo_estado, updated_at = now()
  WHERE tarea_id = v_tarea.tarea_id;

  -- Insertar comentario de devolución si aplica
  IF p_nuevo_estado = 'devuelta' AND p_nota IS NOT NULL THEN
    INSERT INTO vf2_comentario (empresa_id, tarea_id, tipo, contenido, autor_uid)
    VALUES (v_empresa_id, v_tarea.tarea_id, 'devolucion', p_nota, v_actor_uid);
  END IF;

  -- Resolver proyecto_id para el log
  SELECT proyecto_id INTO v_proyecto_id
  FROM vf2_coleccion WHERE coleccion_id = v_tarea.coleccion_id;

  PERFORM log_usuario_accion(
    p_accion      := 'VF2_CAMBIO_ESTADO_TAREA',
    p_tabla       := 'vf2_tarea',
    p_registro_id := v_tarea.public_id,
    p_datos_prev  := jsonb_build_object('estado', v_tarea.estado),
    p_datos_new   := jsonb_build_object('estado', p_nuevo_estado, 'nota', p_nota),
    p_proyecto_id := v_proyecto_id
  );

  RETURN jsonb_build_object('ok', true, 'nuevo_estado', p_nuevo_estado);

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'vf2_cambiar_estado_tarea error — uid=%, tarea=%, detail=%',
    v_actor_uid, p_tarea_public_id, SQLERRM;
  RAISE EXCEPTION 'Error al cambiar estado de la tarea';
END;
$$;

REVOKE EXECUTE ON FUNCTION vf2_cambiar_estado_tarea(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vf2_cambiar_estado_tarea(text, text, text) TO authenticated;

-- =============================================================================
-- 5. vf2_crear_coleccion — consolidar el fix de fix_log_datos_prev
--    (p_datos_prev := NULL explícito para resolver sobrecarga de log_usuario_accion)
-- =============================================================================
CREATE OR REPLACE FUNCTION vf2_crear_coleccion(
  p_proyecto_id  integer,
  p_estandar     text,
  p_nombre       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_uid  uuid;
  v_empresa_id integer;
  v_coleccion  vf2_coleccion%ROWTYPE;
BEGIN
  v_actor_uid  := auth.uid();
  v_empresa_id := current_empresa_id();

  IF v_actor_uid IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF current_rol() NOT IN ('administrador') AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'Solo administradores pueden crear colecciones';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM proyectos WHERE proyecto_id = p_proyecto_id AND empresa_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Proyecto no encontrado';
  END IF;

  INSERT INTO vf2_coleccion (empresa_id, proyecto_id, estandar, nombre)
  VALUES (v_empresa_id, p_proyecto_id, p_estandar, p_nombre)
  RETURNING * INTO v_coleccion;

  PERFORM log_usuario_accion(
    p_accion      := 'VF2_CREAR_COLECCION',
    p_tabla       := 'vf2_coleccion',
    p_registro_id := v_coleccion.public_id,
    p_datos_prev  := NULL,
    p_datos_new   := jsonb_build_object('estandar', p_estandar, 'nombre', p_nombre),
    p_proyecto_id := p_proyecto_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'coleccion_id', v_coleccion.coleccion_id,
    'public_id', v_coleccion.public_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'vf2_crear_coleccion error — uid=%, proyecto=%, detail=%',
    v_actor_uid, p_proyecto_id, SQLERRM;
  RAISE EXCEPTION 'Error al crear la colección';
END;
$$;

REVOKE EXECUTE ON FUNCTION vf2_crear_coleccion(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vf2_crear_coleccion(integer, text, text) TO authenticated;

-- =============================================================================
-- FIN MIGRACIÓN vf2_hardening
-- =============================================================================
