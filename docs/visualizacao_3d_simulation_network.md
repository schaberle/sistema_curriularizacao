# Visualizacao 3D da Simulacao (SimulationNetwork3D)

## Objetivo

A visualizacao 3D e uma camada de leitura do estado da simulacao.
Ela existe para inspecao visual e nao participa de decisoes de otimizacao.

## Escopo e isolamento

- Nao calcula energia.
- Nao executa swap.
- Nao executa simulated annealing.
- Nao altera particao/grupos.
- Nao escreve nada no backend.
- Nao usa posicao 3D para regras da simulacao.

Resumo: a simulacao calcula; a visualizacao apenas consome estado e desenha.

## Fontes de dados (read-only)

A tela usa o read-model `simulation/visual-state` + snapshots SSE da execucao:

- `students`: id, curso, fase, utilidades normalizadas por tema.
- `partition`: grupos atuais e atribuicao por aluno.
- `groupThemes`: tema atual de cada grupo.
- `affinities`: pares declarados com valor em `[-1, 1]`.
- `isolationScoreByStudentId` (quando disponivel).

No modo ao vivo, o snapshot SSE atualiza apenas atribuicao aluno->grupo.
Quando a execucao termina, a pagina recarrega o `visual-state` completo.

## Arquitetura de componentes

- `SimulationLabPage`
  - Carrega estado visual inicial e controles de UI.
  - Consome SSE e atualiza particao em memoria.
- `SimulationNetwork3D`
  - Renderiza canvas 3D, nos, arestas, hulls e tooltip.
- `useForceLayout3D`
  - Calcula somente o layout visual force-directed 3D.

Arquivos principais:

- `frontend/src/components/organizer/simulation3d/SimulationNetwork3D.tsx`
- `frontend/src/components/organizer/simulation3d/useForceLayout3D.ts`

## Pipeline do layout 3D (visual)

### 1) Inicializacao de nos

Cada aluno vira um no com:

- `id`
- `groupId` (da particao atual)
- `themeId` (via tema do grupo)
- `x,y,z` iniciais deterministicas por hash do `studentId`

### 2) Forcas aplicadas

No hook `useForceLayout3D`:

1. Repulsao universal (many-body)
- `strength = -90 * intensity`

2. Atracao por grupo (links entre membros do mesmo grupo)
- `strength = 0.18 * intensity`
- `distance = 1.1`

3. Afinidade positiva declarada (`A_ij > 0`)
- link atrativo
- `strength = max(0.02, 0.15 * A_ij * intensity)`
- `distance = max(0.55, 1.9 - 1.2 * A_ij)`

4. Afinidade negativa declarada (`A_ij < 0`)
- forca custom repulsiva com lei inversa ao quadrado da distancia
- `F ~ (0.7 * intensity * |A_ij|) / d^2`

5. Atracao fraca por tema
- entre alunos de grupos diferentes com mesmo tema
- `strength = 0.04 * intensity`
- `distance = 2.2`

6. Damping
- por tick: `vx, vy, vz *= 0.95`

7. Colisao minima (anti-clipping visual)
- `forceCollide` com:
  - `radius = 0.22`
  - `strength = 0.9`
  - `iterations = 1` (running) / `2` (idle)

### 3) Compactacao e centralizacao visual

Apos cada tick:

- calcula centroide da nuvem;
- recentra todos os pontos no centroide;
- aplica escala para manter raio visual alvo e distancia minima entre nos.

Parametros:

- `TARGET_LAYOUT_RADIUS = 3.1`
- `MIN_RENDER_NODE_DISTANCE = 0.42`
- `MAX_VISUAL_SCALE = 2.2`

Isto melhora inspeção visual sem alterar nenhuma metrica de simulacao.

## Mapeamento visual dos nos

Para cada aluno:

- Cor base: hash estavel por `groupId`.
- Curso:
  - `ELECTRICAL`: anel externo (wireframe).
  - `MECHANICAL`: sem anel.
- Tamanho por satisfacao (rank do tema do grupo):
  - rank melhor -> esfera maior.
  - fallback neutro quando rank nao disponivel.
- Isolamento (`S(i,g)`), quando disponivel:
  - baixo/negativo -> tende ao vermelho e menor opacidade.
  - alto -> tende ao verde e maior opacidade.

## Elementos opcionais

- Arestas de afinidade (toggle):
  - verde para positiva
  - vermelho para negativa
  - espessura proporcional a `|A_ij|`
- Envelope por grupo (toggle):
  - `ConvexGeometry` translucida
  - fallback para esfera wireframe quando hull invalido

## Interacao

- OrbitControls: rotacao, zoom e pan.
- Hover em aluno: tooltip com
  - id
  - curso
  - fase
  - grupo
  - tema
  - rank
  - `S(i,g)`

Campos indisponiveis em tempo real exibem `n/d (tempo real)`.

## Cena limpa

A cena foi simplificada para foco nos clusters:

- sem `gridHelper`
- sem `axesHelper`

## Ajustes de UX disponiveis

Controles na tela:

- toggle de arestas
- toggle de envelopes
- slider de intensidade de forcas (`0.2` a `3.0`)

O slider afeta apenas o layout visual local, nunca a simulacao.

## Consideracoes de performance

- Atualizacao de posicoes por tick em memoria (`positionsRef`).
- Re-render sincronizado via `requestAnimationFrame`.
- Materiais simples (sphere + wireframe opcional).
- Hulls e arestas sao opcionais para reduzir custo de render.

## Garantia de nao interferencia na otimizacao

As coordenadas 3D existem apenas no frontend e nao retornam ao backend.
Nao ha dependencia cruzada da otimizacao com `x,y,z` da visualizacao.
