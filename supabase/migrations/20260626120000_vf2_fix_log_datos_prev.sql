-- =============================================================================
-- FIX: vf2_crear_coleccion y vf2_aprobar_tarea omitían p_datos_prev al llamar
-- log_usuario_accion. Ese parámetro NO tiene DEFAULT en la firma de la función,
-- por lo que PostgreSQL no resolvía la sobrecarga → excepción → rollback de toda
-- la transacción (incluido el INSERT) → el server action devolvía error genérico.
-- Solución: pasar p_datos_prev := NULL explícitamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- vf2_crear_coleccion (corregido)
-- -----------------------------------------------------------------------------
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

  -- Verificar que el proyecto pertenece a la empresa
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
END;
$$;

REVOKE EXECUTE ON FUNCTION vf2_crear_coleccion(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vf2_crear_coleccion(integer, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- vf2_aprobar_tarea (corregido)
-- -----------------------------------------------------------------------------
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

  IF v_tarea_rol.asignado_user_id IS NOT NULL AND v_tarea_rol.asignado_user_id <> v_actor_uid THEN
    IF current_rol() <> 'administrador' AND NOT is_superadmin() THEN
      RAISE EXCEPTION 'No tienes permisos de aprobación sobre esta tarea';
    END IF;
  END IF;

  -- 4. Verificar estado válido para aprobar
  IF v_tarea.estado NOT IN ('en_aprobacion','en_revision') THEN
    RAISE EXCEPTION 'La tarea debe estar en revisión o aprobación para aprobar';
  END IF;

  -- 5. Por cada celda input de cada sheet de la tarea → materializar Fact
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
      -- 5a. Buscar o crear el Fact para esta celda (usando consumer_ref como coordenada)
      IF v_cell.fact_ref_id IS NOT NULL THEN
        SELECT * INTO v_fact FROM vf2_fact WHERE fact_id = v_cell.fact_ref_id AND empresa_id = v_empresa_id;
      END IF;

      IF NOT FOUND OR v_cell.fact_ref_id IS NULL THEN
        v_dims_hash := COALESCE(vf2_dims_hash((v_cell.validation->>'dims')::jsonb), vf2_dims_hash('{}'));

        INSERT INTO vf2_fact (
          empresa_id, proyecto_id, metric_id,
          periodo_inicio, periodo_fin, periodo_tipo,
          dims, dims_hash
        )
        SELECT
          v_empresa_id,
          (SELECT proyecto_id FROM vf2_coleccion WHERE coleccion_id = v_tarea.coleccion_id),
          (SELECT metric_id FROM vf2_metric WHERE empresa_id = v_empresa_id
           AND gri_item_id = v_tarea.gri_item_id LIMIT 1),
          COALESCE((v_cell.validation->>'periodo_inicio')::date, date_trunc('year', now())::date),
          COALESCE((v_cell.validation->>'periodo_fin')::date, (date_trunc('year', now()) + interval '1 year' - interval '1 day')::date),
          'anual',
          COALESCE((v_cell.validation->>'dims')::jsonb, '{}'),
          v_dims_hash
        ON CONFLICT (empresa_id, metric_id, proyecto_id, periodo_inicio, periodo_fin, dims_hash)
        DO UPDATE SET updated_at = now()
        RETURNING * INTO v_fact;

        -- Actualizar la celda con el fact_ref_id
        UPDATE vf2_cell SET fact_ref_id = v_fact.fact_id WHERE cell_id = v_cell.cell_id;
      END IF;

      -- 5b. Marcar revisión anterior como superseded
      v_prev_rev_id := v_fact.current_revision_id;

      IF v_prev_rev_id IS NOT NULL THEN
        UPDATE vf2_fact_revision
        SET is_current = false, status = 'superseded'
        WHERE revision_id = v_prev_rev_id;
      END IF;

      -- 5c. Crear nueva revisión aprobada
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

      -- 5d. Actualizar puntero current_revision_id en el Fact
      UPDATE vf2_fact
      SET current_revision_id = v_new_rev_id, updated_at = now()
      WHERE fact_id = v_fact.fact_id;

      -- 5e. Marcar celda como aprobada
      UPDATE vf2_cell SET estado_celda = 'aprobada' WHERE cell_id = v_cell.cell_id;

      v_cells_count := v_cells_count + 1;
    END LOOP;
  END LOOP;

  -- 6. Recolectar bindings live afectados para revalidación en Next.js
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

  -- 7. Actualizar estado de la tarea
  UPDATE vf2_tarea
  SET estado = 'aprobada', updated_at = now()
  WHERE tarea_id = v_tarea.tarea_id;

  -- 8. Log de auditoría
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
    p_proyecto_id := (SELECT proyecto_id FROM vf2_coleccion WHERE coleccion_id = v_tarea.coleccion_id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'cells_materialized', v_cells_count,
    'bindings_live', COALESCE(v_bindings_live, '[]')
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al aprobar tarea: %', SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION vf2_aprobar_tarea(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vf2_aprobar_tarea(text, text) TO authenticated;
