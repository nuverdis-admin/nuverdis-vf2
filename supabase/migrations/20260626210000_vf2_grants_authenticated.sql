-- 20260626210000_vf2_grants_authenticated.sql
--
-- BUG CRÍTICO: las tablas vf2_ se crearon SIN GRANT a `authenticated` (solo
-- tenían los privilegios residuales REFERENCES/TRIGGER/TRUNCATE). Sin el grant
-- a nivel tabla, el rol `authenticated` no puede tocar la tabla y RLS ni
-- siquiera se evalúa → toda query directa del cliente (sidenav de colecciones,
-- listas de tareas, detalle, evidencias, linked data) devolvía vacío con
-- "permission denied for table vf2_*", mientras los RPCs SECURITY DEFINER
-- (overview, crear colección) sí funcionaban porque corren como el owner.
--
-- Síntoma observado: overview mostraba "2 colecciones" (RPC) pero el sidenav
-- mostraba "Sin colecciones" (SELECT directo bloqueado por falta de grant).
--
-- SEGURIDAD: RLS está habilitado en las 12 tablas vf2_ con políticas
-- TO authenticated (empresa_id = current_empresa_id()). El grant otorga acceso
-- a nivel tabla; RLS sigue siendo la barrera que filtra filas por empresa.
-- Verificado: empresa A no ve filas de empresa B tras el grant. No se otorga
-- nada a `anon`.

-- 1. Tablas base vf2_: SELECT/INSERT/UPDATE/DELETE (RLS filtra las filas).
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'vf2_%'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- 2. Secuencias serial vf2_: USAGE + SELECT (necesario para que INSERT genere id).
DO $$
DECLARE s text;
BEGIN
  FOR s IN
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public' AND sequence_name LIKE 'vf2_%'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', s);
  END LOOP;
END $$;

-- 3. Vista vf2_fact_actual: su owner es `postgres`, así que por defecto bypassa
--    la RLS de vf2_fact / vf2_fact_revision. Forzar security_invoker para que
--    respete la RLS del usuario que consulta (evita fuga cross-tenant), y luego
--    conceder SELECT.
ALTER VIEW public.vf2_fact_actual SET (security_invoker = true);
GRANT SELECT ON public.vf2_fact_actual TO authenticated;
