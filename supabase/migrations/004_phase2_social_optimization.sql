-- ========================================
-- 004: Phase 2 - Otimização Social
-- ========================================
-- Migration para adicionar suporte à Fase 2 (Social Optimization)
-- Adiciona colunas de configuração de pesos, tabela de afinidades e coluna de coesão social

-- ========================================
-- 1. Atualizar tabela distributions com colunas de Fase 1 e Fase 2
-- ========================================

-- Adicionar colunas de configuração de pesos (Fase 1)
ALTER TABLE public.distributions
ADD COLUMN IF NOT EXISTS w_pref DECIMAL(5, 2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS w_dup DECIMAL(5, 2) DEFAULT 0.9,
ADD COLUMN IF NOT EXISTS w_div DECIMAL(5, 2) DEFAULT 0.35;

COMMENT ON COLUMN public.distributions.w_pref IS 'Peso de preferências na energia (Fase 1) - padrão 1.0';
COMMENT ON COLUMN public.distributions.w_dup IS 'Peso de duplicatas de fase na energia (Fase 1) - padrão 0.9';
COMMENT ON COLUMN public.distributions.w_div IS 'Peso de diversidade de fase na energia (Fase 1) - padrão 0.35';

-- Adicionar colunas de configuração da Fase 2
ALTER TABLE public.distributions
ADD COLUMN IF NOT EXISTS phase_2_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS w_soc DECIMAL(5, 2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS phase_2_iterations INTEGER DEFAULT 20000,
ADD COLUMN IF NOT EXISTS phase_2_temperature DECIMAL(5, 2) DEFAULT 0.8;

COMMENT ON COLUMN public.distributions.phase_2_enabled IS 'Se Fase 2 (Otimização Social) está habilitada';
COMMENT ON COLUMN public.distributions.w_soc IS 'Peso social na otimização da Fase 2 - padrão 1.0';
COMMENT ON COLUMN public.distributions.phase_2_iterations IS 'Número de iterações/swaps na Fase 2 - padrão 20000';
COMMENT ON COLUMN public.distributions.phase_2_temperature IS 'Temperatura inicial do Simulated Annealing (Fase 2) - padrão 0.8';

-- Atualizar coluna status para incluir novos valores (sem quebrar valores existentes)
-- Valores possíveis: pending, ready, phase1_executing, phase1_completed, phase2_executing, phase2_completed, completed, failed

-- ========================================
-- 2. Criar tabela student_affinities (afinidades entre alunos)
-- ========================================
CREATE TABLE IF NOT EXISTS public.student_affinities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  student_from_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_to_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  affinity_value_raw INTEGER NOT NULL,           -- Range: -100 a +100 (escala da UI)
  affinity_value DECIMAL(3, 2),                 -- Range: -1.00 a +1.00 (escala do algoritmo)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT affinity_range CHECK (affinity_value_raw >= -100 AND affinity_value_raw <= 100),
  CONSTRAINT no_self_affinity CHECK (student_from_id != student_to_id),
  CONSTRAINT unique_affinity UNIQUE(distribution_id, student_from_id, student_to_id)
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_affinities_distribution ON public.student_affinities(distribution_id);
CREATE INDEX IF NOT EXISTS idx_affinities_from ON public.student_affinities(student_from_id);
CREATE INDEX IF NOT EXISTS idx_affinities_to ON public.student_affinities(student_to_id);
CREATE INDEX IF NOT EXISTS idx_affinities_distribution_from ON public.student_affinities(distribution_id, student_from_id);

COMMENT ON TABLE public.student_affinities IS 'Afinidades sociais entre alunos (Fase 2) - matrix esparsa';
COMMENT ON COLUMN public.student_affinities.affinity_value_raw IS 'Valor bruto da UI (-100 a +100)';
COMMENT ON COLUMN public.student_affinities.affinity_value IS 'Valor normalizado para algoritmo (-1.00 a +1.00)';

-- ========================================
-- 3. Adicionar coluna social_cohesion_score à tabela groups
-- ========================================
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS social_cohesion_score DECIMAL(10, 4) DEFAULT 0.0;

COMMENT ON COLUMN public.groups.social_cohesion_score IS 'Score de coesão social do grupo (calculado pela Fase 2)';

-- ========================================
-- 4. Criar função de trigger para calcular affinity_value normalizado
-- ========================================
CREATE OR REPLACE FUNCTION public.normalize_affinity_value()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalizar valor: dividir por 100
  NEW.affinity_value := NEW.affinity_value_raw / 100.0;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_normalize_affinity ON public.student_affinities;
CREATE TRIGGER trigger_normalize_affinity
BEFORE INSERT OR UPDATE ON public.student_affinities
FOR EACH ROW
EXECUTE FUNCTION public.normalize_affinity_value();

COMMENT ON FUNCTION public.normalize_affinity_value IS 'Normaliza affinity_value para escala [-1.00, +1.00]';

-- ========================================
-- 5. Criar view para recuperar afinidades simétricas
-- ========================================
-- View que retorna afinidades em ambas as direções (A_ij e A_ji)
CREATE OR REPLACE VIEW public.student_affinities_symmetric AS
SELECT
  id,
  distribution_id,
  student_from_id,
  student_to_id,
  affinity_value_raw,
  affinity_value,
  created_at,
  updated_at
FROM public.student_affinities
UNION ALL
SELECT
  id,
  distribution_id,
  student_to_id AS student_from_id,
  student_from_id AS student_to_id,
  affinity_value_raw,
  affinity_value,
  created_at,
  updated_at
FROM public.student_affinities;

COMMENT ON VIEW public.student_affinities_symmetric IS 'View que mostra afinidades em ambas as direções (A_ij e A_ji simétricas)';

-- ========================================
-- Verificação: Contar tabelas e colunas
-- ========================================
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Esperado: 8 tabelas (organizers, distributions, themes, students, student_preferences, groups, group_students, student_affinities)

-- SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'distributions';
-- Esperado: > 10 colunas (incluindo novas: w_pref, w_dup, w_div, phase_2_enabled, w_soc, phase_2_iterations, phase_2_temperature)
