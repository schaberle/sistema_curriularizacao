# Status da Refatoração para Modelo de Energia Ideal

**Data**: Fevereiro 2026
**Objetivo**: Implementar o modelo de energia ideal em 2 fases conforme `ref_distribuição/SISTEMA_IDEAL_DISTRIBUICAO`

---

## ✅ CONCLUÍDO - Semana 1: Base Matemática

### 1.1 EnergyCalculator.ts (NOVO)
- **Status**: ✅ CRIADO
- **Arquivo**: `backend/src/services/optimization/EnergyCalculator.ts`
- **O que implementa**:
  - Função E_pref = -w_pref × Σ score_normalizado[0,1]
  - Função E_fase = w_dup × duplicatas - w_div × diversidade
  - Máscara dura: E = ∞ se grupo inviável (1-2 EE, 2+ fases)
  - Tabela de conversão ranking → score bruto [100, 70, 50, 35, 25, 18, 12, 8]
  - Normalização de scores [0, 1]
  - Método `findBestThemeForGroup()` (minimiza energia)
- **Testes**: ✅ Unit tests criados (test.ts)

### 1.2 Solution.ts (ATUALIZADO)
- **Status**: ✅ ATUALIZADO
- **Mudanças**:
  - Campo `totalEnergy: number` (Fase 1)
  - Campo `socialScore: number` (Fase 2)
  - Campo `socialOptimizationApplied: boolean`
  - Métodos `getTotalEnergy()`, `getSocialScore()`
  - `getSummary()` agora inclui energia e score social
  - `toJSON()` inclui novos campos

---

## ✅ CONCLUÍDO - Semana 2: Refatoração de Algoritmos

### 2.1 LocalSearch.ts (REFATORADO)
- **Status**: ✅ REFATORADO
- **Mudanças principais**:
  - ❌ Removido: `PreferenceScorer` (paradigma legado de score)
  - ✅ Adicionado: `EnergyCalculator` (paradigma de energia)
  - ✅ Mudança de paradigma:
    - **ANTES**: Aceita swap se `delta > 0` (maximiza score)
    - **DEPOIS**: Aceita swap se `delta < 0` (minimiza energia)
  - ✅ Máscara dura:
    - **ANTES**: Retorna penalidade -1000
    - **DEPOIS**: Retorna Infinity se grupo fica inviável
  - ✅ Método `optimize(solution, themes)` agora recebe temas necessários
  - ✅ Métodos `calculateSwapDelta()` e `performSwap()` refatorados
  - ✅ Código antigo/duplicado removido
  - ✅ Método `setWeights()` adicionado

### 2.2 SimulatedAnnealing.ts (REFATORADO)
- **Status**: ✅ REFATORADO
- **Mudanças principais**:
  - ❌ Removido: `PreferenceScorer`
  - ✅ Adicionado: `EnergyCalculator`
  - ✅ Critério de Metropolis CORRIGIDO:
    - **ANTES**: `if (delta > 0 || Math.random() < Math.exp(delta / T))`
    - **DEPOIS**: `if (delta < 0 || Math.random() < Math.exp(-delta / T))`
  - ✅ Parâmetros ajustados para energia:
    - `initialTemperature`: 0.8 (era 1000)
    - `coolingRate`: 0.9995 (era 0.95)
    - `maxIterations`: 20000 (era 1000)
  - ✅ Método `optimize(solution, themes)` agora recebe temas
  - ✅ Método `calculateSolutionEnergy()` adicionado
  - ✅ Método `setWeights()` adicionado

---

## ✅ CONCLUÍDO - Semana 3: Gerador e Motor de Distribuição

### 3.1 SolutionGenerator.ts (REFATORADO)
- **Status**: ✅ REFATORADO
- **Mudanças principais**:
  - ❌ Removido: `ConstraintValidator` (paradigma antigo)
  - ✅ Adicionado: `EnergyCalculator` (modelo de energia)
  - ✅ Constructor aceita pesos configuráveis: `{ wPref?, wDup?, wDiv? }`
  - ✅ Método `generateInitialSolution()` usa construção gulosa por energia
  - ✅ Usa `createTestGroup()` para avaliar colocações antes de confirmar
  - ✅ Cálculo de energia total na solução inicial
  - ✅ Métodos `setWeights()` e `getWeights()` adicionados
  - ✅ Alocação em duas fases: preferida (energia) + fallback (último recurso)
  - ✅ Testes unitários criados (SolutionGenerator.test.ts)

### 3.2 DistributionEngine.ts (REFATORADO)
- **Status**: ✅ REFATORADO
- **Mudanças principais**:
  - ❌ Removido: `PreferenceScorer`, `SocialScorer`, `SocialOptimizer`
  - ✅ Adicionado: `EnergyCalculator` principal
  - ✅ Constructor aceita pesos: `{ wPref?, wDup?, wDiv? }`
  - ✅ Novo método: `solvePhase1(students, themes)` executa 3 sub-fases:
    - 1.1 Geração inicial (SolutionGenerator com energia)
    - 1.2 Refinamento local (LocalSearch 2-opt)
    - 1.3 Otimização global (SimulatedAnnealing)
  - ✅ Método `solve()` agora alias para `solvePhase1()` (backward compatible)
  - ✅ Relatório `generatePhase1Report()` mostra energia (não score)
  - ✅ Passa `themes` aos otimizadores (necessário para recalcular energia)
  - ✅ Métodos `setWeights()` e `getWeights()` para configuração dinâmica
  - ✅ Método `validateScenario()` mantido para viabilidade pré-distribuição

---

## ✅ CONCLUÍDO - Semana 4: Fase 2 - Otimização Social

### 4.1 Fase 2 - Otimização Social (IMPLEMENTADO)
- ✅ Affinity.ts: Entidade com normalização -100 a +100 (UI) e -1.0 a +1.0 (algoritmo)
- ✅ AffinityMatrix.ts: Matriz esparsa O(A) com métodos de cálculo:
  - `calculateIsolationScore(studentId, groupStudentIds)`: S(i,g) = Σ A_ij
  - `calculateGroupCohesion(studentIds)`: soma de pares no grupo
  - Simetria garantida: A_ij == A_ji
- ✅ SocialOptimizer.ts: Algoritmo Fase 2 completo
  - Simulated Annealing com biased sampling
  - Energia total: E_base (Fase 1) + E_social = -w_soc × cohesion
  - Metropolis: aceita se ΔE < 0 ou exp(-ΔE/T)
  - Atualiza métricas sociais (socialCohesionScore) para cada grupo
- ✅ DistributionEngine.ts: Novo método `solvePhase2()`
- ✅ generatePhase2Report(): Relatório com coesão social por grupo
- ✅ Testes unitários criados:
  - Affinity.test.ts (15 testes)
  - AffinityMatrix.test.ts (20 testes)

## ⏳ PRÓXIMOS PASSOS - Semana 5

### 5.1 Database Migrations (PRÓXIMO)
- [ ] Adicionar colunas à tabela `distributions`:
  - `w_pref`, `w_dup`, `w_div` (configuração Fase 1)
  - `w_soc`, `status`, `social_optimization_enabled` (Fase 2)
- [ ] Criar tabela `student_affinities` para Fase 2
- [ ] Adicionar `social_cohesion_score` à tabela groups

### 5.2 API (PRÓXIMO)
- [ ] Endpoint `PUT /distributions/:id/energy-config` (configurar pesos Fase 1)
- [ ] Endpoint `POST /execute-phase1` (executar Fase 1, status → PHASE1_COMPLETED)
- [ ] Endpoint `POST /execute-phase2` (executar Fase 2, status → PHASE2_COMPLETED)
- [ ] Endpoints de afinidades:
  - `GET /students/:studentId/current-group` (grupo após Fase 1)
  - `PUT /students/:studentId/affinities` (submeter afinidades)
  - `GET /students/:studentId/affinities` (recuperar afinidades)

### 5.3 Frontend (PRÓXIMO)
- [ ] Página `AffinityInputPage.tsx` (sliders -100 a +100)
- [ ] Atualizar `OrganizerDashboard.tsx`:
  - Config pesos Fase 1
  - Config Fase 2 (w_soc, iterations)
  - Dois botões: "Executar Fase 1" / "Executar Fase 2"
  - Badge de status
- [ ] Atualizar `StudentResultPage.tsx`:
  - Exibir social_cohesion_score do grupo

---

## 📊 Paradigma Mudou!

| Aspecto | LEGADO | NOVO (IDEAL) |
|---------|--------|-------------|
| **Paradigma** | Maximizar Score | Minimizar Energia |
| **Scoring** | Score = 1000/rank | Score normalizado [0,1] |
| **Restrições** | Penalidades (-1000, -50) | Máscara dura (∞) |
| **Decisão Swap** | `delta > 0` | `delta < 0` |
| **SA Metropolis** | `exp(delta/T)` | `exp(-delta/T)` |
| **Temperatura SA** | 1000 → 1 (95% decay) | 0.8 → 1e-6 (99.95% decay) |

---

## 🔍 Próximas Ações

1. **Refatorar SolutionGenerator** para usar EnergyCalculator
2. **Atualizar DistributionEngine** para passar temas aos otimizadores
3. **Criar migrations** para adicionar colunas de pesos e status
4. **Implementar endpoints** de configuração (Fase 1) e afinidades (Fase 2)
5. **Criar AffinityMatrix** para Fase 2 social

---

## ⚠️ Breaking Changes

- ✅ Algoritmo produzirá resultados **diferentes** do legado (usa energia, não score)
- ✅ Pesos são **configuráveis** (controle fino do organizador)
- ✅ Fase 2 é **opcional** (pode executar apenas Fase 1 se desejar)

---

## 📁 Arquivos Modificados

```
✅ Semana 1-2: Base Matemática + Algoritmos
  ✅ backend/src/services/optimization/EnergyCalculator.ts (NOVO)
  ✅ backend/src/services/optimization/EnergyCalculator.test.ts (NOVO)
  ✅ backend/src/domain/Solution.ts (ATUALIZADO)
  ✅ backend/src/services/optimization/LocalSearch.ts (REFATORADO)
  ✅ backend/src/services/optimization/SimulatedAnnealing.ts (REFATORADO)

✅ Semana 3: Gerador e Motor
  ✅ backend/src/services/optimization/SolutionGenerator.ts (REFATORADO)
  ✅ backend/src/services/optimization/SolutionGenerator.test.ts (NOVO)
  ✅ backend/src/services/optimization/DistributionEngine.ts (REFATORADO)

✅ Semana 4: Fase 2 - Otimização Social
  ✅ backend/src/domain/Affinity.ts (NOVO)
  ✅ backend/src/domain/Affinity.test.ts (NOVO)
  ✅ backend/src/domain/AffinityMatrix.ts (NOVO)
  ✅ backend/src/domain/AffinityMatrix.test.ts (NOVO)
  ✅ backend/src/services/optimization/SocialOptimizer.ts (NOVO)
  ✅ backend/src/services/optimization/DistributionEngine.ts (ATUALIZADO - solvePhase2, generatePhase2Report)

⏳ Semana 5+: API + Frontend + Database
  ⏳ supabase/migrations/004_social_optimization.sql
  ⏳ Database methods (CRUD afinidades, status updates)
  ⏳ API endpoints (Fase 1 e Fase 2)
  ⏳ Frontend pages (AffinityInputPage, dashboard updates)
```
