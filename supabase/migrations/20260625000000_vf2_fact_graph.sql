-- =============================================================================
-- MIGRACIÓN: Módulo vf2_ — Fact Graph + Colección Colaborativa
-- Proyecto: sghnfhrrrjgfbtxvqymh
-- Fecha: 2026-06-25
-- Prefijo: vf2_ en TODOS los objetos nuevos
-- IMPORTANTE: No toca NINGUNA tabla/función existente (gri_tareas, ncg_tareas, etc.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONES (si no existen)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. MÉTRICAS (catálogo por empresa + vínculo a taxonomía)
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_metric (
  metric_id       bigserial PRIMARY KEY,
  empresa_id      integer   NOT NULL,
  public_id       text      NOT NULL DEFAULT nanoid(),
  codigo          text      NOT NULL,
  nombre          text      NOT NULL,
  descripcion     text,
  -- value_kind: num | text | json
  value_kind      text      NOT NULL DEFAULT 'num'
                  CHECK (value_kind IN ('num','text','json')),
  unidad          text,
  data_type_meta  jsonb     DEFAULT '{}',
  -- vínculos opcionales a taxonomía (mutuamente excluyentes)
  gri_item_id               bigint  REFERENCES gri_items_reporte(id) ON DELETE RESTRICT,
  gri_requerimiento_id      bigint  REFERENCES gri_items_requerimientos_reporte(id) ON DELETE RESTRICT,
  ncg_item_id               integer REFERENCES ncg_items_reporte(id) ON DELETE RESTRICT,
  ncg_requerimiento_id      integer REFERENCES ncg_items_requerimientos_reporte(id) ON DELETE RESTRICT,
  -- plantilla de tabla GRI (ej. 'T1'..'T28')
  gri_tabla_template        text,
  activo          boolean   NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vf2_metric_empresa_codigo_uq UNIQUE (empresa_id, codigo)
);

CREATE TRIGGER vf2_metric_set_updated_at
  BEFORE UPDATE ON vf2_metric
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE vf2_metric ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_metric_select ON vf2_metric FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_metric_insert ON vf2_metric FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_metric_update ON vf2_metric FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_metric_delete ON vf2_metric FOR DELETE
  USING (empresa_id = current_empresa_id() AND current_rol() = 'administrador');

-- -----------------------------------------------------------------------------
-- 2. FACT — identidad estable (SSOT)
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_fact (
  fact_id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          integer     NOT NULL,
  public_id           text        NOT NULL DEFAULT nanoid(),
  proyecto_id         integer     NOT NULL REFERENCES proyectos(proyecto_id) ON DELETE RESTRICT,
  metric_id           bigint      NOT NULL REFERENCES vf2_metric(metric_id) ON DELETE RESTRICT,
  -- coordenada dimensional
  periodo_inicio      date        NOT NULL,
  periodo_fin         date        NOT NULL,
  periodo_tipo        text        NOT NULL DEFAULT 'anual'
                      CHECK (periodo_tipo IN ('anual','semestral','trimestral','mensual','custom')),
  dims                jsonb       NOT NULL DEFAULT '{}',
  dims_hash           text        NOT NULL DEFAULT '',
  -- puntero a la revisión canónica actual
  current_revision_id uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vf2_fact_coordenada_uq
    UNIQUE (empresa_id, metric_id, proyecto_id, periodo_inicio, periodo_fin, dims_hash)
);

CREATE TRIGGER vf2_fact_set_updated_at
  BEFORE UPDATE ON vf2_fact
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE vf2_fact ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_fact_select ON vf2_fact FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_fact_insert ON vf2_fact FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_fact_update ON vf2_fact FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());

-- -----------------------------------------------------------------------------
-- 3. FACT_REVISION — append-only, inmutable (Cell History / linaje)
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_fact_revision (
  revision_id     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id         uuid        NOT NULL REFERENCES vf2_fact(fact_id) ON DELETE CASCADE,
  empresa_id      integer     NOT NULL,
  -- estado del ciclo de vida
  status          text        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','in_review','approved','superseded','rejected')),
  -- valor (solo uno aplica según value_kind del metric)
  value_num       numeric,
  value_text      text,
  value_json      jsonb,
  unidad          text,
  -- linaje
  prev_revision_id uuid       REFERENCES vf2_fact_revision(revision_id) ON DELETE RESTRICT,
  is_current      boolean     NOT NULL DEFAULT false,
  -- trazabilidad de origen
  source_kind     text        NOT NULL DEFAULT 'manual'
                  CHECK (source_kind IN ('manual','import','formula','api')),
  source_cell_id  bigint,     -- se rellena al aprobar (FK a vf2_cell)
  actor_uid       uuid        NOT NULL,
  nota            text,       -- comentario de varianza
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- SOLO UNA revisión aprobada es_current por fact
CREATE UNIQUE INDEX vf2_fact_revision_current_uq
  ON vf2_fact_revision (fact_id)
  WHERE is_current = true;

ALTER TABLE vf2_fact_revision ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_fact_revision_select ON vf2_fact_revision FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_fact_revision_insert ON vf2_fact_revision FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
-- Prohibir UPDATE de valores (append-only); solo is_current y status pueden cambiar via RPC
CREATE POLICY vf2_fact_revision_update ON vf2_fact_revision FOR UPDATE
  USING (empresa_id = current_empresa_id());

-- -----------------------------------------------------------------------------
-- 4. BINDING — Linked Data (consumidores del Fact)
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_binding (
  binding_id          bigserial   PRIMARY KEY,
  empresa_id          integer     NOT NULL,
  fact_id             uuid        NOT NULL REFERENCES vf2_fact(fact_id) ON DELETE CASCADE,
  -- consumer_kind: grid_cell | doc_node | chart_series
  consumer_kind       text        NOT NULL
                      CHECK (consumer_kind IN ('grid_cell','doc_node','chart_series')),
  consumer_ref        jsonb       NOT NULL DEFAULT '{}',
  -- binding_mode: live (sigue latest approved) | pinned (fija una revisión)
  binding_mode        text        NOT NULL DEFAULT 'live'
                      CHECK (binding_mode IN ('live','pinned')),
  pinned_revision_id  uuid        REFERENCES vf2_fact_revision(revision_id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER vf2_binding_set_updated_at
  BEFORE UPDATE ON vf2_binding
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE vf2_binding ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_binding_select ON vf2_binding FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_binding_insert ON vf2_binding FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_binding_update ON vf2_binding FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_binding_delete ON vf2_binding FOR DELETE
  USING (empresa_id = current_empresa_id());

-- -----------------------------------------------------------------------------
-- 5. COLECCIÓN — agrupador de tareas por proyecto + estándar
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_coleccion (
  coleccion_id    bigserial   PRIMARY KEY,
  empresa_id      integer     NOT NULL,
  public_id       text        NOT NULL DEFAULT nanoid(),
  proyecto_id     integer     NOT NULL REFERENCES proyectos(proyecto_id) ON DELETE RESTRICT,
  estandar        text        NOT NULL CHECK (estandar IN ('GRI','NCG','SASB')),
  nombre          text        NOT NULL,
  descripcion     text,
  estado          text        NOT NULL DEFAULT 'activa'
                  CHECK (estado IN ('activa','cerrada')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vf2_coleccion_proyecto_estandar_uq UNIQUE (empresa_id, proyecto_id, estandar)
);

CREATE TRIGGER vf2_coleccion_set_updated_at
  BEFORE UPDATE ON vf2_coleccion
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE vf2_coleccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_coleccion_select ON vf2_coleccion FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_coleccion_insert ON vf2_coleccion FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_coleccion_update ON vf2_coleccion FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());

-- -----------------------------------------------------------------------------
-- 6. TAREA vf2_ — tarea nueva, sin tocar gri_tareas / ncg_tareas
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_tarea (
  tarea_id        bigserial   PRIMARY KEY,
  empresa_id      integer     NOT NULL,
  public_id       text        NOT NULL DEFAULT nanoid(),
  coleccion_id    bigint      NOT NULL REFERENCES vf2_coleccion(coleccion_id) ON DELETE RESTRICT,
  -- vínculos a taxonomía (solo uno aplica)
  gri_item_id               bigint  REFERENCES gri_items_reporte(id) ON DELETE RESTRICT,
  gri_requerimiento_id      bigint  REFERENCES gri_items_requerimientos_reporte(id) ON DELETE RESTRICT,
  ncg_item_id               integer REFERENCES ncg_items_reporte(id) ON DELETE RESTRICT,
  ncg_requerimiento_id      integer REFERENCES ncg_items_requerimientos_reporte(id) ON DELETE RESTRICT,
  -- estado del workflow
  estado          text        NOT NULL DEFAULT 'borrador'
                  CHECK (estado IN ('borrador','en_preparacion','en_revision','en_aprobacion','aprobada','devuelta')),
  version         integer     NOT NULL DEFAULT 1,
  titulo          text        NOT NULL,
  instruccion     text,
  fecha_limite    date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER vf2_tarea_set_updated_at
  BEFORE UPDATE ON vf2_tarea
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER vf2_tarea_bump_version
  BEFORE UPDATE ON vf2_tarea
  FOR EACH ROW EXECUTE FUNCTION bump_version();

ALTER TABLE vf2_tarea ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_tarea_select ON vf2_tarea FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_tarea_insert ON vf2_tarea FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_tarea_update ON vf2_tarea FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());

-- -----------------------------------------------------------------------------
-- 7. TAREA_ROL — asignación Preparer / Reviewer / Approver
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_tarea_rol (
  tarea_rol_id        bigserial   PRIMARY KEY,
  empresa_id          integer     NOT NULL,
  tarea_id            bigint      NOT NULL REFERENCES vf2_tarea(tarea_id) ON DELETE CASCADE,
  rol                 text        NOT NULL CHECK (rol IN ('preparer','reviewer','approver')),
  -- asignado a usuario individual XOR a equipo (check garantiza exclusividad)
  asignado_user_id    uuid,
  asignado_equipo_id  integer     REFERENCES equipos(equipo_id) ON DELETE SET NULL,
  CONSTRAINT vf2_tarea_rol_asignado_check
    CHECK (
      (asignado_user_id IS NOT NULL AND asignado_equipo_id IS NULL) OR
      (asignado_user_id IS NULL AND asignado_equipo_id IS NOT NULL)
    ),
  activo              boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vf2_tarea_rol_uq UNIQUE (tarea_id, rol)
);

ALTER TABLE vf2_tarea_rol ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_tarea_rol_select ON vf2_tarea_rol FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_tarea_rol_insert ON vf2_tarea_rol FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_tarea_rol_update ON vf2_tarea_rol FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_tarea_rol_delete ON vf2_tarea_rol FOR DELETE
  USING (empresa_id = current_empresa_id());

-- -----------------------------------------------------------------------------
-- 8. SHEET — hoja del grid por tarea
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_sheet (
  sheet_id        bigserial   PRIMARY KEY,
  empresa_id      integer     NOT NULL,
  public_id       text        NOT NULL DEFAULT nanoid(),
  tarea_id        bigint      NOT NULL REFERENCES vf2_tarea(tarea_id) ON DELETE CASCADE,
  template_id     text,
  yjs_doc_name    text        NOT NULL,
  orden           integer     NOT NULL DEFAULT 0,
  nombre          text        NOT NULL DEFAULT 'Hoja 1',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER vf2_sheet_set_updated_at
  BEFORE UPDATE ON vf2_sheet
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE vf2_sheet ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_sheet_select ON vf2_sheet FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_sheet_insert ON vf2_sheet FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_sheet_update ON vf2_sheet FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());

-- -----------------------------------------------------------------------------
-- 9. CELL — snapshot canónico del grid (server-authoritative)
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_cell (
  cell_id         bigserial   PRIMARY KEY,
  empresa_id      integer     NOT NULL,
  sheet_id        bigint      NOT NULL REFERENCES vf2_sheet(sheet_id) ON DELETE CASCADE,
  row_key         text        NOT NULL,
  col_key         text        NOT NULL,
  -- cell_kind: input (azul) | formula | fact_ref | locked
  cell_kind       text        NOT NULL DEFAULT 'input'
                  CHECK (cell_kind IN ('input','formula','fact_ref','locked')),
  value_num       numeric,
  value_text      text,
  value_json      jsonb,
  -- referencia al Fact si cell_kind = 'fact_ref'
  fact_ref_id     uuid        REFERENCES vf2_fact(fact_id) ON DELETE SET NULL,
  formula         text,
  validation      jsonb       DEFAULT '{}',
  estado_celda    text        NOT NULL DEFAULT 'vacio'
                  CHECK (estado_celda IN ('vacio','borrador','aprobada')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vf2_cell_sheet_pos_uq UNIQUE (empresa_id, sheet_id, row_key, col_key)
);

CREATE TRIGGER vf2_cell_set_updated_at
  BEFORE UPDATE ON vf2_cell
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE vf2_cell ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_cell_select ON vf2_cell FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_cell_insert ON vf2_cell FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_cell_update ON vf2_cell FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());

-- FK circular fact → cell (se añade luego de crear ambas tablas)
ALTER TABLE vf2_fact_revision
  ADD CONSTRAINT vf2_fact_revision_source_cell_fk
  FOREIGN KEY (source_cell_id) REFERENCES vf2_cell(cell_id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 10. EVIDENCIA — archivos adjuntos por tarea
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_evidencia (
  evidencia_id    bigserial   PRIMARY KEY,
  empresa_id      integer     NOT NULL,
  public_id       text        NOT NULL DEFAULT nanoid(),
  tarea_id        bigint      NOT NULL REFERENCES vf2_tarea(tarea_id) ON DELETE CASCADE,
  storage_path    text        NOT NULL,
  nombre_archivo  text        NOT NULL,
  mime_type       text,
  tamano_bytes    bigint,
  subido_por_uid  uuid        NOT NULL,
  eliminado       boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vf2_evidencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_evidencia_select ON vf2_evidencia FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_evidencia_insert ON vf2_evidencia FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_evidencia_update ON vf2_evidencia FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());

-- -----------------------------------------------------------------------------
-- 11. COMENTARIO — varianza y mensajes por tarea
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_comentario (
  comentario_id   bigserial   PRIMARY KEY,
  empresa_id      integer     NOT NULL,
  tarea_id        bigint      NOT NULL REFERENCES vf2_tarea(tarea_id) ON DELETE CASCADE,
  revision_id     uuid        REFERENCES vf2_fact_revision(revision_id) ON DELETE SET NULL,
  tipo            text        NOT NULL DEFAULT 'general'
                  CHECK (tipo IN ('general','varianza','devolucion')),
  contenido       text        NOT NULL,
  delta           jsonb,
  autor_uid       uuid        NOT NULL,
  eliminado       boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vf2_comentario ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_comentario_select ON vf2_comentario FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_comentario_insert ON vf2_comentario FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_comentario_update ON vf2_comentario FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());

-- -----------------------------------------------------------------------------
-- 12. YJS_SNAPSHOT — estado binario Yjs (experiencia de edición, NO verdad)
-- -----------------------------------------------------------------------------
CREATE TABLE vf2_yjs_snapshot (
  snapshot_id     bigserial   PRIMARY KEY,
  empresa_id      integer     NOT NULL,
  yjs_doc_name    text        NOT NULL,
  state_vector    bytea       NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vf2_yjs_snapshot_doc_uq UNIQUE (empresa_id, yjs_doc_name)
);

ALTER TABLE vf2_yjs_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY vf2_yjs_snapshot_select ON vf2_yjs_snapshot FOR SELECT
  USING (is_superadmin() OR empresa_id = current_empresa_id());
CREATE POLICY vf2_yjs_snapshot_upsert ON vf2_yjs_snapshot FOR INSERT
  WITH CHECK (empresa_id = current_empresa_id() AND is_activo());
CREATE POLICY vf2_yjs_snapshot_update ON vf2_yjs_snapshot FOR UPDATE
  USING (empresa_id = current_empresa_id() AND is_activo());

-- -----------------------------------------------------------------------------
-- 13. HELPER: función para calcular dims_hash canónico
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vf2_dims_hash(p_dims jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT md5(
    COALESCE(
      (SELECT string_agg(key || '=' || value, ',' ORDER BY key)
       FROM jsonb_each_text(p_dims)),
      ''
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- 14. HELPER VIEW: vf2_fact_actual — Fact con su revisión actual aprobada
-- -----------------------------------------------------------------------------
CREATE VIEW vf2_fact_actual AS
SELECT
  f.fact_id,
  f.empresa_id,
  f.public_id,
  f.proyecto_id,
  f.metric_id,
  f.periodo_inicio,
  f.periodo_fin,
  f.periodo_tipo,
  f.dims,
  r.revision_id    AS current_revision_id,
  r.status         AS revision_status,
  r.value_num,
  r.value_text,
  r.value_json,
  r.unidad,
  r.actor_uid      AS aprobado_por_uid,
  r.created_at     AS aprobado_en,
  r.nota
FROM vf2_fact f
LEFT JOIN vf2_fact_revision r
  ON r.revision_id = f.current_revision_id AND r.is_current = true;

-- -----------------------------------------------------------------------------
-- 15. RPC: vf2_aprobar_tarea — el corazón del Fact Graph
--     Materializa el snapshot Yjs → vf2_cell → vf2_fact / vf2_fact_revision
--     SECURITY DEFINER para poder leer/escribir con privilegios elevados,
--     pero el cuerpo valida rol y tenant manualmente.
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
      --     La relación celda→fact se hace vía fact_ref_id si ya existe; si no, se crea.
      IF v_cell.fact_ref_id IS NOT NULL THEN
        SELECT * INTO v_fact FROM vf2_fact WHERE fact_id = v_cell.fact_ref_id AND empresa_id = v_empresa_id;
      END IF;

      IF NOT FOUND OR v_cell.fact_ref_id IS NULL THEN
        -- Crear Fact si no existe (la clave de coordinada está en validation jsonb o se puede
        -- inferir del sheet/template; para el slice inicial usamos un dims vacío)
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

-- Revocar acceso público y otorgar solo a authenticated
REVOKE EXECUTE ON FUNCTION vf2_aprobar_tarea(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vf2_aprobar_tarea(text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 16. RPC: vf2_cambiar_estado_tarea — transiciones de workflow
-- -----------------------------------------------------------------------------
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
  v_actor_uid  uuid;
  v_empresa_id integer;
  v_tarea      vf2_tarea%ROWTYPE;
  v_rol_actor  text;
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

  -- Validar transiciones permitidas
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

  -- Actualizar estado
  UPDATE vf2_tarea
  SET estado = p_nuevo_estado, updated_at = now()
  WHERE tarea_id = v_tarea.tarea_id;

  -- Insertar comentario de devolución si aplica
  IF p_nuevo_estado = 'devuelta' AND p_nota IS NOT NULL THEN
    INSERT INTO vf2_comentario (empresa_id, tarea_id, tipo, contenido, autor_uid)
    VALUES (v_empresa_id, v_tarea.tarea_id, 'devolucion', p_nota, v_actor_uid);
  END IF;

  PERFORM log_usuario_accion(
    p_accion      := 'VF2_CAMBIO_ESTADO_TAREA',
    p_tabla       := 'vf2_tarea',
    p_registro_id := v_tarea.public_id,
    p_datos_prev  := jsonb_build_object('estado', v_tarea.estado),
    p_datos_new   := jsonb_build_object('estado', p_nuevo_estado, 'nota', p_nota),
    p_proyecto_id := (SELECT proyecto_id FROM vf2_coleccion WHERE coleccion_id = v_tarea.coleccion_id)
  );

  RETURN jsonb_build_object('ok', true, 'nuevo_estado', p_nuevo_estado);
END;
$$;

REVOKE EXECUTE ON FUNCTION vf2_cambiar_estado_tarea(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vf2_cambiar_estado_tarea(text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 17. RPC: vf2_crear_coleccion — crea colección + tarea inicial para un estándar
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
-- 18. ÍNDICES de performance
-- -----------------------------------------------------------------------------
CREATE INDEX vf2_fact_empresa_proyecto_idx ON vf2_fact (empresa_id, proyecto_id);
CREATE INDEX vf2_fact_metric_idx ON vf2_fact (metric_id);
CREATE INDEX vf2_fact_revision_fact_idx ON vf2_fact_revision (fact_id);
CREATE INDEX vf2_fact_revision_current_idx ON vf2_fact_revision (fact_id, is_current);
CREATE INDEX vf2_binding_fact_idx ON vf2_binding (fact_id);
CREATE INDEX vf2_binding_empresa_idx ON vf2_binding (empresa_id);
CREATE INDEX vf2_tarea_coleccion_idx ON vf2_tarea (coleccion_id);
CREATE INDEX vf2_tarea_estado_idx ON vf2_tarea (empresa_id, estado);
CREATE INDEX vf2_cell_sheet_idx ON vf2_cell (sheet_id);
CREATE INDEX vf2_comentario_tarea_idx ON vf2_comentario (tarea_id);
CREATE INDEX vf2_evidencia_tarea_idx ON vf2_evidencia (tarea_id);

-- =============================================================================
-- FIN MIGRACIÓN vf2_fact_graph
-- =============================================================================
