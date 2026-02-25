import {
  DatabaseService,
  StudentRegistryImportEntry,
  StudentRegistryTemplateRow,
} from '../database/DatabaseService';

type CanonicalRegistryRow = {
  academico: string;
  origemAluno: string;
  faseTurma: number;
  matriculaHash: string;
};

type CanonicalSource = {
  rows: CanonicalRegistryRow[];
  source: {
    filePath: string;
    totalRawMatriculaRows: number;
    excludedAutomacaoRows: number;
  };
};

export class OfficialStudentRegistryService {
  constructor(private readonly database: DatabaseService) {}

  async syncDistribution(distributionId: string): Promise<{
    distributionId: string;
    importedRows: number;
    activeRows: number;
    deactivatedRows: number;
    source: {
      filePath: string;
      totalRawMatriculaRows: number;
      excludedAutomacaoRows: number;
    };
  }> {
    const canonical = await this.loadCanonicalRows();
    const entries = this.buildRegistryEntries(distributionId, canonical.rows);
    const upsertResult = await this.database.upsertStudentRegistry(entries);

    return {
      distributionId,
      importedRows: upsertResult.importedRows,
      activeRows: upsertResult.activeRows,
      deactivatedRows: upsertResult.deactivatedRows,
      source: canonical.source,
    };
  }

  async syncAllDistributions(): Promise<{
    distributionsProcessed: number;
    totalImportedRows: number;
    totalActiveRows: number;
    totalDeactivatedRows: number;
    source: {
      filePath: string;
      totalRawMatriculaRows: number;
      excludedAutomacaoRows: number;
    };
    perDistribution: Array<{
      distributionId: string;
      importedRows: number;
      activeRows: number;
      deactivatedRows: number;
    }>;
  }> {
    const distributions = await this.database.getAllDistributions();
    const canonical = await this.loadCanonicalRows();
    const perDistribution: Array<{
      distributionId: string;
      importedRows: number;
      activeRows: number;
      deactivatedRows: number;
    }> = [];

    let totalImportedRows = 0;
    let totalActiveRows = 0;
    let totalDeactivatedRows = 0;

    for (const distribution of distributions) {
      const distributionId = String(distribution.id || '');
      if (!distributionId) {
        continue;
      }

      const entries = this.buildRegistryEntries(distributionId, canonical.rows);
      const result = await this.database.upsertStudentRegistry(entries);
      totalImportedRows += result.importedRows;
      totalActiveRows += result.activeRows;
      totalDeactivatedRows += result.deactivatedRows;

      perDistribution.push({
        distributionId,
        importedRows: result.importedRows,
        activeRows: result.activeRows,
        deactivatedRows: result.deactivatedRows,
      });
    }

    return {
      distributionsProcessed: perDistribution.length,
      totalImportedRows,
      totalActiveRows,
      totalDeactivatedRows,
      source: canonical.source,
      perDistribution,
    };
  }

  private async loadCanonicalRows(): Promise<CanonicalSource> {
    const templateRows = await this.database.getStudentRegistryTemplateRows();
    if (!templateRows.length) {
      throw new Error('Nao ha fonte oficial disponivel no banco (student_registry)');
    }

    const rows = this.normalizeTemplateRows(templateRows);
    if (!rows.length) {
      throw new Error('Fonte oficial do banco nao possui linhas validas');
    }

    return {
      rows,
      source: {
        filePath: 'database://student_registry_template',
        totalRawMatriculaRows: templateRows.length,
        excludedAutomacaoRows: 0,
      },
    };
  }

  private normalizeTemplateRows(rows: StudentRegistryTemplateRow[]): CanonicalRegistryRow[] {
    return rows
      .map((row) => ({
        academico: String(row.academico || '').trim(),
        origemAluno: String(row.origemAluno || '').trim(),
        faseTurma: Number(row.faseTurma),
        matriculaHash: String(row.matriculaHash || '').trim(),
      }))
      .filter(
        (row) =>
          row.academico.length > 0 &&
          row.origemAluno.length > 0 &&
          Number.isInteger(row.faseTurma) &&
          row.faseTurma >= 1 &&
          row.faseTurma <= 10 &&
          row.matriculaHash.length > 0
      );
  }

  private buildRegistryEntries(
    distributionId: string,
    rows: CanonicalRegistryRow[]
  ): StudentRegistryImportEntry[] {
    return rows.map((row) => ({
      distributionId,
      academico: row.academico,
      origemAluno: row.origemAluno,
      faseTurma: row.faseTurma,
      matriculaHash: row.matriculaHash,
      active: true,
    }));
  }
}
