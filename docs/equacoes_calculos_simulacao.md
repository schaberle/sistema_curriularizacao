# Equacoes matematicas e logicas dos calculos de simulacao

## 1) Energia base por grupo (Fase 1)

Para um grupo `g` com tema `t`:

`E_grupo(g, t) = +infinito`, se o grupo for inviavel  
`E_grupo(g, t) = E_pref(g, t) + E_fase(g)`, se o grupo for viavel

### 1.1 Preferencia

`E_pref(g, t) = -w_pref * sum_{i em g} score_norm(i, t)`

O sinal negativo faz preferencias maiores reduzirem a energia (melhor).

### 1.2 Conversao rank -> score bruto

Tabela principal por posicao `r`:

- `r=1..8` -> `[100, 70, 50, 35, 25, 18, 12, 8]`
- `r>8` -> `score_raw(r) = max(0, 8 - (r - 8))`

### 1.3 Normalizacao do score

Para cada aluno:

`score_norm = (score_raw - min_raw) / (max_raw - min_raw)`

Se `max_raw == min_raw`, usa `score_norm = 0.5`.

### 1.4 Energia de fase

`E_fase(g) = w_dup * duplicatas(g) - w_div * diversidade(g)`

Onde:

- `duplicatas(g) = sum_f max(0, n_f - 1)`  
  (`n_f` = quantidade de alunos da fase `f` no grupo)
- `diversidade(g) = numero de fases distintas no grupo`

## 2) Restricoes logicas (mascara dura)

Um grupo e viavel se todas as condicoes forem verdadeiras:

- Tamanho: `groupSize-1 <= |g| <= groupSize+1`
- Eng. Eletrica:
  - `EE(g) >= minEE`
  - `EE(g) <= maxEE_ajustado`
  - `maxEE_ajustado = maxEE`, se `|g| >= groupSize`
  - `maxEE_ajustado = min(maxEE, |g|-1)`, se `|g| < groupSize`
- Diversidade minima: `fases_distintas(g) >= minPhaseDiversity`

Se qualquer condicao falhar, energia do grupo vira `+infinito`.

## 3) Energia da solucao e objetivo global

`E_base(solucao) = sum_{g} E_grupo(g, tema_g)`

Se algum grupo for inviavel ou sem tema valido: `E_base = +infinito`.

Quando ha componente social:

`coesao(g) = sum_{i<j, i,j em g} A_ij`

`E_soc(g) = -w_soc * coesao(g)`

`E_total_fase2 = sum_g (E_grupo(g, tema_g) + E_soc(g))`

Quando runtime vetorial esta ativo:

`E_obj = E_base + E_soc_global + lambda_vec * C`

Onde `C` e a compactacao total dos grupos:

`C = sum_g C_g`

`C_g = (1/|g|) * sum_{i em g} ||v_i - c_g||^2`

`c_g = (1/|g|) * sum_{i em g} v_i` (centroide do grupo).

## 4) Busca local (LocalSearch)

Para uma troca candidata entre dois alunos:

`Delta = E_depois - E_antes`

Com runtime vetorial:

`Delta_obj = Delta + lambda_vec * Delta_C`

A troca so e aplicada quando `Delta_obj < 0`.

## 5) Simulated Annealing (Fase 1 global)

Para vizinho com energia `E'`:

`Delta = E' - E_atual`

Regra de aceitacao:

- aceita sempre se `Delta < 0`
- se `Delta >= 0`, aceita com probabilidade:
  `P = exp(-Delta / T)`

Atualizacao de temperatura:

`T_{k+1} = T_k * coolingRate`

Loop para quando atingir `maxIterations` ou `T <= 1e-6`.

## 6) Otimizacao social (Fase 2)

Energia alvo:

`E = sum_g (E_grupo + E_soc) [+ lambda_vec * C, se runtime ativo]`

Aceitacao no SA social:

- aceita se `Delta < 0`
- senao aceita com `P = exp(-Delta / max(T, 0.001))`

Agenda de temperatura (linear):

`T(iter) = T0 * (1 - iter/maxIterations)`

### 6.1 Isolamento e selecao guiada

Isolamento de aluno `i` no grupo `g`:

`S(i,g) = sum_{j em g, j!=i} A_ij`

Peso de amostragem:

`w_i = exp(-S(i,g))`

Uso pratico: amostragem por rejeicao com normalizacao por `max(w_i)`.

## 7) Capacidade de temas (modo ideal)

Checagem global antes da execucao:

`grupos_necessarios = ceil(total_alunos / 4)`

`cap_total = sum_t max(0, maxGroups_t)`

Precisa valer: `cap_total >= grupos_necessarios`.

Checagem final:

Para cada tema `t`: `uso_t <= capacidade_t`.

Durante busca por melhor tema com capacidade ativa:

- se `uso_t >= capacidade_t`, o tema `t` e descartado.

## 8) Adaptacao automatica de restricoes

Com `totalGroups = ceil(totalAlunos / groupSize)`:

- Se `EE_total < totalGroups`, relaxa para `minEE = 0`
- Se `fases_unicas < 2`, relaxa para `minPhaseDiversity = 1`

Isso altera as regras de viabilidade usadas nos calculos de energia.

## 9) Metricas derivadas na simulacao

As metricas tambem usam formulas:

- `top1(%) = 100 * (alunos com rank 1 / total_alunos)`
- `top2(%) = 100 * (alunos com rank <= 2 / total_alunos)`
- `top3(%) = 100 * (alunos com rank <= 3 / total_alunos)`
- `avgRank = sum(rank_aluno_no_tema_do_grupo) / total_alunos`
- `stability(%) = 100 * (alunos que permaneceram no mesmo grupo / total_alunos)`

## 10) Arquivos de referencia no codigo

- `backend/src/services/optimization/EnergyCalculator.ts`
- `backend/src/services/optimization/LocalSearch.ts`
- `backend/src/services/optimization/SimulatedAnnealing.ts`
- `backend/src/services/optimization/SocialOptimizer.ts`
- `backend/src/services/optimization/DistributionEngine.ts`
- `backend/src/services/optimization/SystemViabilityAnalyzer.ts`
- `backend/src/services/optimization/AdaptiveConstraintManager.ts`
- `backend/src/services/optimization/VectorState.ts`
- `backend/src/domain/AffinityMatrix.ts`
- `backend/src/services/optimization/SimulationIdealMetricsService.ts`
