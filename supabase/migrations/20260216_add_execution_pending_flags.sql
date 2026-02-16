ALTER TABLE public.distributions
ADD COLUMN IF NOT EXISTS phase1_needs_rerun boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS phase2_needs_rerun boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.distributions.phase1_needs_rerun IS
'Indica que houve alteracao anterior e a Fase 1 precisa ser reexecutada.';

COMMENT ON COLUMN public.distributions.phase2_needs_rerun IS
'Indica que houve alteracao anterior e a Fase 2 precisa ser reexecutada.';
