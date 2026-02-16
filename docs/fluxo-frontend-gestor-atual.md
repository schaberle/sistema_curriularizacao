# Fluxo Atual do Frontend (Gestor)

Documento de handoff tecnico do fluxo atual do front-end para o gestor/organizador.
Escopo baseado no codigo atual do repositorio.

## 1. Stack e arquitetura

- Frontend: React + TypeScript + React Router.
- Estilo: Tailwind + tokens CSS globais em `frontend/src/index.css`.
- Estado global do wizard: `DistributionContext`.
- API:
  - `default export api` (legado)
  - `named exports` tipados/normalizados para o wizard em `frontend/src/services/api.ts`.

Arquivos centrais:
- `frontend/src/App.tsx`
- `frontend/src/context/DistributionContext.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/types/distribution.types.ts`

## 2. Entrada do gestor

Fluxo de entrada:
1. Usuario acessa `/login` (`frontend/src/pages/LoginPage.tsx`).
2. Em sucesso de autenticacao, navega para `/organizer`.
3. `/organizer` renderiza `OrganizerLayout` + `OrganizerListPage`.

Lista de distribuicoes (`OrganizerListPage` + `DistributionList`):
- `fetchDistributions()` ao montar.
- `Nova distribuicao` chama `actions.createDistribution()` e navega para `step1-themes`.
- Abertura por status:
  - `PHASE2_COMPLETED` -> `step9-final-results`
  - `COMPLETED` ou `PARTIAL` -> `step5-phase1-results`
  - `PHASE2` ou `PHASE2_EXECUTING` -> `step6-affinities`
  - demais -> `step1-themes` (select) ou `step2-data` (manage)

## 3. Rotas do organizador (atual)

Definidas em `frontend/src/App.tsx`.

### 3.1 Fluxo principal (wizard)

- `/organizer/:distributionId/step1-themes`
- `/organizer/:distributionId/step2-data`
- `/organizer/:distributionId/step3-phase1-config`
- `/organizer/:distributionId/step4-phase1-execute`
- `/organizer/:distributionId/step5-phase1-results`
- `/organizer/:distributionId/step6-affinities`
- `/organizer/:distributionId/step7-phase2-config`
- `/organizer/:distributionId/step8-phase2-execute`
- `/organizer/:distributionId/step9-final-results`

Todas passam por `WizardGuard` (carrega distribuicao e barra acesso com ID invalido).

### 3.2 Compatibilidade legada

Gateway `LegacyOrganizerRedirect`:
- `/organizer/:id/themes` -> `step1-themes`
- `/organizer/:id/execute` -> `step2-data`
- `/organizer/:id/results` -> `step5-phase1-results`
- `/organizer/:id/phase2` -> `step6-affinities`
- `/organizer/:id/final-results` -> `step9-final-results`
- desconhecido -> `step1-themes`

Alias adicionais no router:
- `:distributionId/phase2` -> `../step6-affinities`
- `:distributionId/final-results` -> `../step9-final-results`

Rota legada ainda existente (nao principal):
- `/organizer/:distributionId/legacy-phase2` -> `LegacyPhase2Page`

## 4. Wizard Step 1-9 (comportamento atual)

## Step 1 - Temas
Pagina: `Step1_ThemeConfigPage`
View: `ThemeConfigView`

- Trabalha com `draftThemes`.
- Validacoes:
  - nome obrigatorio
  - nao permite duplicidade por nome (case-insensitive)
- Remove apenas tema temporario (`temp-*`).
- Persistencia ocorre no `Next`:
  - envia apenas temas nao persistidos.
  - `saveThemes()` atualiza estado com temas persistidos (IDs reais).
- Navegacao:
  - anterior: lista (`/organizer`)
  - proximo: `step2-data`

## Step 2 - Coleta de dados
Pagina: `Step2_DataCollectionPage`
View: `DataCollectionView`

- Polling de estatisticas via `usePolling` (10s, com chamada imediata).
- Link publico do aluno: `/student/form/:distributionId`.
- Layout da view:
  - coluna principal: link + progresso estatistico.
  - coluna secundaria: seed de dados (colapsado por padrao).
- Seed usa `SeedConfig` completo:
  - `studentCount`
  - `generatePreferences: true`
  - `generateAffinities: false`
  - `affinityDensity: 0.13`
- Bloqueio para proximo passo:
  - exige `totalStudents > 0`.
- Navegacao:
  - anterior: step1
  - proximo: step3

## Step 3 - Configuracao Fase 1
Pagina: `Step3_Phase1ConfigPage`
View: `Phase1ConfigView`

- Configura pesos:
  - `wPref`, `wDup`, `wDiv`
- Checklist de validacao (critico/recomendado):
  - minimo de alunos (critico)
  - taxa de preferencias
  - diversidade de fases
  - disponibilidade de EE
- Bloqueio de avancar:
  - apenas se check critico falhar.
- Navegacao:
  - anterior: step2
  - proximo: step4

## Step 4 - Execucao Fase 1
Pagina: `Step4_Phase1ExecutionPage`
View: `Phase1ExecutionView`

- Execucao manual com confirmacao `window.confirm`.
- Chama `actions.executePhase1(distributionId, phase1Config)`.
- Progresso visual simulado enquanto aguarda retorno.
- Em sucesso:
  - atualiza `phase1Report`
  - `executePhase1` no contexto busca grupos apos execucao.
- Navegacao:
  - anterior: step3
  - proximo CTA: step5

## Step 5 - Resultados Fase 1
Pagina: `Step5_Phase1ResultsPage`
View: `Phase1ResultsView`

- Carrega distribuicao se necessario.
- Busca grupos se `groups` estiver nulo.
- Mostra resumo da execucao (quando `phase1Report` existe) + lista de grupos.
- Tratamento explicito de erro em `fetchGroups` com `ErrorAlert`.
- CTAs:
  - voltar (step4)
  - reexecutar fase 1 (step4)
  - ir para fase 2 (step6)
  - voltar para lista

## Step 6 - Coleta de afinidades
Pagina: `Step6_AffinitiesCollectionPage`
View: `Phase2AffinitiesView`

- Polling de estatisticas (10s).
- KPIs: total, com afinidades, taxa.
- Seed de afinidades colapsado por padrao.
- Gera afinidades via `generateAffinities(distributionId, density)`.
- Navegacao:
  - anterior: step5
  - proximo: step7

## Step 7 - Configuracao Fase 2
Pagina: `Step7_Phase2ConfigPage`
View: `Phase2ConfigView`

- Configura:
  - `enabled`
  - `wSoc`
  - `maxIterations`
  - `temperature`
- Persistencia best-effort:
  - chama `configurePhase2`
  - em falha, exibe aviso e segue com config local.
- Bloqueio de execucao:
  - exige `enabled`
  - exige afinidades (`affinityCount > 0`)
  - exige alunos (`totalStudents > 0`)
- Navegacao:
  - anterior: step6
  - proximo: step8

## Step 8 - Execucao Fase 2
Pagina: `Step8_Phase2ExecutionPage`
View: `Phase2ExecutionView`

- Pre-condicoes:
  - Fase 2 habilitada
  - pelo menos 1 afinidade coletada
- Chama `actions.executePhase2(distributionId, phase2Config)`.
- Progresso visual simulado.
- Em sucesso:
  - atualiza `phase2Report`
  - contexto busca grupos e metricas sociais apos execucao.
- Navegacao:
  - anterior: step7
  - proximo CTA: step9

## Step 9 - Resultados finais
Pagina: `Step9_FinalResultsPage`
View: `FinalResultsView`

- Carrega distribuicao se necessario.
- Busca grupos e metricas sociais quando ausentes.
- Exibe:
  - resumo consolidado fase1/fase2
  - grupos finais
  - metricas sociais (quando disponiveis)
- CTAs:
  - voltar para resultados fase1 (step5)
  - reexecutar fase2 (step8)
  - voltar lista

## 5. Estado global (`DistributionContext`)

Arquivo: `frontend/src/context/DistributionContext.tsx`

State principal:
- `distributions`
- `currentDistribution`
- `themes`
- `statistics`
- `groups`
- `socialMetrics`
- `phase1Report`
- `phase2Report`
- `phase1Config`
- `phase2Config`
- `loading[...]`
- `errors[...]`

Actions expostas:
- Distribuicao:
  - `fetchDistributions`
  - `createDistribution`
  - `loadDistribution`
- Temas:
  - `saveThemes`
- Dados/estatisticas:
  - `fetchStatistics`
  - `startStatisticsPolling`
  - `stopStatisticsPolling`
  - `fetchGroups`
  - `fetchSocialMetrics`
- Fase 1:
  - `setPhase1Config`
  - `executePhase1`
- Fase 2:
  - `setPhase2Enabled`
  - `setPhase2Config`
  - `configurePhase2`
  - `executePhase2`
- Seed:
  - `generateSeed`
  - `generateAffinities`
- Erros:
  - `clearError`
  - `clearAllErrors`

Comportamentos importantes:
- `createDistribution()` cria estado provisiorio local e tenta sincronizar com backend.
- `executePhase1()` e `executePhase2()` fazem refresh de grupos apos execucao.
- `executePhase2()` tambem tenta buscar metricas sociais apos execucao.

## 6. Contratos de API no frontend

Arquivo: `frontend/src/services/api.ts`

## 6.1 Superficies disponiveis

- `default export api`:
  - usado por codigo legado e fluxo do aluno.
- `named exports`:
  - usados pelo wizard com normalizacao de contrato.

Named exports do wizard:
- `listDistributions`
- `createDistribution`
- `getDistribution`
- `uploadThemes`
- `getDistributionStatistics`
- `executePhase1`
- `getDistributionGroups`
- `executePhase2`
- `configureSocialOptimization`
- `getSocialMetrics`
- `seedDistribution`
- `seedAffinities`

## 6.2 Normalizacoes relevantes

- `courseBreakdown`:
  - array backend -> objeto `{ electrical, mechanical }`.
- `phaseBreakdown`:
  - array backend -> `Record<number, number>`.
- `ExecutionReport`:
  - padroniza `executionTimeMs`, `feasible`, `groupsCreated`, `message`, etc.
- `uploadThemes`:
  - apos POST, faz GET de temas e retorna temas persistidos com IDs reais.
- `getDistribution`:
  - nao cria fallback sintetico.
  - procura distribuicao em `listDistributions`; se nao achar, lanca erro.

## 7. Integracao com fluxo do aluno (impacta gestor)

Rotas publicas usadas indiretamente pelo gestor:
- `/student/form/:distributionId`
- `/student/:studentId/preferences/:distributionId`
- `/student/:studentId/affinities/:distributionId`
- `/student/result/:distributionId`

Pontos de integracao:
- Step2 fornece link para iniciar esse fluxo.
- Estatisticas do wizard refletem progresso de preferencias e afinidades.
- `StudentResultPage` tem CTA para afinidades:
  - `/student/:studentId/affinities/:distributionId`

## 8. UX/base visual global

Arquivos:
- `frontend/src/index.css`
- `frontend/src/components/common/Button.tsx`
- `frontend/src/components/common/Card.tsx`
- `frontend/src/components/common/ErrorAlert.tsx`
- `frontend/src/components/common/LoadingSpinner.tsx`

Resumo:
- fonte UI global: Plus Jakarta Sans
- fonte mono: IBM Plex Mono
- tokens CSS globais de brand/radius/sombra
- componentes comuns padronizados com tokens
- animacao leve `animate-fade-in`

## 9. Legacy ainda no repositorio

- `frontend/src/pages/OrganizerDashboard.tsx` permanece no codigo, mas nao esta montada nas rotas do `App.tsx`.
- Componentes legados (`ExecutionDashboard`, `ThemeConfiguration`, `ResultsView`, etc.) ainda existem para compatibilidade/historico.

## 10. Problemas reportados recentemente (runtime)

Relatos do usuario no ambiente de desenvolvimento:
1. Erro anterior:
   - `Cannot access 'fetchGroups' before initialization` em `DistributionContext`.
2. Botao de criar distribuicao piscando entre estado normal e `Criando...` sem clique.
3. Pagina em branco ao abrir rota de step (`/organizer/:id/step1-themes`).

Estado atual de validacao tecnica (local):
- `npm run lint` (frontend): OK
- `npm run build` (frontend): OK
- aviso de bundle grande no build (chunk > 500kb), sem bloquear.

Observacao:
- Como lint/build passam, os problemas acima parecem ligados a runtime/dev state, regressao de estado em execucao, ou efeito colateral de renderizacao/navegacao.

## 11. Sequencia resumida (gestor)

1. Login (`/login`) -> `/organizer`
2. Criar/abrir distribuicao
3. Step1: cadastrar temas
4. Step2: coletar alunos (ou seed)
5. Step3: validar/configurar fase1
6. Step4: executar fase1
7. Step5: revisar grupos fase1
8. Step6: coletar afinidades (ou seed)
9. Step7: configurar fase2
10. Step8: executar fase2
11. Step9: revisar resultado final consolidado

---

Se outra IA continuar o trabalho, os primeiros pontos para auditoria de estabilidade sao:
- `DistributionContext` (ordem/estabilidade de actions e efeitos de estado),
- `OrganizerListPage` (efeitos que possam disparar create/fetch indevidamente),
- componentes do guard/layout para white screen sem erro visual.
