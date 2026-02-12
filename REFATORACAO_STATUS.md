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

---

## ⏳ PRÓXIMOS PASSOS - Semana 3+

### 3.1 SolutionGenerator.ts (FALTA REFATORAR)
- [ ] Substituir `PreferenceScorer` por `EnergyCalculator`
- [ ] Usar `findBestThemeForGroup()` para atribuição de temas
- [ ] Construção gulosa baseada em minimizar energia
- [ ] Método `generateInitialSolution(students, themes)` atualizado

### 3.2 DistributionEngine.ts (FALTA ATUALIZAR)
- [ ] Instanciar `EnergyCalculator` com pesos configuráveis
- [ ] Passar `themes` aos métodos de LocalSearch e SA
- [ ] Novos métodos: `solvePhase1()` e `solvePhase2()`
- [ ] Atualizar assinatura de `solve()`

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
✅ backend/src/services/optimization/EnergyCalculator.ts (NOVO)
✅ backend/src/services/optimization/EnergyCalculator.test.ts (NOVO)
✅ backend/src/domain/Solution.ts (ATUALIZADO)
✅ backend/src/services/optimization/LocalSearch.ts (REFATORADO)
✅ backend/src/services/optimization/SimulatedAnnealing.ts (REFATORADO)

⏳ backend/src/services/optimization/SolutionGenerator.ts (FALTA)
⏳ backend/src/services/optimization/DistributionEngine.ts (FALTA)
⏳ backend/src/domain/Affinity.ts (FALTA)
⏳ backend/src/domain/AffinityMatrix.ts (FALTA)
⏳ backend/src/services/optimization/SocialOptimizer.ts (FALTA COMPLETAR)
```
