import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import {
  DatabaseService,
  StudentRegistryImportEntry,
  StudentRegistryTemplateRow,
} from '../database/DatabaseService';
import {
  hashMatricula,
  isAutomacaoOrigin,
  mapOrigemAlunoToCourse,
  normalizeHeaderKey,
  normalizeMatricula,
} from './officialRegistry.utils';

type ParsedOfficialStudent = {
  matricula: string;
  academico: string;
  origemAluno: string;
  faseTurma: number;
};

type ParsedWorkbookResult = {
  rows: ParsedOfficialStudent[];
  filePath: string;
  totalRawMatriculaRows: number;
  excludedAutomacaoRows: number;
};

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

const REQUIRED_HEADERS = ['RA', 'ACADEMICO', 'ORIGEM DO ALUNO', 'FASE TURMA'] as const;

export class OfficialStudentRegistryService {
  private readonly registryPepper: string;

  constructor(private readonly database: DatabaseService) {
    this.registryPepper = this.resolveRegistryPepper();
  }

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

  parseWorkbook(): ParsedWorkbookResult {
    const workbookPath = this.resolveWorkbookPath();
    if (!workbookPath) {
      throw new Error('Arquivo oficial de alunos (.xls) nao encontrado');
    }

    const workbook = XLSX.readFile(workbookPath, {
      cellDates: false,
      raw: false,
    });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('Planilha oficial sem abas');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    const headerRowIndex = this.findHeaderRowIndex(matrix);
    if (headerRowIndex < 0) {
      throw new Error(`Cabecalho da planilha nao encontrado. Esperado: ${REQUIRED_HEADERS.join(', ')}`);
    }

    const headerColumns = this.resolveHeaderColumns(matrix[headerRowIndex] || []);
    const seenMatriculas = new Set<string>();
    const rows: ParsedOfficialStudent[] = [];
    let totalRawMatriculaRows = 0;
    let excludedAutomacaoRows = 0;

    for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex] || [];
      const rawMatricula = String(row[headerColumns.ra] || '').trim();
      if (!rawMatricula) {
        continue;
      }
      totalRawMatriculaRows += 1;

      const matricula = normalizeMatricula(rawMatricula);
      if (!matricula || matricula.length < 4 || matricula.length > 64) {
        throw new Error(`Linha ${rowIndex + 1}: RA invalido`);
      }
      if (seenMatriculas.has(matricula)) {
        throw new Error(`Linha ${rowIndex + 1}: RA duplicado na planilha`);
      }
      seenMatriculas.add(matricula);

      const academico = String(row[headerColumns.academico] || '').trim();
      if (!academico) {
        throw new Error(`Linha ${rowIndex + 1}: Academico obrigatorio`);
      }

      const origemAluno = String(row[headerColumns.origemAluno] || '').trim();
      if (!origemAluno) {
        throw new Error(`Linha ${rowIndex + 1}: Origem do aluno obrigatoria`);
      }

      const faseTurmaRaw = String(row[headerColumns.faseTurma] || '').trim();
      const faseTurma = Number.parseInt(faseTurmaRaw, 10);
      if (!Number.isInteger(faseTurma) || faseTurma < 1 || faseTurma > 10) {
        throw new Error(`Linha ${rowIndex + 1}: Fase Turma invalida`);
      }

      if (isAutomacaoOrigin(origemAluno)) {
        excludedAutomacaoRows += 1;
        continue;
      }

      const course = mapOrigemAlunoToCourse(origemAluno);
      if (!course) {
        throw new Error(`Linha ${rowIndex + 1}: Origem do aluno nao suportada (${origemAluno})`);
      }

      rows.push({
        matricula,
        academico,
        origemAluno,
        faseTurma,
      });
    }

    return {
      rows,
      filePath: workbookPath,
      totalRawMatriculaRows,
      excludedAutomacaoRows,
    };
  }

  private async loadCanonicalRows(): Promise<CanonicalSource> {
    const workbookPath = this.resolveWorkbookPath();
    if (workbookPath) {
      const parsed = this.parseWorkbook();
      return {
        rows: parsed.rows.map((row) => ({
          academico: row.academico,
          origemAluno: row.origemAluno,
          faseTurma: row.faseTurma,
          matriculaHash: hashMatricula(row.matricula, this.registryPepper),
        })),
        source: {
          filePath: parsed.filePath,
          totalRawMatriculaRows: parsed.totalRawMatriculaRows,
          excludedAutomacaoRows: parsed.excludedAutomacaoRows,
        },
      };
    }

    const templateRows = await this.database.getStudentRegistryTemplateRows();
    if (!templateRows.length) {
      throw new Error('Nao ha fonte oficial disponivel: .xls ausente e student_registry vazio');
    }

    return {
      rows: this.normalizeTemplateRows(templateRows),
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
      .filter((row) =>
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

  private resolveRegistryPepper(): string {
    const pepper = String(process.env.STUDENT_REGISTRY_PEPPER || '').trim();
    if (!pepper) {
      throw new Error('STUDENT_REGISTRY_PEPPER obrigatoria');
    }
    return pepper;
  }

  private resolveWorkbookPath(): string | null {
    const configuredPath = String(process.env.STUDENT_REGISTRY_XLS_PATH || '').trim();
    const currentDir = process.cwd();

    const candidates = [
      configuredPath,
      path.resolve(currentDir, 'Levantamento Elétrica-Mecanica-Automação.xls'),
      path.resolve(currentDir, '..', 'Levantamento Elétrica-Mecanica-Automação.xls'),
      path.resolve(currentDir, '..', '..', 'Levantamento Elétrica-Mecanica-Automação.xls'),
      path.resolve(currentDir, 'Levantamento Eletrica-Mecanica-Automacao.xls'),
      path.resolve(currentDir, '..', 'Levantamento Eletrica-Mecanica-Automacao.xls'),
      path.resolve(currentDir, '..', '..', 'Levantamento Eletrica-Mecanica-Automacao.xls'),
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const rootCandidate = path.resolve(currentDir, '..', '..');
    if (fs.existsSync(rootCandidate)) {
      const xlsFile = fs
        .readdirSync(rootCandidate)
        .find((entry) => /^Levantamento.*\.xls$/i.test(entry));
      if (xlsFile) {
        return path.join(rootCandidate, xlsFile);
      }
    }

    return null;
  }

  private findHeaderRowIndex(rows: Array<Array<string | number | null>>): number {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || [];
      const normalized = row.map((cell) => normalizeHeaderKey(String(cell || '')));
      const hasAllHeaders = REQUIRED_HEADERS.every((header) =>
        normalized.includes(normalizeHeaderKey(header))
      );

      if (hasAllHeaders) {
        return index;
      }
    }

    return -1;
  }

  private resolveHeaderColumns(headerRow: Array<string | number | null>): {
    ra: number;
    academico: number;
    origemAluno: number;
    faseTurma: number;
  } {
    const normalized = headerRow.map((cell) => normalizeHeaderKey(String(cell || '')));
    const idxRa = normalized.indexOf(normalizeHeaderKey('RA'));
    const idxAcademico = normalized.indexOf(normalizeHeaderKey('ACADEMICO'));
    const idxOrigemAluno = normalized.indexOf(normalizeHeaderKey('ORIGEM DO ALUNO'));
    const idxFaseTurma = normalized.indexOf(normalizeHeaderKey('FASE TURMA'));

    if (idxRa < 0 || idxAcademico < 0 || idxOrigemAluno < 0 || idxFaseTurma < 0) {
      throw new Error('Cabecalho da planilha oficial esta incompleto');
    }

    return {
      ra: idxRa,
      academico: idxAcademico,
      origemAluno: idxOrigemAluno,
      faseTurma: idxFaseTurma,
    };
  }
}
