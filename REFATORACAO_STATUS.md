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

## ⏳ PRÓXIMOS PASSOS - Semana 4+

### 4.1 Database Migrations (FALTA IMPLEMENTAR)
- [ ] Adicionar colunas à tabela `distributions`:
  - `w_pref` (peso de preferências, default 1.0)
  - `w_dup` (peso de duplicatas, default 0.9)
  - `w_div` (peso de diversidade, default 0.35)
  - `status` (PENDING, READY, PHASE1_COMPLETED, PHASE2_COMPLETED)
- [ ] Criar tabela `student_affinities` para Fase 2

### 4.2 Fase 2 - Otimização Social (FALTA IMPLEMENTAR)
- [ ] Implementar `Affinity.ts` e `AffinityMatrix.ts`
- [ ] Implementar `SocialOptimizer.ts` completo
- [ ] Endpoints para declaração de afinidades
- [ ] Endpoints para execução de Fase 2

### 3.3 Banco de Dados (FALTA IMPLEMENTAR)
- [ ] Migração: adicionar w_pref, w_dup, w_div, status à tabela distributions
- [ ] Nova tabela: student_affinities (para Fase 2)
- [ ] Adicionar campo social_cohesion_score à tabela groups

### 3.4 API (FALTA IMPLEMENTAR)
- [ ] Endpoint `PUT /distributions/:id/energy-config` (configurar pesos)
- [ ] Endpoint `POST /execute-phase1` (executar Fase 1)
- [ ] Endpoint `POST /execute-phase2` (executar Fase 2 - Fase 2)
- [ ] Endpoints de afinidades (Fase 2)

### 3.5 Frontend (FALTA IMPLEMENTAR)
- [ ] UI para configurar pesos Fase 1
- [ ] Página AffinityInputPage (slider -100 a +100)
- [ ] Dois botões: "Executar Fase 1" / "Executar Fase 2"
- [ ] Exibir social_cohesion_score

### 4.0 Fase 2 Social (FALTA IMPLEMENTAR)
- [ ] Affinity.ts (entidade)
- [ ] AffinityMatrix.ts (matriz esparsa)
- [ ] SocialOptimizer.ts (otimização com afinidades)
- [ ] Endpoints de afinidades

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

⏳ Semana 4+: Fase 2 Social
  ⏳ backend/src/domain/Affinity.ts (FALTA)
  ⏳ backend/src/domain/AffinityMatrix.ts (FALTA)
  ⏳ backend/src/services/optimization/SocialOptimizer.ts (FALTA COMPLETAR)
  ⏳ supabase/migrations/003_social_optimization.sql (FALTA)
```
