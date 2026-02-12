# 🚀 Como Usar o Sistema de Distribuição de Grupos

## 📖 Documentação Rápida

### Para Entender o Projeto
1. **Primeiro**: Leia `SUMARIO_EXECUTIVO.txt` (visão geral rápida)
2. **Depois**: Leia `README.md` (documentação principal)
3. **Detalhes**: Leia `RESUMO_ALGORITMO.md` (algoritmo em detalhes)
4. **Contexto**: Leia `STATUS.md` (status atual e próximos passos)
5. **Arquitetura**: Leia `PLANO.md` (design completo)

### Estrutura de Arquivos
```
sistema_curricular/
├── SUMARIO_EXECUTIVO.txt      ← LEIA PRIMEIRO (overview visual)
├── README.md                  ← Documentação principal
├── RESUMO_ALGORITMO.md        ← Algoritmo em detalhes
├── STATUS.md                  ← Status do projeto
├── PLANO.md                   ← Design arquitetural
├── COMO_USAR.md              ← Este arquivo
└── backend/src/
    ├── domain/                ← Modelos (Student, Group, etc)
    └── services/optimization/ ← Algoritmo de otimização
```

---

## 💻 Como Usar o Algoritmo de Otimização

### 1. Importação Básica

```typescript
import { DistributionEngine } from './services/optimization';
import { Student, Theme } from './domain';
```

### 2. Criar Engine

```typescript
const engine = new DistributionEngine();
```

### 3. Preparar Dados

```typescript
// Criar estudantes
const students = [
  new Student('s1', 'João Silva', 'EE', 3, 'dist1'),
  new Student('s2', 'Maria Santos', 'ME', 5, 'dist1'),
  new Student('s3', 'Pedro Costa', 'EE', 7, 'dist1'),
  new Student('s4', 'Ana Oliveira', 'ME', 2, 'dist1'),
  // ... mais alunos
];

// Adicionar preferências para cada aluno
students[0].addPreference('tema_a', 1);  // 1ª preferência
students[0].addPreference('tema_b', 2);  // 2ª preferência

// Criar temas
const themes = [
  new Theme('tema_a', 'Tema A', 'Descrição', 2),  // max 2 grupos
  new Theme('tema_b', 'Tema B', 'Descrição', 2),  // max 2 grupos
];
```

### 4. Validar Cenário (Opcional)

```typescript
const validation = engine.validateScenario(students, themes);
if (!validation.isFeasible) {
  console.error('Cenário infeasível:', validation.issues);
  // Ajustar número de alunos/temas
}
```

### 5. Executar Distribuição

```typescript
const result = await engine.solve(students, themes);

console.log(result.report);        // Relatório detalhado
console.log(result.solution.groups); // Grupos formados
console.log(result.executionTime);  // Tempo em ms
```

### 6. Acessar Resultados

```typescript
// Acessar um grupo específico
const group = result.solution.groups[0];
console.log('Tema:', group.themeId);
console.log('Alunos:', group.students.length);
console.log('Composição:', group.getComposition());
  // { electricalCount: 2, mechanicalCount: 2, phases: Set(...) }

// Acessar scores
const breakdown = new PreferenceScorer().getScoreBreakdown(result.solution);
console.log('Score total:', breakdown.totalScore);
console.log('Média por aluno:', breakdown.averagePerStudent);

// Acessar violações
const validator = new ConstraintValidator();
const report = validator.getValidationReport(result.solution.groups);
console.log('Viável?', report.isFeasible);
console.log('Violações críticas:', report.summary.CRITICAL);
console.log('Violações desejáveis:', report.summary.DESIRABLE);
```

---

## 🎯 Exemplos de Uso

### Exemplo 1: Pequeno (4 alunos)

```typescript
const engine = new DistributionEngine();

const students = [
  new Student('s1', 'João', 'EE', 1, 'd1'),
  new Student('s2', 'Maria', 'ME', 2, 'd1'),
  new Student('s3', 'Pedro', 'EE', 3, 'd1'),
  new Student('s4', 'Ana', 'ME', 4, 'd1'),
];

students.forEach(s => {
  s.addPreference('tema_a', 1);
});

const themes = [new Theme('tema_a', 'Tema A', 'Desc', 1)];

const result = await engine.solve(students, themes);
// Resultado: 1 grupo com 4 alunos (2 EE, 2 ME, 4 fases)
// Score: 1000 (perfeito!)
```

### Exemplo 2: Médio (20 alunos)

```typescript
// Criar 20 alunos com mix de EE/ME e fases 1-5
const students = [];
for (let i = 0; i < 20; i++) {
  const course = i < 10 ? 'EE' : 'ME';
  const phase = (i % 5) + 1;
  students.push(
    new Student(`s${i}`, `Aluno${i}`, course, phase, 'd1')
  );
}

// Adicionar preferências aleatórias
students.forEach((s, i) => {
  s.addPreference('tema_a', i % 3 === 0 ? 1 : 2);
  s.addPreference('tema_b', i % 3 === 1 ? 1 : 2);
  s.addPreference('tema_c', i % 3 === 2 ? 1 : 2);
});

const themes = [
  new Theme('tema_a', 'Tema A', 'Descrição A', 2),
  new Theme('tema_b', 'Tema B', 'Descrição B', 2),
  new Theme('tema_c', 'Tema C', 'Descrição C', 2),
];

const result = await engine.solve(students, themes);
// Fase 1: Score ~7200, Tempo ~80ms
// Fase 2: Score ~7500 (+300), Tempo ~450ms
// Fase 3: Score ~7850 (+350), Tempo ~1200ms
// Total: ~1730ms
```

### Exemplo 3: Grande (100 alunos)

```typescript
// Criar 100 alunos
const students = [];
for (let i = 0; i < 100; i++) {
  students.push(
    new Student(
      `s${i}`,
      `Aluno ${i}`,
      i % 2 === 0 ? 'EE' : 'ME',
      (i % 10) + 1,  // Fases 1-10
      'd1'
    )
  );
}

// Adicionar preferências
students.forEach((s, i) => {
  for (let t = 0; t < 5; t++) {
    s.addPreference(`tema_${t}`, (i + t) % 5 + 1);
  }
});

// Criar 5 temas
const themes = Array.from({ length: 5 }, (_, i) =>
  new Theme(`tema_${i}`, `Tema ${i}`, `Descrição ${i}`, 5)
);

const result = await engine.solve(students, themes);
// Tempo esperado: ~1.1s (todas as 3 fases)
// Score esperado: 42000-45000
```

---

## ⚙️ Configuração de Parâmetros

### LocalSearch

```typescript
import { LocalSearch } from './services/optimization';

const localSearch = new LocalSearch();
// maxIterationsWithoutImprovement = 100 (padrão)
// Mudar para: 50 (mais rápido), 200 (mais refinado)
```

### SimulatedAnnealing

```typescript
import { SimulatedAnnealing } from './services/optimization';

// Padrão
const sa1 = new SimulatedAnnealing();

// Customizado: mais exploração
const sa2 = new SimulatedAnnealing(1500, 0.99, 2000);
// initialTemperature: 1500 (mais alto = mais exploração)
// coolingRate: 0.99 (mais lento = mais iterações)
// maxIterations: 2000 (mais iterações = melhor qualidade)

// Customizado: mais rápido
const sa3 = new SimulatedAnnealing(500, 0.90, 500);
// initialTemperature: 500 (mais baixo = menos exploração)
// coolingRate: 0.90 (mais rápido = menos iterações)
// maxIterations: 500 (menos iterações = mais rápido)
```

---

## 🧪 Teste o Algoritmo Localmente

### 1. Clonar e Setup

```bash
cd sistema_curricular/backend
npm install
npm run build
```

### 2. Criar Script de Teste

```typescript
// test-algorithm.ts
import { Student, Theme } from './src/domain';
import { DistributionEngine } from './src/services/optimization';

async function main() {
  // Criar dados de teste
  const students = [
    new Student('s1', 'João', 'EE', 1, 'd1'),
    new Student('s2', 'Maria', 'ME', 2, 'd1'),
    new Student('s3', 'Pedro', 'EE', 3, 'd1'),
    new Student('s4', 'Ana', 'ME', 4, 'd1'),
  ];

  students.forEach(s => {
    s.addPreference('tema_a', 1);
  });

  const themes = [new Theme('tema_a', 'Tema A', 'Desc', 1)];

  // Executar algoritmo
  const engine = new DistributionEngine();
  const result = await engine.solve(students, themes);

  // Exibir resultado
  console.log(result.report);
}

main();
```

### 3. Executar

```bash
npx ts-node test-algorithm.ts
```

---

## 🔗 Integração com Backend (Próxima Fase)

### Estrutura de Rota

```typescript
// routes/organizer.routes.ts
router.post('/distributions/create', async (req, res) => {
  const { studentIds, themeIds } = req.body;

  // 1. Buscar dados do banco de dados
  const students = await database.getStudents(studentIds);
  const themes = await database.getThemes(themeIds);

  // 2. Executar distribuição
  const engine = new DistributionEngine();
  const result = await engine.solve(students, themes);

  // 3. Salvar resultado no banco
  const distribution = await database.saveDistribution(
    result.solution,
    req.organizerId
  );

  // 4. Retornar resultado
  res.json({
    distributionId: distribution.id,
    report: result.report,
    executionTime: result.executionTime,
  });
});
```

---

## 📊 Monitorar Performance

```typescript
// Log de execução
console.time('distribuição');
const result = await engine.solve(students, themes);
console.timeEnd('distribuição');

// Análise de score
const scorer = new PreferenceScorer();
const breakdown = scorer.getScoreBreakdown(result.solution);
console.log(`Score: ${breakdown.totalScore}`);
console.log(`Satisfação: ${breakdown.satisfactionScore}`);
console.log(`Penalidades: ${breakdown.penaltyScore}`);
console.log(`Normalizado: ${scorer.normalizeScore(result.solution)}/100`);
console.log(`Grau: ${scorer.getSatisfactionGrade(result.solution)}`);

// Validação
const validator = new ConstraintValidator();
const report = validator.getValidationReport(result.solution.groups);
console.log(`Viável: ${report.isFeasible}`);
console.log(`Críticas: ${report.summary.CRITICAL}`);
console.log(`Desejáveis: ${report.summary.DESIRABLE}`);
```

---

## 🐛 Troubleshooting

### Problema: Compilação falha

```bash
# Solução
cd backend
rm -rf dist node_modules
npm install
npm run build
```

### Problema: Algoritmo muito lento

```typescript
// Solução: Usar apenas Fase 1 + 2 para muitos alunos
const generator = new SolutionGenerator();
let solution = generator.generateInitialSolution(students, themes);

const localSearch = new LocalSearch();
solution = localSearch.optimize(solution);

// Pular Fase 3 (SimulatedAnnealing) para >= 500 alunos
```

### Problema: Solução não viável

```typescript
// Verificar viabilidade antes
const validation = engine.validateScenario(students, themes);
if (!validation.isFeasible) {
  console.error('Impossível distribuir:', validation.issues);
  // Ajustar: aumentar alunos, reduzir grupos, etc
}
```

---

## 📚 Referências

- **README.md**: Documentação completa com exemplos
- **RESUMO_ALGORITMO.md**: Quick reference das 3 fases
- **PLANO.md**: Design arquitetural completo
- **STATUS.md**: Status do projeto e próximos passos

---

## 🎯 Próximos Passos

1. ✅ Fase 3 (Algoritmo) - CONCLUÍDO
2. ⏳ Fase 4 (Backend Routes) - PRÓXIMO
3. ⏳ Fase 5 (Frontend) - DEPOIS
4. ⏳ Fase 6 (Testes) - NO FINAL

---

**Última atualização**: Fev 11, 2026
**Versão**: 1.0.0
**Status**: Fase 3 ✅ Concluída
