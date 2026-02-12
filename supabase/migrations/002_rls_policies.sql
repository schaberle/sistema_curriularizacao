-- ========================================
-- 002: Row Level Security (RLS) Policies
-- ========================================
-- Execute este arquivo no SQL Editor do Supabase Dashboard
-- Nota: RLS é importante para controlar quem acessa o quê

-- ========================================
-- Habilitar RLS em todas as tabelas
-- ========================================
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_students ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 1. Policies para ORGANIZERS (apenas self)
-- ========================================
CREATE POLICY "Organizers can read own data"
  ON public.organizers
  FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Organizers can update own data"
  ON public.organizers
  FOR UPDATE
  USING (auth.uid()::text = id::text);

-- ========================================
-- 2. Policies para DISTRIBUTIONS (apenas organizador creator)
-- ========================================
CREATE POLICY "Organizers can read own distributions"
  ON public.distributions
  FOR SELECT
  USING (organizer_id = auth.uid());

CREATE POLICY "Organizers can create distributions"
  ON public.distributions
  FOR INSERT
  WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "Organizers can update own distributions"
  ON public.distributions
  FOR UPDATE
  USING (organizer_id = auth.uid());

-- ========================================
-- 3. Policies para THEMES (associados a distribution)
-- ========================================
CREATE POLICY "Anyone can read themes from a distribution"
  ON public.themes
  FOR SELECT
  USING (true); -- Público, qualquer um pode ver temas

CREATE POLICY "Organizers can create themes"
  ON public.themes
  FOR INSERT
  WITH CHECK (
    distribution_id IN (
      SELECT id FROM public.distributions WHERE organizer_id = auth.uid()
    )
  );

-- ========================================
-- 4. Policies para STUDENTS (alunos criam sua entrada)
-- ========================================
CREATE POLICY "Anyone can create student record"
  ON public.students
  FOR INSERT
  WITH CHECK (true); -- Qualquer um pode se registrar

CREATE POLICY "Anyone can read students from a distribution"
  ON public.students
  FOR SELECT
  USING (true); -- Público, alunos podem ver nomes dos colegas

CREATE POLICY "Students can update own record"
  ON public.students
  FOR UPDATE
  USING (auth.uid()::text = id::text);

-- ========================================
-- 5. Policies para STUDENT_PREFERENCES
-- ========================================
CREATE POLICY "Students can create own preferences"
  ON public.student_preferences
  FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM public.students WHERE auth.uid()::text = id::text
    )
  );

CREATE POLICY "Students can read own preferences"
  ON public.student_preferences
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE auth.uid()::text = id::text
    )
  );

CREATE POLICY "Students can update own preferences"
  ON public.student_preferences
  FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE auth.uid()::text = id::text
    )
  );

-- ========================================
-- 6. Policies para GROUPS (públicos, qualquer um lê)
-- ========================================
CREATE POLICY "Anyone can read groups"
  ON public.groups
  FOR SELECT
  USING (true); -- Público

-- ========================================
-- 7. Policies para GROUP_STUDENTS (públicos, qualquer um lê)
-- ========================================
CREATE POLICY "Anyone can read group students"
  ON public.group_students
  FOR SELECT
  USING (true); -- Público

-- ========================================
-- Notas sobre RLS:
-- ========================================
-- - Alunos se registram sem autenticação (são public records)
-- - Organizadores autenticados com JWT podem:
--   - Criar distribuições
--   - Upload temas
--   - Executar distribuição (criar grupos)
-- - Alunos podem buscar resultado público por nome (sem login)
-- - RLS não é obrigatório para alunos, apenas para organizadores/distribuições
