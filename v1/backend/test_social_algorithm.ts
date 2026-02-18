
import { Student, Theme, Course, Phase } from './src/domain';
import { DistributionEngine } from './src/services/optimization/DistributionEngine';

async function testSocialDistribution() {
    console.log('--- Iniciando Teste de Distribuição Social ---');

    // 1. Criar Temas
    const themes = [
        new Theme('t1', 'Tema A', 'Desc A', 1),
        new Theme('t2', 'Tema B', 'Desc B', 1),
        new Theme('t3', 'Tema C', 'Desc C', 1)
    ];

    // 2. Criar 12 Alunos
    const students: Student[] = [];
    for (let i = 0; i < 12; i++) {
        const id = `s${i}`;
        const name = `Student ${i}`;
        const course = i % 2 === 0 ? Course.ELECTRICAL_ENGINEERING : Course.MECHANICAL_ENGINEERING;
        const phase = i % 3 === 0 ? Phase.PHASE_5 : (i % 3 === 1 ? Phase.PHASE_7 : Phase.PHASE_9); // Diversificando fases

        // Preferências: Todos preferem Tema A > B > C
        const prefs = [
            { themeId: 't1', rank: 1 },
            { themeId: 't2', rank: 2 },
            { themeId: 't3', rank: 3 }
        ];

        students.push(new Student(id, name, course, phase, prefs));
    }

    // 3. Adicionar Afinidades
    // Par 0 e 1: Amigos (1.0)
    console.log('Definindo afinidade: s0 <-> s1 (1.0)');
    students[0].setAffinity('s1', 1.0);
    students[1].setAffinity('s0', 1.0);

    // Par 2 e 3: Amigos (1.0)
    console.log('Definindo afinidade: s2 <-> s3 (1.0)');
    students[2].setAffinity('s3', 1.0);
    students[3].setAffinity('s2', 1.0);

    // Par 4 e 5: Inimigos (-1.0) - Tentar separar
    console.log('Definindo afinidade: s4 <-> s5 (-1.0)');
    students[4].setAffinity('s5', -1.0);
    students[5].setAffinity('s4', -1.0);

    // 4. Executar Engine
    const engine = new DistributionEngine();

    // Validar cenário antes
    const validation = engine.validateScenario(students, themes);
    if (!validation.isFeasible) {
        console.error('Cenário inviável:', validation.issues);
        return;
    }

    console.log('Executando algortimo...');
    const result = await engine.solve(students, themes);

    console.log('--- Relatório ---');
    console.log(result.report);

    // 5. Verificações Específicas
    console.log('--- Verificação de Afinidades ---');

    // Helper para achar grupo do aluno
    const getGroupId = (sid: string) => {
        for (const g of result.solution.groups) {
            if (g.students.find(s => s.id === sid)) return g.id;
        }
        return null;
    };

    const g0 = getGroupId('s0');
    const g1 = getGroupId('s1');
    console.log(`s0 (Grupo ${g0}) e s1 (Grupo ${g1}): ${g0 === g1 ? 'JUNTOS ✅' : 'SEPARADOS ❌'}`);

    const g2 = getGroupId('s2');
    const g3 = getGroupId('s3');
    console.log(`s2 (Grupo ${g2}) e s3 (Grupo ${g3}): ${g2 === g3 ? 'JUNTOS ✅' : 'SEPARADOS ❌'}`);

    const g4 = getGroupId('s4');
    const g5 = getGroupId('s5');
    console.log(`s4 (Grupo ${g4}) e s5 (Grupo ${g5}): ${g4 !== g5 ? 'SEPARADOS ✅' : 'JUNTOS ⚠️'}`);

}

testSocialDistribution().catch(console.error);
