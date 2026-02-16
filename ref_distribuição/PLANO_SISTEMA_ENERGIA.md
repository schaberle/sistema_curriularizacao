# Plano: atualização do Sistema de Distribuição

## Contexto

Este plano descreve como **refatorar completamente** o sistema de distribuição para implementar o modelo ideal de energia em 2 fases.

### Sistema Ideal (ref_distribuição/SISTEMA_IDEAL_DISTRIBUICAO)

O sistema de referência implementa um modelo matemático baseado em **funções de energia** (minimização):

**Fase 1**: Formação inicial de grupos
- **Função de energia**: E(grupo, tema) = E_pref + E_fase (com máscara dura)
- **E_pref** = -w_pref × Σ score_normalizado[0,1]
- **E_fase** = w_dup × duplicatas_fase - w_div × diversidade_fase
- **Máscara dura**: E = +∞ se grupo viola restrições críticas (1-2 elétrica, 2+ fases)
- **Normalização de scores**: g(rank) → [0,1] onde g(1)=100, g(2)=70, g(3)=50, ...
- **Algoritmo**: construção gulosa + swaps com Simulated Annealing (minimização de ΔE)
- **Parâmetros ajustáveis**: w_pref, w_dup, w_div

**Fase 2**: Ajuste social
- **Energia social adicional**: E_soc(grupo) = -w_soc × Σ A_ij (pares no grupo)
- Input: solução da Fase 1 + matriz de afinidades A_ij entre alunos
- A_ij ∈ [-1, 1]: +1 = forte afinidade, -1 = conflito, 0 = neutro
- Isolamento individual: S(i, grupo) = Σ A_ij (afinidades do aluno i no grupo)
- Swaps guiados: alunos com baixo S(i) têm maior probabilidade de troca
- Mantém todas as restrições duras da Fase 1
- **Parâmetro ajustável**: w_soc

### Sistema Atual (TypeScript + Express + Supabase)

**Paradigma diferente** - usa maximização de score (não energia):
1. **SolutionGenerator**: construção gulosa baseada em preferências
2. **LocalSearch**: refinamento 2-opt (swaps entre grupos)
3. **SimulatedAnnealing**: otimização global com temperatura
4. **Scoring**: Score = 1000/rank (não normalizado)
5. **Constraints**: Penalidades fixas (5000 crítico, 50 desejável) - não máscara dura

**Stack**: TypeScript, Express, Supabase (PostgreSQL), Domain-Driven Design

**Problema**: Sistema atual não usa modelo de energia ideal, não normaliza scores, e não considera afinidades sociais.

---

## Escopo da Refatoração

Este plano **substitui completamente** o algoritmo atual pelo modelo ideal:

### Mudanças na Fase 1 (CORE da refatoração):
1. ✅ Substituir `PreferenceScorer` por `EnergyCalculator`
2. ✅ Implementar normalização de scores [0,1]
3. ✅ Implementar E_pref, E_fase com pesos configuráveis
4. ✅ Implementar máscara dura (E = ∞) em vez de penalidades
5. ✅ Atualizar SolutionGenerator, LocalSearch, SimulatedAnnealing para minimizar energia
6. ✅ Adicionar configuração de pesos (w_pref, w_dup, w_div) no banco e dashboard

### Adição da Fase 2 (novo):
7. ✅ Implementar E_soc (energia social)
8. ✅ Implementar SocialOptimizer com swaps guiados por isolamento
9. ✅ UI para declaração de afinidades (slider -100 a +100)
10. ✅ Execução em duas etapas (Phase 1 → affinities → Phase 2)

---

## Fluxo de Execução (Conforme Especificação do Usuário)

O usuário definiu um fluxo específico onde a Fase 2 acontece **após** a Fase 1:

```
1. Alunos se cadastram e submetem preferências de tema
2. Organizador executa FASE 1 → grupos iniciais são formados
3. Sistema libera interface de afinidades
4. Alunos veem seu grupo atual e declaram afinidades:
   - Interface mostra membros do grupo atual
   - Busca permite adicionar outros alunos
   - Slider -100 a +100 para cada pessoa
5. Organizador executa FASE 2 → grupos são ajustados
6. Alunos veem resultado final
```

**Implicações importantes**:
- Duas execuções separadas (botões diferentes no dashboard)
- Estado intermediário da distribuição: `PHASE1_COMPLETED`
- Alunos declaram afinidades **conhecendo** seu grupo inicial
- Fase 2 é **opcional** (toggle no dashboard do organizador)

---

## Arquitetura da Solução

### 1. Refatoração da Fase 1: Modelo de Energia

#### 1.1 Nova Classe: `EnergyCalculator.ts` (substitui PreferenceScorer)

**Localização**: `backend/src/services/optimization/EnergyCalculator.ts`

**Responsabilidade**: Calcular energia de grupos e soluções usando modelo ideal.

**Estrutura**:

```typescript
export class EnergyCalculator {
  private wPref: number;   // Peso de preferências (default: 1.0)
  private wDup: number;    // Peso de duplicatas de fase (default: 0.9)
  private wDiv: number;    // Peso de diversidade de fase (default: 0.35)

  constructor(config: { wPref?: number; wDup?: number; wDiv?: number } = {}) {
    this.wPref = config.wPref ?? 1.0;
    this.wDup = config.wDup ?? 0.9;
    this.wDiv = config.wDiv ?? 0.35;
  }

  /**
   * Calcula energia de um grupo com tema atribuído
   * E(g, t) = E_pref(g, t) + E_fase(g) se viável, senão +∞
   */
  calculateGroupEnergy(group: Group, theme: Theme): number {
    // Máscara dura: verificar viabilidade
    if (!this.isGroupFeasible(group)) {
      return Infinity;
    }

    const ePref = this.calculatePreferenceEnergy(group, theme);
    const eFase = this.calculatePhaseEnergy(group);

    return ePref + eFase;
  }

  /**
   * E_pref = -w_pref × Σ score_normalizado
   * Nota: negativo porque preferências altas devem reduzir energia
   */
  private calculatePreferenceEnergy(group: Group, theme: Theme): number {
    let totalNormalizedScore = 0;

    for (const student of group.students) {
      const rank = student.getThemeRank(theme.id);
      const rawScore = this.rankToRawScore(rank);
      const normalizedScore = this.normalizeScore(student, rawScore);
      totalNormalizedScore += normalizedScore;
    }

    return -this.wPref * totalNormalizedScore;
  }

  /**
   * E_fase = w_dup × duplicatas - w_div × diversidade
   * onde:
   *   duplicatas = soma de (count - 1) para cada fase repetida
   *   diversidade = número de fases distintas
   */
  private calculatePhaseEnergy(group: Group): number {
    const phaseCounts = new Map<number, number>();

    for (const student of group.students) {
      const phase = student.phase;
      phaseCounts.set(phase, (phaseCounts.get(phase) || 0) + 1);
    }

    // Duplicatas: quantas vezes uma fase aparece além da primeira
    let duplicates = 0;
    for (const count of phaseCounts.values()) {
      if (count > 1) {
        duplicates += (count - 1);
      }
    }

    const diversity = phaseCounts.size;

    return this.wDup * duplicates - this.wDiv * diversity;
  }

  /**
   * Converte rank para score bruto (tabela do sistema ideal)
   */
  private rankToRawScore(rank: number): number {
    const scoreTable = [100, 70, 50, 35, 25, 18, 12, 8];
    if (rank <= 0 || rank > scoreTable.length) {
      return Math.max(0, 8 - (rank - scoreTable.length));
    }
    return scoreTable[rank - 1];
  }

  /**
   * Normaliza score para [0, 1]
   * normalized = (score - min) / (max - min)
   */
  private normalizeScore(student: Student, rawScore: number): number {
    const allRawScores = student.preferences.map(p =>
      this.rankToRawScore(student.getThemeRank(p.themeId))
    );

    const min = Math.min(...allRawScores);
    const max = Math.max(...allRawScores);

    if (max === min) return 0.5; // Todos iguais

    return (rawScore - min) / (max - min);
  }

  /**
   * Verifica viabilidade (restrições duras)
   * - 1-2 alunos de elétrica
   * - Mínimo 2 fases distintas
   */
  private isGroupFeasible(group: Group): boolean {
    if (group.students.length !== 4) return false;

    const electricalCount = group.students.filter(s => s.course === 'ELECTRICAL').length;
    if (electricalCount < 1 || electricalCount > 2) return false;

    const uniquePhases = new Set(group.students.map(s => s.phase)).size;
    if (uniquePhases < 2) return false;

    return true;
  }

  /**
   * Calcula energia total de uma solução
   */
  calculateSolutionEnergy(solution: Solution): number {
    let totalEnergy = 0;

    for (const group of solution.groups) {
      const theme = group.theme; // Assume group tem referência ao tema
      const energy = this.calculateGroupEnergy(group, theme);

      if (energy === Infinity) {
        return Infinity; // Solução inviável
      }

      totalEnergy += energy;
    }

    return totalEnergy;
  }

  /**
   * Encontra melhor tema para um grupo (minimiza energia)
   */
  findBestThemeForGroup(group: Group, themes: Theme[]): { theme: Theme; energy: number } {
    let bestTheme = themes[0];
    let bestEnergy = Infinity;

    for (const theme of themes) {
      const energy = this.calculateGroupEnergy(group, theme);
      if (energy < bestEnergy) {
        bestEnergy = energy;
        bestTheme = theme;
      }
    }

    return { theme: bestTheme, energy: bestEnergy };
  }
}
```

#### 1.2 Atualizar Classes de Otimização

**SolutionGenerator.ts**:
- Substituir chamadas a `PreferenceScorer` por `EnergyCalculator`
- Usar `findBestThemeForGroup()` para atribuição de temas
- Construção gulosa prioriza minimizar energia

**LocalSearch.ts**:
- Trocar paradigma de "melhorar score" para "reduzir energia"
- Aceitar swap se `ΔE < 0`
- Usar `EnergyCalculator.calculateSolutionEnergy()`

**SimulatedAnnealing.ts**:
- Aceitar vizinho se `ΔE < 0` ou `rand() < exp(-ΔE/T)`
- Temperatura resfria: `T = T₀ × (1 - iter/maxIter)`
- Tracking: energia ao longo do tempo (não score)

#### 1.3 Atualizar `Solution.ts`

Adicionar campo de energia:

```typescript
class Solution {
  // Existing fields...
  totalEnergy: number = 0;  // Energia total (Fase 1)

  getTotalEnergy(): number { return this.totalEnergy; }

  // totalScore ainda existe para compatibilidade, mas não é mais primário
}
```

---

### 2. Mudanças no Schema do Banco de Dados

#### 2.1 Configuração de Pesos (Fase 1)

```sql
ALTER TABLE public.distributions
ADD COLUMN IF NOT EXISTS w_pref DECIMAL(5, 2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS w_dup DECIMAL(5, 2) DEFAULT 0.9,
ADD COLUMN IF NOT EXISTS w_div DECIMAL(5, 2) DEFAULT 0.35;

COMMENT ON COLUMN public.distributions.w_pref IS 'Peso de preferências (Fase 1)';
COMMENT ON COLUMN public.distributions.w_dup IS 'Peso de duplicatas de fase (Fase 1)';
COMMENT ON COLUMN public.distributions.w_div IS 'Peso de diversidade de fase (Fase 1)';
```

#### 2.2 Nova Tabela: `student_affinities` (Fase 2)

```sql
CREATE TABLE IF NOT EXISTS public.student_affinities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  student_from_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_to_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  affinity_value INTEGER NOT NULL,  -- Range: -100 to +100 (UI scale)
  affinity_normalized DECIMAL(3, 2),  -- Range: -1.00 to +1.00 (algorithm scale)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT affinity_range CHECK (affinity_value >= -100 AND affinity_value <= 100),
  CONSTRAINT no_self_affinity CHECK (student_from_id != student_to_id),
  CONSTRAINT unique_affinity UNIQUE(student_from_id, student_to_id)
);

CREATE INDEX idx_affinities_distribution ON public.student_affinities(distribution_id);
CREATE INDEX idx_affinities_from ON public.student_affinities(student_from_id);
CREATE INDEX idx_affinities_to ON public.student_affinities(student_to_id);
```

**Nota**: Armazena tanto valor da UI (-100 a +100) quanto normalizado (-1.0 a +1.0).

#### 1.2 Atualizar Tabela `distributions`

```sql
ALTER TABLE public.distributions
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS social_optimization_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS social_weight DECIMAL(5, 2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS social_iterations INTEGER DEFAULT 20000;

-- Valores possíveis de status:
-- 'PENDING': aguardando temas/alunos
-- 'READY': pronto para Fase 1
-- 'PHASE1_COMPLETED': Fase 1 executada, aguardando afinidades
-- 'PHASE2_COMPLETED': Fase 2 executada, resultado final
-- 'COMPLETED': finalizado (alias para PHASE2_COMPLETED ou só PHASE1)
```

#### 1.3 Atualizar Tabela `groups`

```sql
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS social_cohesion_score DECIMAL(10, 4) DEFAULT 0.0;
```

**Arquivo de migração**: `supabase/migrations/003_social_optimization.sql`

---

### 2. Domain Models (Novos e Atualizados)

#### 2.1 Nova Classe: `Affinity.ts`

```typescript
export class Affinity {
  studentFromId: string;
  studentToId: string;
  value: number;           // -1.0 to +1.0 (normalized)
  valueRaw: number;        // -100 to +100 (UI scale)
  createdAt: Date;

  constructor(studentFromId: string, studentToId: string, valueRaw: number) {
    if (studentFromId === studentToId) {
      throw new Error('Student cannot declare affinity to themselves');
    }
    if (valueRaw < -100 || valueRaw > 100) {
      throw new Error('Affinity value must be between -100 and +100');
    }

    this.studentFromId = studentFromId;
    this.studentToId = studentToId;
    this.valueRaw = valueRaw;
    this.value = valueRaw / 100.0;  // Normalize to [-1.0, +1.0]
    this.createdAt = new Date();
  }

  isPositive(): boolean { return this.value > 0; }
  isNegative(): boolean { return this.value < 0; }
  isNeutral(): boolean { return this.value === 0; }
}
```

#### 2.2 Nova Classe: `AffinityMatrix.ts`

Representa matriz esparsa de afinidades com operações eficientes.

**Métodos principais**:
- `get(studentId1, studentId2): number` - Retorna afinidade (0 se não declarada)
- `set(studentId1, studentId2, value): void` - Define afinidade
- `calculateIsolationScore(studentId, groupStudentIds): number` - Calcula S(i, g)
- `calculateGroupCohesion(studentIds): number` - Soma de afinidades no grupo

**Estrutura interna**: `Map<string, number>` com chave "id1|id2" (ordenada)

#### 2.3 Atualizar `Solution.ts`

Adicionar propriedades para rastreamento social:

```typescript
class Solution {
  // Existing properties...
  socialScore: number = 0;
  socialOptimizationApplied: boolean = false;

  getSocialScore(): number { return this.socialScore; }
  getTotalScoreWithSocial(): number { return this.totalScore + this.socialScore; }

  // Update getSummary() to include social metrics
}
```

---

### 3. Nova Camada de Serviço: Social Optimizer

#### 3.1 Arquivo: `backend/src/services/optimization/SocialOptimizer.ts`

Implementa a **Fase 2** do sistema ideal (tradução de `simulacao_fase_2.py`).

**Responsabilidades**:
- Receber solução da Fase 1 + matriz de afinidades
- Executar otimização por swaps guiados
- Manter restrições duras (1-2 elétrica, 2+ fases)
- Retornar solução ajustada com métricas sociais

**Algoritmo**:
```
for iteration in 1..maxIterations:
  1. Escolher grupo aleatório
  2. Selecionar aluno com VIÉS para baixo S(i, grupo)
     - Pesos: exp(-S(i)) → menor isolamento = maior probabilidade
  3. Escolher outro grupo e aluno aleatório
  4. Propor swap
  5. Validar restrições duras → rejeitar se violar
  6. Calcular ΔE = E_nova - E_atual
  7. Aceitar se ΔE < 0 ou com probabilidade exp(-ΔE/T)
  8. Resfriar temperatura: T *= (1 - iteration/maxIterations)
```

**Função de Energia**:
```
E_total = E_base + E_social

E_base = -Score_preferencias + Penalidades_constraints
E_social = -w_soc × Σ(grupos) Σ(pares no grupo) A_ij
```

**Métodos principais**:
- `optimize(solution: Solution): Solution`
- `calculateTotalEnergy(solution: Solution): number`
- `calculateSocialEnergy(solution: Solution): number`
- `selectStudentByIsolation(group: Group): Student` (biased sampling)
- `getSocialMetrics(solution: Solution): SocialMetrics`

---

### 4. Atualizar Distribution Engine

#### 4.1 Modificar `DistributionEngine.ts`

**Mudança conceitual importante**: Separar Fase 1 e Fase 2 em métodos diferentes.

```typescript
class DistributionEngine {
  // NOVO: Executa apenas Fase 1 (3 fases atuais)
  async solvePhase1(students: Student[], themes: Theme[]): Promise<Solution> {
    // Existing 3-phase algorithm
    // Phase 1: SolutionGenerator
    // Phase 2: LocalSearch
    // Phase 3: SimulatedAnnealing
    return solution;
  }

  // NOVO: Executa Fase 2 (otimização social)
  async solvePhase2(
    phase1Solution: Solution,
    affinityMatrix: AffinityMatrix,
    config: SocialOptimizationConfig
  ): Promise<Solution> {
    const socialOptimizer = new SocialOptimizer(affinityMatrix, {
      socialWeight: config.weight,
      maxIterations: config.iterations,
      temperature: config.temperature
    });

    return socialOptimizer.optimize(phase1Solution);
  }

  // LEGADO: Manter método solve() para backward compatibility
  async solve(students: Student[], themes: Theme[]): Promise<Solution> {
    return this.solvePhase1(students, themes);
  }
}
```

---

### 5. Endpoints da API

#### 5.1 Organizer Routes (Execução)

**Dois novos endpoints separados**:

```typescript
// POST /api/organizer/distributions/:id/execute-phase1
// Executa Fase 1 (formação inicial de grupos)
// Atualiza status para 'PHASE1_COMPLETED'
router.post('/distributions/:id/execute-phase1', authMiddleware, async (req, res) => {
  // 1. Load students and themes
  // 2. Execute DistributionEngine.solvePhase1()
  // 3. Save groups to database
  // 4. Update distribution status = 'PHASE1_COMPLETED'
  // 5. Return result
});

// POST /api/organizer/distributions/:id/execute-phase2
// Executa Fase 2 (ajuste social)
// Requer: status === 'PHASE1_COMPLETED'
router.post('/distributions/:id/execute-phase2', authMiddleware, async (req, res) => {
  // 1. Verify status === 'PHASE1_COMPLETED'
  // 2. Load Phase 1 solution from database
  // 3. Load affinity matrix
  // 4. Execute DistributionEngine.solvePhase2()
  // 5. Update groups in database
  // 6. Save social cohesion scores
  // 7. Update distribution status = 'PHASE2_COMPLETED'
  // 8. Return result
});

// PUT /api/organizer/distributions/:id/social-config
// Configurar parâmetros da Fase 2
router.put('/distributions/:id/social-config', authMiddleware, async (req, res) => {
  const { enabled, weight, iterations } = req.body;
  await database.updateSocialOptimizationConfig(distributionId, { enabled, weight, iterations });
});
```

#### 5.2 Student Routes (Afinidades)

```typescript
// GET /api/students/:studentId/current-group
// Retorna grupo atual do aluno (após Fase 1)
router.get('/:studentId/current-group', async (req, res) => {
  const student = await database.getStudent(studentId);
  const group = await database.getStudentGroup(distributionId, studentId);

  if (!group) {
    return res.status(404).json({ error: 'Student not yet in a group. Phase 1 not executed.' });
  }

  const groupMembers = await database.getGroupStudents(group.id);
  res.json({ success: true, data: { group, members: groupMembers } });
});

// PUT /api/students/:studentId/affinities
// Submeter afinidades
router.put('/:studentId/affinities', async (req, res) => {
  const { affinities } = req.body;
  // affinities: [{ targetStudentId, value (-100 to +100) }]

  // Validate distribution is in PHASE1_COMPLETED status
  const distribution = await database.getDistributionByStudentId(studentId);
  if (distribution.status !== 'PHASE1_COMPLETED') {
    return res.status(400).json({ error: 'Cannot submit affinities. Phase 1 not completed.' });
  }

  // Clear old affinities
  await database.clearStudentAffinities(studentId);

  // Save new affinities
  for (const aff of affinities) {
    await database.addStudentAffinity(
      distribution.id,
      studentId,
      aff.targetStudentId,
      aff.value  // -100 to +100
    );
  }

  res.json({ success: true, message: 'Affinities saved' });
});

// GET /api/students/:studentId/affinities
// Obter afinidades declaradas
router.get('/:studentId/affinities', async (req, res) => {
  const affinities = await database.getStudentAffinities(studentId);
  res.json({ success: true, data: { affinities } });
});
```

#### 5.3 Public Routes

```typescript
// GET /api/search/result/:distributionId/:studentName
// Buscar resultado do aluno (retorna grupo com social_cohesion_score)
```

---

### 6. Database Service Extensions

Adicionar métodos em `DatabaseService.ts`:

**Affinities**:
- `addStudentAffinity(distributionId, studentFromId, studentToId, valueRaw)`
- `getStudentAffinities(studentId): AffinityData[]`
- `getDistributionAffinities(distributionId): AffinityData[]`
- `clearStudentAffinities(studentId)`

**Social Config**:
- `updateSocialOptimizationConfig(distributionId, config)`
- `getSocialOptimizationConfig(distributionId): SocialOptimizationConfig`

**Groups with Social**:
- `updateGroupSocialScore(groupId, score)`
- `getSocialMetrics(distributionId): { totalCohesion, avgCohesion, groups }`

**Distribution Status**:
- `updateDistributionStatus(distributionId, status: 'PHASE1_COMPLETED' | 'PHASE2_COMPLETED' | ...)`
- `getDistributionStatus(distributionId): string`

**Load Phase 1 Solution**:
- `loadSolutionFromDatabase(distributionId): Solution` - Reconstrói solução a partir de groups/group_students

---

### 7. Frontend Integration

#### 7.1 Nova Página: `AffinityInputPage.tsx`

**Rota**: `/distributions/:id/affinities`

**Quando acessível**: Após Fase 1 executada (status = 'PHASE1_COMPLETED')

**Layout**:

```
┌─────────────────────────────────────────────────┐
│  Declare suas afinidades sociais                │
├─────────────────────────────────────────────────┤
│  Seu Grupo Atual:                               │
│  ┌────────────────────────────────────────────┐ │
│  │ • João Silva (Mecânica, Fase 3)            │ │
│  │ • Maria Santos (Elétrica, Fase 5)          │ │
│  │ • Pedro Oliveira (Mecânica, Fase 7)        │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  Como você avalia trabalhar com cada pessoa?    │
│  Use -100 (conflito) a +100 (ótima afinidade)  │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ João Silva       [-100 ●────────── +100]   │ │
│  │                                             │ │
│  │ Maria Santos     [-100 ──●──────── +100]   │ │
│  │                                             │ │
│  │ Pedro Oliveira   [-100 ────────●── +100]   │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  🔍 Buscar outros alunos fora do grupo:         │
│  [___________________] [Buscar]                 │
│                                                  │
│  Alunos adicionados:                            │
│  ┌────────────────────────────────────────────┐ │
│  │ Ana Costa        [-100 ────●────── +100] ❌│ │
│  │ Carlos Lima      [-100 ──────●──── +100] ❌│ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  [Pular] [Salvar Afinidades]                    │
└─────────────────────────────────────────────────┘
```

**Funcionalidades**:
1. Mostra grupo atual do aluno
2. Sliders para cada membro do grupo (default: 0)
3. Busca para adicionar outros alunos (opcional)
4. Botão "Pular" (não submete nada, afinidades = vazio)
5. Botão "Salvar" (submete via PUT /api/students/:id/affinities)

**Componentes**:
- `AffinitySlider`: slider -100 a +100 com visualização numérica
- `StudentSearchBox`: busca outros alunos por nome
- `GroupMemberCard`: card com foto/nome/curso/fase

#### 7.2 Atualizar `OrganizerDashboard.tsx`

**Mudanças**:

```tsx
// Mostrar status da distribuição
<StatusBadge status={distribution.status} />
  // 'PENDING' → 'Aguardando dados'
  // 'READY' → 'Pronto para Fase 1'
  // 'PHASE1_COMPLETED' → 'Fase 1 concluída'
  // 'PHASE2_COMPLETED' → 'Finalizado'

// Seção de Fase 2 Social
<div className="social-config">
  <h3>Fase 2: Otimização Social</h3>
  <label>
    <input type="checkbox" checked={socialEnabled} onChange={...} />
    Ativar Fase 2 (ajuste por afinidades sociais)
  </label>

  {socialEnabled && (
    <>
      <label>Peso Social (w_soc):
        <input type="number" step="0.1" value={socialWeight} />
      </label>
      <label>Iterações:
        <input type="number" value={socialIterations} />
      </label>
    </>
  )}
</div>

// Dois botões de execução separados
{status === 'READY' && (
  <button onClick={executePhase1}>
    ▶️ Executar Fase 1 (Formação Inicial)
  </button>
)}

{status === 'PHASE1_COMPLETED' && socialEnabled && (
  <button onClick={executePhase2}>
    ▶️ Executar Fase 2 (Ajuste Social)
  </button>
)}
```

#### 7.3 Atualizar `StudentResultPage.tsx`

Adicionar visualização de coesão social:

```tsx
<div className="social-metrics">
  <h3>Coesão Social do Grupo</h3>
  <p>Score de Coesão: {group.socialCohesionScore?.toFixed(2) || 'N/A'}</p>
  {group.socialCohesionScore > 0 && (
    <p className="positive">✅ Grupo com boa afinidade entre membros</p>
  )}
  {group.socialCohesionScore < 0 && (
    <p className="negative">⚠️ Grupo com baixa afinidade (considerado durante otimização)</p>
  )}
</div>
```

---

### 8. Configuração e Parâmetros

**Parâmetros da Fase 2** (ajustáveis pelo organizador):

| Parâmetro | Descrição | Padrão | Range |
|-----------|-----------|--------|-------|
| `enabled` | Habilitar Fase 2 | `false` | boolean |
| `weight` | Peso social (w_soc) | `1.0` | 0.1 - 5.0 |
| `iterations` | Número de swaps | `20000` | 5000 - 50000 |
| `temperature` | Temperatura inicial | `0.8` | 0.1 - 2.0 |

**Valores recomendados**:
- Para grupos pequenos (< 50 alunos): w_soc = 1.0, iterations = 10000
- Para grupos médios (50-100 alunos): w_soc = 1.5, iterations = 20000
- Para grupos grandes (> 100 alunos): w_soc = 2.0, iterations = 30000

---

### 9. Arquivos Críticos para Implementação

#### FASE 1 - Refatoração do Modelo de Energia

| Arquivo | Descrição | Prioridade |
|---------|-----------|------------|
| `backend/src/services/optimization/EnergyCalculator.ts` | **NOVO**: Cálculo de energia (substitui PreferenceScorer) | 🔴 CRÍTICA |
| `backend/src/services/optimization/SolutionGenerator.ts` | **REFATORAR**: Usar EnergyCalculator em vez de score | 🔴 CRÍTICA |
| `backend/src/services/optimization/LocalSearch.ts` | **REFATORAR**: Minimizar energia (não maximizar score) | 🔴 CRÍTICA |
| `backend/src/services/optimization/SimulatedAnnealing.ts` | **REFATORAR**: ΔE em vez de ΔScore | 🔴 CRÍTICA |
| `backend/src/services/optimization/DistributionEngine.ts` | **REFATORAR**: Usar energia, split Phase1/Phase2 | 🔴 CRÍTICA |
| `backend/src/domain/Solution.ts` | **ATUALIZAR**: Adicionar totalEnergy, socialScore | 🟡 ALTA |
| `supabase/migrations/003_refactor_energy.sql` | Schema: w_pref, w_dup, w_div, status, affinities | 🟡 ALTA |

#### FASE 2 - Otimização Social (Nova)

| Arquivo | Descrição | Prioridade |
|---------|-----------|------------|
| `backend/src/domain/AffinityMatrix.ts` | **NOVO**: Matriz esparsa + cálculos S(i,g) | 🔴 CRÍTICA |
| `backend/src/domain/Affinity.ts` | **NOVO**: Entidade de afinidade | 🔴 CRÍTICA |
| `backend/src/services/optimization/SocialOptimizer.ts` | **NOVO**: Algoritmo Fase 2 com E_soc | 🔴 CRÍTICA |
| `backend/src/services/database/DatabaseService.ts` | **ATUALIZAR**: CRUD afinidades + status + config | 🟡 ALTA |
| `backend/src/routes/organizer.routes.ts` | **ATUALIZAR**: Endpoints execute-phase1/2, config | 🟡 ALTA |
| `backend/src/routes/student.routes.ts` | **ATUALIZAR**: Endpoints afinidades, current-group | 🟡 ALTA |

#### FRONTEND

| Arquivo | Descrição | Prioridade |
|---------|-----------|------------|
| `frontend/src/pages/AffinityInputPage.tsx` | **NOVO**: UI declaração afinidades (slider) | 🟡 MÉDIA |
| `frontend/src/pages/OrganizerDashboard.tsx` | **ATUALIZAR**: Config pesos, 2 botões execução | 🟡 MÉDIA |
| `frontend/src/pages/StudentResultPage.tsx` | **ATUALIZAR**: Social cohesion score | 🟢 BAIXA |

#### LEGADO (Remover ou Deprecar)

| Arquivo | Ação |
|---------|------|
| `backend/src/services/optimization/PreferenceScorer.ts` | ⚠️ **SUBSTITUIR** por EnergyCalculator |
| `backend/src/services/optimization/ConstraintValidator.ts` | ⚠️ **SIMPLIFICAR** (energia usa máscara dura, não penalidades) |

---

### 10. Plano de Implementação (Ordem Sugerida)

**IMPORTANTE**: Refatoração da Fase 1 ANTES de adicionar Fase 2.

---

#### **Semana 1: Refatoração Fase 1 - Base**
1. ✅ Aplicar migração `003_refactor_energy.sql` (w_pref, w_dup, w_div, status)
2. ✅ Implementar `EnergyCalculator.ts`:
   - Métodos de energia: E_pref, E_fase, E_total
   - Normalização de scores [0,1]
   - Máscara dura (Infinity para inviável)
   - Conversão rank → raw score (tabela)
3. ✅ Unit tests para EnergyCalculator:
   - Test normalização
   - Test E_pref (negativo proporcional a satisfação)
   - Test E_fase (duplicatas e diversidade)
   - Test máscara dura (grupo inviável → Infinity)
4. ✅ Atualizar `Solution.ts`:
   - Adicionar campo `totalEnergy`
   - Manter `totalScore` para compatibilidade (deprecated)

---

#### **Semana 2: Refatoração Fase 1 - Algoritmo**
5. ✅ Refatorar `SolutionGenerator.ts`:
   - Substituir PreferenceScorer por EnergyCalculator
   - Usar `findBestThemeForGroup()` (minimiza energia)
   - Construção gulosa baseada em energia
6. ✅ Refatorar `LocalSearch.ts`:
   - Trocar paradigma: aceitar swap se ΔE < 0
   - Usar `calculateSolutionEnergy()` em vez de score
7. ✅ Refatorar `SimulatedAnnealing.ts`:
   - Metropolis: aceitar se ΔE < 0 ou exp(-ΔE/T)
   - Tracking de energia (não score)
8. ✅ Unit tests para cada classe refatorada
9. ✅ Integration test: Pipeline completo Fase 1 com energia

---

#### **Semana 3: API e Config da Fase 1**
10. ✅ Adicionar métodos em `DatabaseService.ts`:
    - `updateEnergyConfig(distributionId, { wPref, wDup, wDiv })`
    - `getEnergyConfig(distributionId)`
    - `updateDistributionStatus(distributionId, status)`
11. ✅ Atualizar `DistributionEngine.ts`:
    - Receber config de pesos no construtor ou método
    - Instanciar `EnergyCalculator` com pesos configurados
    - Separar `solvePhase1()` (preparação para Fase 2)
    - Manter `solve()` para backward compatibility
12. ✅ Atualizar endpoint organizador:
    - `PUT /distributions/:id/energy-config` (configurar w_pref, w_dup, w_div)
    - `POST /execute-phase1` (executa Fase 1, status → PHASE1_COMPLETED)
13. ✅ Atualizar `OrganizerDashboard.tsx`:
    - Seção "Configuração de Pesos (Fase 1)"
    - Inputs para w_pref, w_dup, w_div com valores padrão
    - Tooltip explicando cada peso
14. ✅ Testes de integração API

---

#### **Semana 4: Fase 2 - Backend Core**
15. ✅ Implementar `Affinity.ts` (entity)
16. ✅ Implementar `AffinityMatrix.ts`:
    - Sparse matrix (Map<string, number>)
    - `calculateIsolationScore(studentId, groupStudentIds)`
    - `calculateGroupCohesion(studentIds)`
17. ✅ Implementar `SocialOptimizer.ts`:
    - Algoritmo de swaps guiados (tradução de simulacao_fase_2.py)
    - Biased sampling por isolamento: exp(-S(i))
    - Energia total: E_base + E_social
18. ✅ Adicionar métodos em `DatabaseService.ts`:
    - Affinities CRUD (add, get, clear)
    - Social config (w_soc, iterations)
    - Social metrics
    - Load solution from database
19. ✅ Atualizar `DistributionEngine.ts`:
    - Método `solvePhase2(phase1Solution, affinityMatrix, config)`
20. ✅ Unit tests para AffinityMatrix e SocialOptimizer

---

#### **Semana 5: Fase 2 - API e Frontend**
21. ✅ Implementar endpoints organizador:
    - `POST /execute-phase2` (requer status = PHASE1_COMPLETED)
    - `PUT /social-config` (w_soc, iterations, enabled)
    - `GET /social-metrics` (coesão por grupo)
22. ✅ Implementar endpoints aluno:
    - `GET /:studentId/current-group` (mostra grupo após Fase 1)
    - `PUT /:studentId/affinities` (submete afinidades)
    - `GET /:studentId/affinities` (recupera afinidades)
23. ✅ Criar `AffinityInputPage.tsx`:
    - Exibir grupo atual (após Fase 1)
    - Sliders -100 a +100 para membros do grupo
    - Busca para adicionar outros alunos
    - Botões "Pular" / "Salvar"
24. ✅ Atualizar `OrganizerDashboard.tsx`:
    - Seção "Fase 2: Otimização Social"
    - Toggle enable/disable
    - Config w_soc, iterations
    - Dois botões: "Executar Fase 1" / "Executar Fase 2"
    - Badge de status (PENDING, READY, PHASE1_COMPLETED, PHASE2_COMPLETED)
25. ✅ Atualizar `StudentResultPage.tsx`:
    - Exibir social_cohesion_score do grupo
26. ✅ Integration tests e E2E tests

---

#### **Semana 6: Testing, Tuning & Documentation**
27. ✅ Testes com dados reais (comparar resultados old vs new)
28. ✅ Tuning de parâmetros:
    - w_pref, w_dup, w_div (Fase 1)
    - w_soc, iterations (Fase 2)
29. ✅ Performance profiling e otimização
30. ✅ Documentação completa:
    - README atualizado
    - Guia de configuração de pesos
    - API documentation
31. ✅ Migration guide para usuários existentes

---

### 11. Verificação End-to-End

**Como testar o sistema completo**:

1. **Setup** (Organizador):
   - Criar distribuição
   - Upload temas (mínimo 8)
   - Habilitar "Fase 2 Social" no dashboard
   - Configurar w_soc = 1.5, iterations = 15000

2. **Fase 1**:
   - Cadastrar 20 alunos (mix de Elétrica/Mecânica, diferentes fases)
   - Cada aluno submete ranking de temas (1-8)
   - Organizador clica "Executar Fase 1"
   - ✅ Verificar: 5 grupos formados, todos viáveis (1-2 elétrica, 2+ fases)

3. **Afinidades**:
   - Alunos acessam página de afinidades
   - Veem seu grupo atual
   - Declaram afinidades (mix de positivo/negativo/neutro)
   - Pelo menos 50% dos alunos declaram afinidades

4. **Fase 2**:
   - Organizador clica "Executar Fase 2"
   - ✅ Verificar: alguns alunos trocaram de grupo
   - ✅ Verificar: grupos mantêm restrições duras
   - ✅ Verificar: social_cohesion_score > 0 na maioria dos grupos

5. **Resultado**:
   - Alunos buscam resultado por nome
   - Veem grupo final + tema + social cohesion score
   - ✅ Grupos com alta coesão (score > 2.0)

---

### 12. Backward Compatibility

**Garantias**:
- ✅ Fase 2 é **OPCIONAL** (default: disabled)
- ✅ Se `social_optimization_enabled = false` → apenas Fase 1 executa
- ✅ Endpoint `/execute` (legado) continua funcionando → chama `solvePhase1()`
- ✅ Novos endpoints não quebram fluxo existente
- ✅ Migrations adicionam colunas com defaults (sem quebrar dados existentes)
- ✅ Frontend: páginas novas são opcionais no fluxo

**Modo legado** (sem Fase 2):
```
1. Alunos cadastram preferências
2. Organizador executa (POST /execute ou /execute-phase1)
3. Resultado final imediato
```

**Modo com Fase 2**:
```
1. Alunos cadastram preferências
2. Organizador executa Fase 1 (POST /execute-phase1)
3. Alunos declaram afinidades
4. Organizador executa Fase 2 (POST /execute-phase2)
5. Resultado final
```

---

### 13. Considerações de Performance

**Escalabilidade**:
- Matriz de afinidades esparsa: O(A) espaço, onde A = afinidades declaradas (não O(N²))
- Fase 2 com 20000 iterações: ~2-5 segundos para 100 alunos
- Índices no banco: `(distribution_id, student_from_id)` para queries rápidas

**Otimizações**:
- Cache de isolation scores durante otimização
- Batch updates para social_cohesion_score
- Limitar declarações por aluno (ex: máximo 20 afinidades)

**Monitoring**:
- Log de tempo de execução de cada fase
- Métricas: número de swaps aceitos, taxa de aceitação, temperatura final
- Alertas se Fase 2 > 10 segundos (pode indicar muitas afinidades ou iterações altas)

---

### 14. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Alunos declaram poucas afinidades | Fase 2 detecta automaticamente: se < 10% declararam → skip Fase 2 |
| Afinidades criam conflitos éticos | UI enfatiza "preferências positivas"; valores negativos possíveis mas desencorajados |
| Fase 2 piora satisfação de tema | Energia combina preferências + social (w_pref + w_soc); ajustar pesos se necessário |
| Performance lenta com muitos alunos | Limitar iterações dinamicamente: iterations = min(20000, 200*numStudents) |
| Grupos mudam muito entre Fase 1 e 2 | Relatório mostra "estabilidade": % de alunos que permaneceram no mesmo grupo |

---

### 15. Extensões Futuras (Fora do Escopo)

- **Afinidades bidirecionais simétricas**: forçar A_ij = A_ji (apenas uma declaração necessária)
- **Recomendações automáticas**: sugerir afinidades baseado em curso/fase similares
- **Visualização de rede social**: grafo de afinidades entre alunos
- **Histórico de afinidades**: permitir ajustar afinidades após Fase 2 e re-executar
- **Formulação exata (ILP)**: garantir otimalidade global para instâncias pequenas

---

## Resumo Executivo

Este plano **refatora completamente** o sistema de distribuição para implementar o modelo matemático ideal de energia em 2 fases, substituindo o paradigma atual de score por funções de energia.

### Escopo da Refatoração

#### **Fase 1 - Refatoração do Algoritmo Existente** (BREAKING CHANGE)
- ✅ Substituir `PreferenceScorer` por `EnergyCalculator` (modelo de energia)
- ✅ Funções de energia: E_pref, E_fase com pesos configuráveis (w_pref, w_dup, w_div)
- ✅ Normalização de scores [0,1] (não mais 1000/rank)
- ✅ Máscara dura (E = ∞) em vez de penalidades
- ✅ Paradigma: minimizar energia (não maximizar score)
- ✅ Refatorar SolutionGenerator, LocalSearch, SimulatedAnnealing
- ✅ UI no dashboard para ajustar pesos

#### **Fase 2 - Nova Otimização Social** (FEATURE NOVA)
- ✅ Energia social: E_soc = -w_soc × Σ A_ij (afinidades no grupo)
- ✅ Classe `SocialOptimizer` (tradução de simulacao_fase_2.py)
- ✅ Swaps guiados por isolamento: S(i, g) = Σ A_ij
- ✅ Dois endpoints separados: `/execute-phase1`, `/execute-phase2`
- ✅ UI para declarar afinidades (slider -100 a +100)
- ✅ Métricas de coesão social por grupo

### Fluxo de Execução (Novo)

```
1. Alunos submetem preferências de tema
2. Organizador configura pesos (w_pref, w_dup, w_div)
3. Organizador executa FASE 1 → grupos formados (status: PHASE1_COMPLETED)
4. Alunos veem grupo e declaram afinidades (opcional)
5. Organizador configura Fase 2 (w_soc, iterations) e executa
6. Grupos são ajustados mantendo restrições (status: PHASE2_COMPLETED)
7. Resultado final com métricas sociais
```

### Principais Mudanças Técnicas

| Componente | Mudança | Tipo |
|------------|---------|------|
| **EnergyCalculator** | Nova classe (substitui PreferenceScorer) | 🔴 NOVA |
| **SolutionGenerator** | Refatorar para usar energia | 🔴 BREAKING |
| **LocalSearch** | Minimizar energia (não maximizar score) | 🔴 BREAKING |
| **SimulatedAnnealing** | ΔE com Metropolis (não ΔScore) | 🔴 BREAKING |
| **AffinityMatrix** | Nova classe (matriz esparsa) | 🔴 NOVA |
| **SocialOptimizer** | Nova classe (Fase 2) | 🔴 NOVA |
| **Database Schema** | w_pref, w_dup, w_div, w_soc, status, affinities | 🟡 ADITIVO |
| **API Endpoints** | Dois endpoints: /execute-phase1, /execute-phase2 | 🟡 ADITIVO |
| **Frontend** | Config pesos, AffinityInputPage, 2 botões | 🟡 ADITIVO |

### Características

- ⚠️ **BREAKING CHANGE**: Algoritmo usa energia (resultados diferentes do atual)
- ✅ Fase 2 é **OPCIONAL** (pode executar apenas Fase 1)
- ✅ Pesos configuráveis: organizador controla otimização
- ✅ Mantém todas as restrições duras (1-2 elétrica, 2+ fases)
- ✅ Interface intuitiva (sliders visuais)
- ✅ Performance escalável (matriz esparsa, O(A) não O(N²))
- ✅ Matematicamente rigoroso (fiel ao modelo ideal)

### Riscos e Mitigação

| Risco | Mitigação |
|-------|-----------|
| Resultados diferentes do sistema atual | Comparar em dados reais antes de deploy; oferecer modo "preview" |
| Usuários não entendem pesos | UI com tooltips explicativos + valores padrão testados |
| Performance degrada com muitos alunos | Profiling + limites dinâmicos (iterations = min(20000, 200×N)) |
| Breaking change afeta distribuições ativas | Migration: rodar novo algoritmo apenas em novas distribuições |

### Tempo Estimado

**6 semanas de desenvolvimento full-time**:
- Semana 1: EnergyCalculator + foundation
- Semana 2: Refatorar algoritmo Fase 1
- Semana 3: API e config Fase 1
- Semana 4: Fase 2 backend
- Semana 5: Fase 2 frontend
- Semana 6: Testing, tuning, documentation
