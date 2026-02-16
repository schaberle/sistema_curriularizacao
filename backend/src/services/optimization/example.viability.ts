/**
 * Exemplo prático: Usando SystemViabilityAnalyzer e AdaptiveConstraintManager
 *
 * Este arquivo mostra como detectar e lidar com impossibilidades de sistema
 * em um cenário real.
 */

import { Student, Theme, Course, Phase } from '../../domain';
import { SystemViabilityAnalyzer } from './SystemViabilityAnalyzer';
import { AdaptiveConstraintManager } from './AdaptiveConstraintManager';

// ============================================================================
// CENÁRIO 1: Sistema viável (restrições podem ser satisfeitas)
// ============================================================================

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║                   CENÁRIO 1: SISTEMA VIÁVEL                     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const scenario1Students = [
  // 4 grupos × 4 alunos = 16 alunos total
  // Grupo 1
  new Student('s1', 'Alice', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_1),
  new Student('s2', 'Bob', Course.MECHANICAL_ENGINEERING, Phase.PHASE_2),
  new Student('s3', 'Carol', Course.MECHANICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s4', 'David', Course.MECHANICAL_ENGINEERING, Phase.PHASE_4),
  // Grupo 2
  new Student('s5', 'Eve', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_1),
  new Student('s6', 'Frank', Course.MECHANICAL_ENGINEERING, Phase.PHASE_2),
  new Student('s7', 'Grace', Course.MECHANICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s8', 'Henry', Course.MECHANICAL_ENGINEERING, Phase.PHASE_4),
  // Grupo 3
  new Student('s9', 'Iris', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_1),
  new Student('s10', 'Jack', Course.MECHANICAL_ENGINEERING, Phase.PHASE_2),
  new Student('s11', 'Karen', Course.MECHANICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s12', 'Leo', Course.MECHANICAL_ENGINEERING, Phase.PHASE_4),
  // Grupo 4
  new Student('s13', 'Maria', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_1),
  new Student('s14', 'Nick', Course.MECHANICAL_ENGINEERING, Phase.PHASE_2),
  new Student('s15', 'Olivia', Course.MECHANICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s16', 'Pedro', Course.MECHANICAL_ENGINEERING, Phase.PHASE_4),
];

const scenario1Themes = [
  new Theme('t1', 'distribution1', 'Tema A', 4),
  new Theme('t2', 'distribution1', 'Tema B', 4),
];

const analyzer1 = new SystemViabilityAnalyzer();
const result1 = analyzer1.analyzeViability(scenario1Students, scenario1Themes);

console.log(analyzer1.generateReport(result1));

// ============================================================================
// CENÁRIO 2: Sistema impossível - Engenheiros Elétricos insuficientes
// ============================================================================

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║         CENÁRIO 2: INSUFICIENTE ENGENHEIROS ELÉTRICOS           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const scenario2Students = [
  // Apenas 2 EE para 8 grupos necessários (impossível ter 1 por grupo)
  // Total: 32 alunos
  new Student('s1', 'Alice', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_1),
  new Student('s2', 'Bob', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_2),
  // 30 alunos ME
  ...Array.from({ length: 30 }, (_, i) =>
    new Student(`s${i + 3}`, `Student ${i + 3}`, Course.MECHANICAL_ENGINEERING, Phase.PHASE_3)
  ),
];

const scenario2Themes = [
  new Theme('t1', 'distribution2', 'Tema A', 8),
];

const analyzer2 = new SystemViabilityAnalyzer();
const result2 = analyzer2.analyzeViability(scenario2Students, scenario2Themes);

console.log(analyzer2.generateReport(result2));

// Com adaptações propostas
const manager2 = new AdaptiveConstraintManager();
const state2 = manager2.analyzeAndAdapt(scenario2Students, scenario2Themes);

console.log(manager2.generateConstraintReport(state2, result2));

// ============================================================================
// CENÁRIO 3: Sistema impossível - Apenas uma fase
// ============================================================================

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║              CENÁRIO 3: APENAS UMA FASE DISPONÍVEL              ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const scenario3Students = [
  // Todos da Fase 3 (impossível ter 2 fases diferentes)
  new Student('s1', 'Alice', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s2', 'Bob', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s3', 'Carol', Course.MECHANICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s4', 'David', Course.MECHANICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s5', 'Eve', Course.MECHANICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s6', 'Frank', Course.MECHANICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s7', 'Grace', Course.MECHANICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s8', 'Henry', Course.MECHANICAL_ENGINEERING, Phase.PHASE_3),
];

const scenario3Themes = [
  new Theme('t1', 'distribution3', 'Tema A', 2),
];

const analyzer3 = new SystemViabilityAnalyzer();
const result3 = analyzer3.analyzeViability(scenario3Students, scenario3Themes);

console.log(analyzer3.generateReport(result3));

// Com adaptações propostas
const manager3 = new AdaptiveConstraintManager();
const state3 = manager3.analyzeAndAdapt(scenario3Students, scenario3Themes);

console.log(manager3.generateConstraintReport(state3, result3));

// ============================================================================
// CENÁRIO 4: Sistema impossível - Distribuição muito desbalanceada
// ============================================================================

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║          CENÁRIO 4: DISTRIBUIÇÃO MUITO DESBALANCEADA             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const scenario4Students = [
  // Fase 3: 30 alunos (90%)
  ...Array.from({ length: 25 }, (_, i) =>
    new Student(`s${i + 1}`, `Student ${i + 1}`, Course.MECHANICAL_ENGINEERING, Phase.PHASE_3)
  ),
  new Student('s26', 'Alice', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s27', 'Bob', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s28', 'Carol', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s29', 'David', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_3),
  new Student('s30', 'Eve', Course.ELECTRICAL_ENGINEERING, Phase.PHASE_3),

  // Fase 1: 2 alunos (5%)
  new Student('s31', 'Frank', Course.MECHANICAL_ENGINEERING, Phase.PHASE_1),
  new Student('s32', 'Grace', Course.MECHANICAL_ENGINEERING, Phase.PHASE_1),

  // Fase 2: 2 alunos (5%)
  new Student('s33', 'Henry', Course.MECHANICAL_ENGINEERING, Phase.PHASE_2),
  new Student('s34', 'Iris', Course.MECHANICAL_ENGINEERING, Phase.PHASE_2),
];

const scenario4Themes = [
  new Theme('t1', 'distribution4', 'Tema A', 8),
  new Theme('t2', 'distribution4', 'Tema B', 1),
];

const analyzer4 = new SystemViabilityAnalyzer();
const result4 = analyzer4.analyzeViability(scenario4Students, scenario4Themes);

console.log(analyzer4.generateReport(result4));

// Com adaptações propostas
const manager4 = new AdaptiveConstraintManager();
const state4 = manager4.analyzeAndAdapt(scenario4Students, scenario4Themes);

console.log(manager4.generateConstraintReport(state4, result4));

// ============================================================================
// RESUMO FINAL
// ============================================================================

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║                      RESUMO EXECUTIVO                           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const scenarios = [
  { name: 'Cenário 1 (Viável)', result: result1, state: undefined },
  { name: 'Cenário 2 (EE insuficiente)', result: result2, state: state2 },
  { name: 'Cenário 3 (1 fase)', result: result3, state: state3 },
  { name: 'Cenário 4 (Desbalanceado)', result: result4, state: state4 },
];

console.log('📊 STATUS POR CENÁRIO:\n');

for (const scenario of scenarios) {
  const status = scenario.result.isViable ? '✅ VIÁVEL' : '❌ INVIÁVEL';
  const adaptation = scenario.state?.adaptedFromDefault ? ' (adaptado)' : '';

  console.log(`${status} - ${scenario.name}${adaptation}`);

  if (!scenario.result.isViable) {
    scenario.result.impossibilities.forEach(imp => {
      console.log(`     └─ ${imp.type}`);
    });
  }
}

console.log('\n💡 CONCLUSÃO:\n');
console.log('O analyzer detecta automaticamente quando o sistema é impossível');
console.log('e sugere relaxamentos de restrições específicos e mínimos para');
console.log('torná-lo viável. Isto evita a retorno de E=∞ do sistema.\n');
