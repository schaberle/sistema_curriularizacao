import { OfficialStudentRegistryService } from './OfficialStudentRegistryService';

describe('OfficialStudentRegistryService', () => {
  it('usa student_registry do banco como fonte oficial', async () => {
    const databaseMock = {
      getStudentRegistryTemplateRows: jest.fn().mockResolvedValue([
        {
          academico: 'Aluno Teste',
          origemAluno: 'ENGENHARIA ELETRICA',
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
    const result = await service.syncDistribution('dist-teste');

    expect(databaseMock.getStudentRegistryTemplateRows).toHaveBeenCalledTimes(1);
    expect(databaseMock.upsertStudentRegistry).toHaveBeenCalledTimes(1);
    expect(databaseMock.upsertStudentRegistry).toHaveBeenCalledWith([
      {
        distributionId: 'dist-teste',
        academico: 'Aluno Teste',
        origemAluno: 'ENGENHARIA ELETRICA',
        faseTurma: 4,
        matriculaHash: 'hash_ja_existente',
        active: true,
      },
    ]);

    expect(result.source.filePath).toBe('database://student_registry_template');
    expect(result.activeRows).toBe(1);
  });

  it('filtra linhas invalidas da fonte oficial', async () => {
    const databaseMock = {
      getStudentRegistryTemplateRows: jest.fn().mockResolvedValue([
        {
          academico: 'Aluno Valido',
          origemAluno: 'ENGENHARIA ELETRICA',
          faseTurma: 3,
          matriculaHash: 'hash_valido',
        },
        {
          academico: '',
          origemAluno: 'ENGENHARIA MECANICA',
          faseTurma: 2,
          matriculaHash: 'hash_invalido',
        },
      ]),
      upsertStudentRegistry: jest.fn().mockResolvedValue({
        importedRows: 1,
        activeRows: 1,
        deactivatedRows: 0,
      }),
    };

    const service = new OfficialStudentRegistryService(databaseMock as any);
    await service.syncDistribution('dist-teste');

    expect(databaseMock.upsertStudentRegistry).toHaveBeenCalledWith([
      {
        distributionId: 'dist-teste',
        academico: 'Aluno Valido',
        origemAluno: 'ENGENHARIA ELETRICA',
        faseTurma: 3,
        matriculaHash: 'hash_valido',
        active: true,
      },
    ]);
  });

  it('falha quando nao ha fonte oficial no banco', async () => {
    const databaseMock = {
      getStudentRegistryTemplateRows: jest.fn().mockResolvedValue([]),
      upsertStudentRegistry: jest.fn(),
    };

    const service = new OfficialStudentRegistryService(databaseMock as any);

    await expect(service.syncDistribution('dist-teste')).rejects.toThrow(
      'Nao ha fonte oficial disponivel no banco (student_registry)'
    );
    expect(databaseMock.upsertStudentRegistry).not.toHaveBeenCalled();
  });
});
