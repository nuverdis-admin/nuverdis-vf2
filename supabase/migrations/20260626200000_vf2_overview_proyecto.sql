-- Migration: vf2_overview_proyecto
-- RPC que reemplaza overview_proyecto para el hub de proyecto vf2_.

CREATE OR REPLACE FUNCTION vf2_overview_proyecto(p_proyecto_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id integer;
  v_actor_uid  uuid;
  v_result     jsonb;
BEGIN
  v_actor_uid  := auth.uid();
  v_empresa_id := current_empresa_id();

  IF v_empresa_id IS NULL OR v_actor_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM proyectos
    WHERE proyecto_id = p_proyecto_id
      AND empresa_id  = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Proyecto no encontrado';
  END IF;

  SELECT jsonb_build_object(
    'total',          COUNT(t.tarea_id),
    'borrador',       COUNT(t.tarea_id) FILTER (WHERE t.estado = 'borrador'),
    'en_preparacion', COUNT(t.tarea_id) FILTER (WHERE t.estado = 'en_preparacion'),
    'en_revision',    COUNT(t.tarea_id) FILTER (WHERE t.estado = 'en_revision'),
    'en_aprobacion',  COUNT(t.tarea_id) FILTER (WHERE t.estado = 'en_aprobacion'),
    'aprobada',       COUNT(t.tarea_id) FILTER (WHERE t.estado = 'aprobada'),
    'devuelta',       COUNT(t.tarea_id) FILTER (WHERE t.estado = 'devuelta'),
    'colecciones',    (
      SELECT COUNT(*)
      FROM vf2_coleccion c2
      WHERE c2.proyecto_id = p_proyecto_id
        AND c2.empresa_id  = v_empresa_id
    ),
    'facts_aprobados', (
      SELECT COUNT(DISTINCT f.fact_id)
      FROM vf2_fact f
      JOIN vf2_fact_revision fr ON fr.revision_id = f.current_revision_id
      WHERE f.proyecto_id = p_proyecto_id
        AND f.empresa_id  = v_empresa_id
        AND fr.status     = 'approved'
        AND fr.is_current = true
    ),
    'atrasadas',      COUNT(t.tarea_id) FILTER (
      WHERE t.fecha_limite < CURRENT_DATE
        AND t.estado NOT IN ('aprobada')
    )
  )
  INTO v_result
  FROM vf2_tarea t
  JOIN vf2_coleccion c ON c.coleccion_id = t.coleccion_id
  WHERE c.proyecto_id = p_proyecto_id
    AND t.empresa_id  = v_empresa_id;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'vf2_overview_proyecto error [proyecto=%] [empresa=%]: %', p_proyecto_id, v_empresa_id, SQLERRM;
  RAISE EXCEPTION 'Error al obtener el overview del proyecto';
END;
$$;

REVOKE ALL ON FUNCTION vf2_overview_proyecto(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION vf2_overview_proyecto(integer) FROM anon;
GRANT  EXECUTE ON FUNCTION vf2_overview_proyecto(integer) TO authenticated;
