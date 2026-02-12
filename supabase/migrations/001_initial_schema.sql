-- ========================================
-- 001: Schema Inicial - Tabelas Principais
-- ========================================
-- Execute este arquivo no SQL Editor do Supabase Dashboard

-- ========================================
-- 1. Tabela de Organizadores
-- ========================================
CREATE TABLE IF NOT EXISTS public.organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizers_email ON public.organizers(email);

COMMENT ON TABLE public.organizers IS 'Tabela de organizadores/administradores da atividade';
COMMENT ON COLUMN public.organizers.email IS 'Email único do organizador para login';
COMMENT ON COLUMN public.organizers.password_hash IS 'Hash bcrypt da senha do organizador';

-- ========================================
-- 2. Tabela de Distribuições
-- ========================================
CREATE TABLE IF NOT EXISTS public.distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
  created_at TIMESTAMP DEFAULT NOW(),
  executed_at TIMESTAMP,
  completed_at TIMESTAMP,
  total_score DECIMAL(10, 2),
  is_feasible BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_distributions_organizer ON public.distributions(organizer_id);
CREATE INDEX IF NOT EXISTS idx_distributions_status ON public.distributions(status);

COMMENT ON TABLE public.distributions IS 'Histórico de execuções de distribuição de grupos';
COMMENT ON COLUMN public.distributions.status IS 'Status da distribuição: pending, running, completed, failed';
COMMENT ON COLUMN public.distributions.total_score IS 'Score total de satisfação de preferências (0-10000)';
COMMENT ON COLUMN public.distributions.is_feasible IS 'Se a distribuição respeitou todas as restrições críticas';

-- ========================================
-- 3. Tabela de Temas/Projetos
-- ========================================
CREATE TABLE IF NOT EXISTS public.themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  max_groups INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_themes_distribution ON public.themes(distribution_id);

COMMENT ON TABLE public.themes IS 'Temas/Projetos disponíveis na atividade';
COMMENT ON COLUMN public.themes.max_groups IS 'Número máximo de grupos que podem escolher este tema';

-- ========================================
-- 4. Tabela de Alunos
-- ========================================
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  course VARCHAR(10) NOT NULL, -- 'EE' (Eng. Elétrica) ou 'ME' (Eng. Mecânica)
  phase INTEGER NOT NULL, -- 1-10 (fases do curso)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_distribution ON public.students(distribution_id);
CREATE INDEX IF NOT EXISTS idx_students_course ON public.students(course);
CREATE INDEX IF NOT EXISTS idx_students_phase ON public.students(phase);
CREATE INDEX IF NOT EXISTS idx_students_name ON public.students(name);

COMMENT ON TABLE public.students IS 'Alunos participantes da atividade';
COMMENT ON COLUMN public.students.course IS 'Curso do aluno: EE = Engenharia Elétrica, ME = Engenharia Mecânica';
COMMENT ON COLUMN public.students.phase IS 'Fase/Semestre do curso (1-10)';

-- ========================================
-- 5. Tabela de Preferências de Alunos
-- ========================================
CREATE TABLE IF NOT EXISTS public.student_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL, -- 1 = mais preferido, N = menos preferido
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_student_preferences_student ON public.student_preferences(student_id);
CREATE INDEX IF NOT EXISTS idx_student_preferences_theme ON public.student_preferences(theme_id);

COMMENT ON TABLE public.student_preferences IS 'Ranking de preferência de temas por aluno';
COMMENT ON COLUMN public.student_preferences.rank IS 'Posição na preferência (1 = mais preferido)';

-- ========================================
-- 6. Tabela de Grupos
-- ========================================
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_distribution ON public.groups(distribution_id);
CREATE INDEX IF NOT EXISTS idx_groups_theme ON public.groups(theme_id);

COMMENT ON TABLE public.groups IS 'Grupos formados na distribuição (cada grupo tem 4 alunos)';

-- ========================================
-- 7. Tabela de Associação Grupo-Aluno (Junction Table)
-- ========================================
CREATE TABLE IF NOT EXISTS public.group_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_group_students_group ON public.group_students(group_id);
CREATE INDEX IF NOT EXISTS idx_group_students_student ON public.group_students(student_id);

COMMENT ON TABLE public.group_students IS 'Associação entre grupos e alunos (um aluno pertence a um grupo)';

-- ========================================
-- Verificação: contar tabelas criadas
-- ========================================
-- SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
-- Esperado: 7 tabelas (organizers, distributions, themes, students, student_preferences, groups, group_students)
