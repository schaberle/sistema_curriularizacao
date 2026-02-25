import fs from 'fs';
import path from 'path';
import { OfficialStudentRegistryService } from './OfficialStudentRegistryService';

function resolveWorkbookPath(): string {
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const workbookFile = fs
    .readdirSync(repoRoot)
    .find((entry) => /^Levantamento.*\.xls$/i.test(entry));

  if (!workbookFile) {
    throw new Error('Arquivo Levantamento*.xls nao encontrado para teste');
  }

  return path.join(repoRoot, workbookFile);
}

describe('OfficialStudentRegistryService', () => {
  const originalPepper = process.env.STUDENT_REGISTRY_PEPPER;
  const originalWorkbookPath = process.env.STUDENT_REGISTRY_XLS_PATH;

  beforeAll(() => {
    process.env.STUDENT_REGISTRY_PEPPER = 'test-pepper-123';
    process.env.STUDENT_REGISTRY_XLS_PATH = resolveWorkbookPath();
  });

  afterAll(() => {
    process.env.STUDENT_REGISTRY_PEPPER = originalPepper;
    process.env.STUDENT_REGISTRY_XLS_PATH = originalWorkbookPath;
  });

  it('parseia a planilha oficial e exclui alunos de automacao', () => {
    const service = new OfficialStudentRegistryService({} as any);
    const result = service.parseWorkbook();

    expect(result.totalRawMatriculaRows).toBe(171);
    expect(result.excludedAutomacaoRows).toBe(4);
    expect(result.rows).toHaveLength(167);
  });

  it('garante RA unico e campos obrigatorios no parse', () => {
    const service = new OfficialStudentRegistryService({} as any);
    const result = service.parseWorkbook();
    const seenMatriculas = new Set<string>();

    for (const row of result.rows) {
      expect(row.matricula.length).toBeGreaterThanOrEqual(4);
      expect(row.academico.length).toBeGreaterThan(0);
      expect(row.origemAluno.length).toBeGreaterThan(0);
      expect(Number.isInteger(row.faseTurma)).toBe(true);
      expect(row.faseTurma).toBeGreaterThanOrEqual(1);
      expect(row.faseTurma).toBeLessThanOrEqual(10);
      expect(seenMatriculas.has(row.matricula)).toBe(false);
      seenMatriculas.add(row.matricula);
    }
  });

  it('usa student_registry do banco como fonte quando o .xls nao existe', async () => {
    const databaseMock = {
      getStudentRegistryTemplateRows: jest.fn().mockResolvedValue([
        {
          academico: 'Aluno Teste',
          origemAluno: 'ENGENHARIA ELÉTRICA',
          faseTurma: 4,
          matriculaHash: 'hash_ja_existente',
        },
      ]),
      upsertStudentRegistry: jest.fn().mockResolvedValue({
        importedRows: 1,
        activeRows: 1,
        deactivatedRows: 0,
      }),
    };

    const service = new OfficialStudentRegistryService(databaseMock as any);
    jest.spyOn(service as any, 'resolveWorkbookPath').mockReturnValue(null);
    const result = await service.syncDistribution('dist-teste');

    expect(databaseMock.getStudentRegistryTemplateRows).toHaveBeenCalledTimes(1);
    expect(databaseMock.upsertStudentRegistry).toHaveBeenCalledTimes(1);
    expect(databaseMock.upsertStudentRegistry).toHaveBeenCalledWith([
      {
        distributionId: 'dist-teste',
        academico: 'Aluno Teste',
        origemAluno: 'ENGENHARIA ELÉTRICA',
        faseTurma: 4,
        matriculaHash: 'hash_ja_existente',
        active: true,
      },
    ]);

    expect(result.source.filePath).toBe('database://student_registry_template');
    expect(result.activeRows).toBe(1);
  });
});
