# 🔧 Como Executar as Migrações no Supabase Dashboard

## ⚠️ IMPORTANTE: Não consigo executar via MCP
O sistema de MCP do Supabase está retornando erro de permissão. **Você precisa executar manualmente no dashboard.**

---

## ✅ Passo-a-Passo (Manual no Dashboard)

### 1️⃣ Abra o Supabase Dashboard
- Acesse: https://supabase.com/dashboard
- Faça login com sua conta
- Selecione o projeto: **vkxgsejuqouozsejalhj**

### 2️⃣ Abra o SQL Editor
- No menu lateral esquerdo, clique em **"SQL Editor"**
- Clique em **"New Query"** (botão verde)

### 3️⃣ Execute a Primeira Migração (Criar Tabelas)
**Copie TODO o código abaixo e cole no SQL Editor do Supabase:**

```sql
-- ========================================
-- 001: Schema Inicial - Tabelas Principais
-- ========================================

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
  status VARCHAR(50) DEFAULT 'pending',
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
  course VARCHAR(10) NOT NULL,
  phase INTEGER NOT NULL,
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
  rank INTEGER NOT NULL,
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
```

**Após colar:**
- Clique em **"Run"** (botão cinzento no canto inferior direito)
- Ou pressione: **Ctrl + Enter**
- Aguarde a mensagem: **"Success"** ✅

---

### 4️⃣ Execute a Segunda Migração (RLS - Segurança)
**Crie uma nova query e copie o código abaixo:**

```sql
-- ========================================
-- 002: Row Level Security (RLS) Policies
-- ========================================

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
  USING (true);

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
  WITH CHECK (true);

CREATE POLICY "Anyone can read students from a distribution"
  ON public.students
  FOR SELECT
  USING (true);

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
  USING (true);

-- ========================================
-- 7. Policies para GROUP_STUDENTS (públicos, qualquer um lê)
-- ========================================
CREATE POLICY "Anyone can read group students"
  ON public.group_students
  FOR SELECT
  USING (true);
```

**Após colar:**
- Clique em **"Run"** (ou Ctrl + Enter)
- Aguarde a mensagem: **"Success"** ✅

---

### 5️⃣ Verificar se Tudo Funcionou

**Crie uma nova query e execute:**

```sql
-- Verificar tabelas criadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Esperado: 7 tabelas listadas**
- ✅ group_students
- ✅ groups
- ✅ organizers
- ✅ distributions
- ✅ student_preferences
- ✅ students
- ✅ themes

---

**Verificar RLS habilitado:**

```sql
-- Verificar se RLS está habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Esperado: Todas as linhas com `rowsecurity = true`** ✅

---

## ✅ Conclusão

Após executar estas 2 migrações:
- ✅ 7 tabelas criadas
- ✅ Índices criados para performance
- ✅ RLS (Row Level Security) habilitado
- ✅ Políticas de segurança configuradas
- ✅ Banco pronto para backend usar

**Avise quando tiver terminado! Então começaremos com o setup inicial do projeto (backend + frontend).**
