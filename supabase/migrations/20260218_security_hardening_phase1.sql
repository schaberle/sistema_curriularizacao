-- security_hardening_phase1
-- Enforce backend-only access pattern with strict RLS and no public table grants.

BEGIN;

CREATE TABLE IF NOT EXISTS public.student_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  distribution_id uuid NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,
  csrf_token_hash text NOT NULL,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  replaced_by_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_sessions_student_id ON public.student_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_distribution_id ON public.student_sessions(distribution_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_expires_at ON public.student_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_student_sessions_revoked_at ON public.student_sessions(revoked_at);

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id bigserial PRIMARY KEY,
  actor_type text NOT NULL,
  actor_id uuid,
  event_type text NOT NULL,
  path text,
  method text,
  status_code integer,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON public.security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type ON public.security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_status_code ON public.security_audit_logs(status_code);

DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.tablename);
  END LOOP;
END;
$$;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

REVOKE ALL ON SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    BEGIN
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privilege to alter default privileges for role postgres';
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    BEGIN
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privilege to alter default privileges for role supabase_admin';
    END;
  END IF;
END;
$$;

CREATE OR REPLACE VIEW public.security_rls_violations AS
SELECT n.nspname AS schema_name, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity;

CREATE OR REPLACE VIEW public.security_permissive_write_policy_violations AS
SELECT schemaname AS schema_name, tablename AS table_name, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  AND (
    coalesce(qual, '') = 'true'
    OR coalesce(with_check, '') = 'true'
  );

CREATE OR REPLACE VIEW public.security_grant_violations AS
SELECT table_schema AS schema_name, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated');

COMMENT ON VIEW public.security_rls_violations IS 'Compliance view: must be empty.';
COMMENT ON VIEW public.security_permissive_write_policy_violations IS 'Compliance view: must be empty.';
COMMENT ON VIEW public.security_grant_violations IS 'Compliance view: must be empty.';

ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
